<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class PdfExtractorService
{
    public static function maxAutomaticBytes(): int
    {
        return max(0, min(20 * 1024 * 1024, (int) config('acadex.max_automatic_extraction_bytes', 20 * 1024 * 1024)));
    }

    public static function emptyMetadata(): array
    {
        return ['title' => null, 'year' => null, 'author' => null, 'author_details' => [],
            'program' => null, 'abstract' => null, 'keywords' => [], 'adviser_name' => null];
    }
    /**
     * Number of lines to trim from the top (header zone ~1.25 cm).
     * Typically includes university name, address, and separator lines.
     */
    protected int $headerLinesToTrim = 3;

    /**
     * Number of lines to trim from the bottom (footer zone ~1.25 cm).
     * Typically includes page numbers and institution footers.
     */
    protected int $footerLinesToTrim = 0;

    /**
     * Additional header/footer text patterns to strip after line trimming.
     */
    protected array $stripPatterns = [
        '/^[\t ]*Bongabong,?[\t ]+Oriental[\t ]+Mindoro(?:[\t ]+\d+)?(?:[\t ]+Philippines?)?[\t ]*$/mi',
        '/Mindoro\s+State\s+University/i',
        '/Republic\s+of\s+the\s+Philippines/i',
        '/^\s*\d{1,3}\s*$/m', // standalone page numbers (1-3 digits)
        '/^\s*Page\s*\d+\s*$/mi', // "Page 1" style footers
    ];

    /** Minimum average chars/page to consider text-based (not scanned). */
    private const OCR_THRESHOLD = 80;

    /** Ghostscript binary — auto-detected at runtime. */
    private const GS_PATHS = [
        'C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe',
        'C:\\Program Files\\gs\\gs10.05.0\\bin\\gswin64c.exe',
        'C:\\Program Files\\gs\\gs10.04.0\\bin\\gswin64c.exe',
        'gswin64c',
        'gswin32c',
        'gs',
    ];

    /** Tesseract binary — auto-detected at runtime. */
    private const TESS_PATHS = [
        'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
        'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
        'tesseract',
    ];

    /**
     * Extract text and metadata from a PDF file.
     * Automatically falls back to OCR for scanned PDFs.
     */
    public function extract(UploadedFile $file): array
    {
        return $this->extractWithSource($file)['metadata'];
    }

    /**
     * Extract metadata from an already-decrypted plain PDF path.
     * Used by the queued upload job.
     */
    public function extractFromPath(string $filePath): array
    {
        return $this->extractPathWithSource($filePath)['metadata'];
    }

    /**
     * Extract metadata plus the cleaned source text used for grounding.
     *
     * @return array{metadata: array, source: string, scope: string}
     */
    public function extractWithSource(UploadedFile $file): array
    {
        // Never hand a large original to PHP's whole-document parser. Extract
        // from a bounded front-matter copy using the existing metadata pipeline.
        if ($file->getSize() > self::maxAutomaticBytes()) {
            if (self::maxAutomaticBytes() < 1) {
                return ['metadata' => self::emptyMetadata(), 'source' => '', 'scope' => 'unavailable'];
            }
            $sample = app(PdfMetadataSampler::class)->create($file);
            try {
                $result = $this->extractWithSource(new UploadedFile($sample, 'metadata-sample.pdf', 'application/pdf', null, true));
                $result['scope'] = 'first_12_pages';
                return $result;
            } finally {
                @unlink($sample);
            }
        }
        return $this->extractPathWithSource($file->getRealPath());
    }

    /**
     * @return array{metadata: array, source: string, scope: string}
     */
    public function extractPathWithSource(string $filePath): array
    {
        clearstatcache(true, $filePath);
        $size = @filesize($filePath);
        if ($size !== false && $size > self::maxAutomaticBytes()) {
            if (self::maxAutomaticBytes() < 1) {
                return ['metadata' => self::emptyMetadata(), 'source' => '', 'scope' => 'unavailable'];
            }
            $source = new UploadedFile($filePath, 'metadata-source.pdf', 'application/pdf', null, true);
            $sample = app(PdfMetadataSampler::class)->create($source);
            try {
                $result = $this->extractPathWithSource($sample);
                $result['scope'] = 'first_12_pages';
                return $result;
            } finally {
                @unlink($sample);
            }
        }

        // Parse PDF — get raw pages (no trimming)
        $rawPages = $this->extractRawPages($filePath);
        $rawFirstPage = $rawPages[0] ?? '';

        // Sparse separator/contents pages must not force OCR when the title or
        // abstract already has readable text. Exclude scanner stamps and known
        // margins before measuring so watermark-only scans still invoke OCR.
        $pageLengths = array_map(function (string $page): int {
            $page = $this->stripPatternNoise($page);
            $page = preg_replace('/^.*(?:CamScanner|Scanned with|Adobe Scan|Microsoft Lens).*$/mi', '', $page);
            return mb_strlen(trim($page));
        }, $rawPages);
        $totalChars = array_sum($pageLengths);
        $pageCount  = max(1, count($rawPages));
        $avgChars   = $totalChars / $pageCount;
        $isOcr      = false;

        $readableFrontMatter = $totalChars >= 240 && max($pageLengths ?: [0]) >= 160;
        if ($avgChars < self::OCR_THRESHOLD && !$readableFrontMatter) {
            Log::info("PdfExtractorService: sparse text ({$avgChars} chars/page avg) — attempting OCR on [{$filePath}]");
            $ocrPages = $this->extractPagesViaOcr($filePath);

            if (!empty(implode('', $ocrPages))) {
                Log::info('PdfExtractorService: OCR succeeded, using OCR text for metadata extraction.');
                $rawPages     = $ocrPages;
                $rawFirstPage = $ocrPages[0] ?? '';
                $isOcr        = true;
            } else {
                Log::warning('PdfExtractorService: OCR returned no text. Metadata will be empty.');
            }
        }

        // Preserve OCR wording; normalize whitespace without guessing characters.
        if ($isOcr) {
            $rawPages     = array_map([$this, 'normalizeOcrText'], $rawPages);
            $rawFirstPage = $rawPages[0] ?? '';
        }

        // Clean pages (header/footer trimmed) for title, author, abstract, etc.
        $pages = array_map(function ($rawText) use ($isOcr) {
            $cleaned = $this->trimHeaderFooterLines($rawText, $isOcr);
            $cleaned = $this->stripPatternNoise($cleaned);
            return $this->normalizeWhitespace($cleaned);
        }, $rawPages);
        $pages = $this->removeRepeatedPageMargins($pages);

        $firstPageText = $pages[0] ?? '';
        $fullText      = implode("\n", $pages);

        $abstract = $this->extractAbstract($fullText);

        $authorField   = $this->extractAuthor($firstPageText, $fullText);
        if ($authorField === 'Unknown Author') $authorField = '';
        $authorDetails = $this->extractAuthorDetails($fullText, $authorField);
        $title = $this->extractTitle($firstPageText, $fullText);

        return [
            'metadata' => [
                'title'          => $title === 'Untitled' ? null : $title,
                'year'           => $this->extractYear($rawFirstPage),
                'author'         => $authorField !== '' ? $authorField : null,
                'author_details' => $authorDetails,
                'adviser_name'   => $this->extractAdviserName($rawPages),
                'program'        => $this->extractProgram($fullText),
                'abstract'       => $abstract,
                'keywords'       => $this->extractKeywords($fullText),
            ],
            'source' => $fullText,
            'scope' => count($rawPages) >= PdfMetadataSampler::MAX_PAGES ? 'first_12_pages' : 'full_document',
        ];
    }

    /** Extract an adviser signature only within the approval-sheet page. */
    public function extractAdviserName(array $pages): ?string
    {
        // Raw page lines retain the heading even when header cleanup removes it.
        foreach ($pages as $page) {
            $page = preg_replace('/^([\t ]*)APPROVAL[\t ]*\R[\t ]*SHEET[\t ]*$/imu', '$1APPROVAL SHEET', $page);
            $lines = preg_split('/\R/u', $page);
            $inApproval = false;
            foreach ($lines as $index => $line) {
                $line = AdviserMatching::displayName($line);
                if (preg_match('/^APPROVAL\s+SHEET\s*[:.]?$/iu', $line)) {
                    $inApproval = true;
                    continue;
                }
                if (!$inApproval || !preg_match('/^(?:(?:Capstone|Project|Thesis|Research)\s+)?Adviser\s*[:.]?$/iu', $line)) continue;
                // Skip empty lines and signature rules, never unrelated text.
                for ($previous = $index - 1; $previous >= 0; $previous--) {
                    $name = AdviserMatching::displayName($lines[$previous]);
                    if ($name === '' || preg_match('/^[_\-–—.\s]+$/u', $name)) continue;
                    if (mb_strlen($name) <= 255 && preg_match('/^\p{L}[\p{L}\p{M}\s.,\x{2019}\x{0027}()\-]+$/u', $name)
                        && count(preg_split('/\s+/u', $name)) >= 2
                        && !preg_match('/^approval\s+sheet$|^(?:submitted|approved)\b|^(?:panelist|chairperson|dean|adviser)$/iu', $name)) {
                        return $name;
                    }
                    break;
                }
            }
        }
        return null;
    }

    /** Collapse whitespace and rejoin words split by a hyphenated line break. */
    protected function normalizeWhitespace(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/([a-zA-Z])-\n([a-z])/', '$1$2', $text);
        $text = preg_replace('/[ \t]{2,}/', ' ', $text);
        return preg_replace('/\n{4,}/', "\n\n\n", $text);
    }

    /**
     * Remove a first/last line that repeats on three or more pages. This is a
     * conservative cross-page header/footer cleanup that leaves body text alone.
     *
     * @param string[] $pages
     * @return string[]
     */
    protected function removeRepeatedPageMargins(array $pages): array
    {
        if (count($pages) < 3) return $pages;

        $counts = ['first' => [], 'last' => []];
        foreach ($pages as $page) {
            $lines = array_values(array_filter(array_map('trim', explode("\n", $page)), fn ($l) => $l !== ''));
            if (empty($lines)) continue;
            $counts['first'][$lines[0]] = ($counts['first'][$lines[0]] ?? 0) + 1;
            $last = end($lines);
            $counts['last'][$last] = ($counts['last'][$last] ?? 0) + 1;
        }

        $stripFirst = array_key_first(array_filter($counts['first'], fn ($n) => $n >= 3));
        $stripLast  = array_key_first(array_filter($counts['last'], fn ($n) => $n >= 3));
        $stripFirst = $stripFirst === null ? null : (string) $stripFirst;
        $stripLast  = $stripLast === null ? null : (string) $stripLast;

        return array_map(function (string $page) use ($stripFirst, $stripLast) {
            $lines = explode("\n", $page);
            if ($stripFirst !== null && trim($lines[0] ?? '') === $stripFirst) array_shift($lines);
            if ($stripLast !== null && trim(end($lines) ?: '') === $stripLast) array_pop($lines);
            return implode("\n", $lines);
        }, $pages);
    }




    /**
     * Extract RAW text per page using smalot/pdfparser (works for text-based PDFs).
     *
     * @return string[] Array of raw text strings indexed by page number (0-based).
     */
    protected function extractRawPages(string $filePath): array
    {
        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf    = $parser->parseFile($filePath);
            $pages  = [];

            foreach (array_slice($pdf->getPages(), 0, PdfMetadataSampler::MAX_PAGES) as $page) {
                $pages[] = $page->getText();
            }

            return $pages;
        } catch (\Exception $e) {
            Log::warning('PDF raw text extraction failed: ' . $e->getMessage());
            return [''];
        }
    }

    /**
     * Extract text per page from a scanned PDF.
     *
     * Primary:  calls the PaddleOCR FastAPI service (port 8001) which uses
     *           PP-OCRv4 with adaptive preprocessing, deskewing, and
     *           paragraph-aware text reconstruction — far more accurate than
     *           Tesseract on degraded or rotated scans.
     *
     * Fallback: if the PaddleOCR service is unreachable, falls back to the
     *           original Ghostscript + Tesseract pipeline so nothing breaks
     *           when the Python service is not running.
     *
     * @return string[]  One string per page, 0-indexed, same as extractRawPages().
     */
    protected function extractPagesViaOcr(string $filePath): array
    {
        // ── 1. Try PaddleOCR FastAPI service ──────────────────────────────────
        $paddleResult = $this->extractPagesViaPaddleOcr($filePath);
        if (!empty(implode('', $paddleResult))) {
            return $paddleResult;
        }

        // ── 2. Fallback: Ghostscript + Tesseract ──────────────────────────────
        Log::info('PdfExtractorService: PaddleOCR service unavailable — falling back to Tesseract.');
        return $this->extractPagesViaTesseract($filePath);
    }

    /**
     * Call the PaddleOCR FastAPI microservice with the PDF file.
     * Returns one text string per page in the same format as extractRawPages().
     *
     * @return string[]
     */
    protected function extractPagesViaPaddleOcr(string $filePath): array
    {
        $serviceUrl = rtrim(config('acadex.ocr_service_url'), '/') . '/api/ocr';

        try {
            // Prepare multipart/form-data POST with the PDF file
            $boundary = '----EduArchiveBoundary' . bin2hex(random_bytes(8));
            // PHP upload temporary paths normally have no extension. The
            // multipart name describes the content and never exposes that path.
            $fileName = 'document.pdf';
            $fileContent = file_get_contents($filePath);

            if ($fileContent === false) {
                Log::warning('PaddleOCR: could not read file: ' . $filePath);
                return [''];
            }

            // Build multipart body manually (no Guzzle dependency needed)
            $body  = "--{$boundary}\r\n";
            $body .= "Content-Disposition: form-data; name=\"max_pages\"\r\n\r\n" . PdfMetadataSampler::MAX_PAGES . "\r\n";
            $body .= "--{$boundary}\r\n";
            $body .= "Content-Disposition: form-data; name=\"file\"; filename=\"{$fileName}\"\r\n";
            $body .= "Content-Type: application/pdf\r\n\r\n";
            $body .= $fileContent . "\r\n";
            $body .= "--{$boundary}--\r\n";

            $context = stream_context_create([
                'http' => [
                    'method'  => 'POST',
                    'header'  =>
                        "Content-Type: multipart/form-data; boundary={$boundary}\r\n" .
                        "Content-Length: " . strlen($body) . "\r\n",
                    'content' => $body,
                    'timeout' => 120,   // up to 2 minutes for large scanned PDFs
                    'ignore_errors' => true,
                ],
            ]);

            $raw = @file_get_contents($serviceUrl, false, $context);

            if ($raw === false) {
                Log::info('PaddleOCR: service not reachable at ' . $serviceUrl);
                return [''];
            }

            // Check HTTP status code
            $statusLine = $http_response_header[0] ?? '';
            if (preg_match('/^HTTP\/\S+\s+422\b/', $statusLine)) {
                throw ValidationException::withMessages(['pdf' =>
                    'This PDF exceeds OCR safety limits or cannot be processed. Use a smaller document or skip automatic extraction.']);
            }
            if (!str_contains($statusLine, '200')) {
                Log::warning('PaddleOCR: non-200 response: ' . $statusLine);
                return [''];
            }

            $json = json_decode($raw, true);
            if (!is_array($json) || ($json['type'] ?? '') !== 'pdf') {
                Log::warning('PaddleOCR: unexpected response format.');
                return [''];
            }

            // Map {page: N, text: "..."} → 0-indexed string array
            $pages = [];
            foreach (array_slice($json['pages'] ?? [], 0, PdfMetadataSampler::MAX_PAGES) as $pageObj) {
                $pages[] = (string) ($pageObj['text'] ?? '');
            }

            if (empty($pages)) {
                return [''];
            }

            Log::info('PaddleOCR: extracted ' . count($pages) . ' page(s) from ' . basename($filePath));
            return $pages;

        } catch (ValidationException $e) {
            // A parser or resource rejection must never select another renderer.
            throw $e;
        } catch (\Throwable $e) {
            Log::warning('PaddleOCR: exception — ' . $e->getMessage());
            return [''];
        }
    }

    /**
     * Legacy OCR pipeline: Ghostscript renders PDF pages to PNG,
     * then Tesseract reads each image.
     * Used as a fallback when the PaddleOCR service is unavailable.
     *
     * @return string[]
     */
    protected function extractPagesViaTesseract(string $filePath): array
    {
        $gs = $this->findBinary(self::GS_PATHS, 'Ghostscript');
        $tess = $this->findBinary(self::TESS_PATHS, 'Tesseract');
        return $gs && $tess ? app(BoundedPdfOcr::class)->extract($gs, $tess, $filePath, 6, PdfMetadataSampler::MAX_PAGES) : [''];
    }

    /**
     * Find a binary from a list of candidate paths.
     * Returns the first working path, or null.
     */
    private function findBinary(array $candidates, string $label): ?string
    {
        // Also search for any Ghostscript version dynamically
        if ($label === 'Ghostscript') {
            foreach (glob('C:\\Program Files\\gs\\gs*\\bin\\gswin64c.exe') ?: [] as $p) {
                $candidates[] = $p;
            }
            foreach (glob('C:\\Program Files\\gs\\gs*\\bin\\gswin32c.exe') ?: [] as $p) {
                $candidates[] = $p;
            }
        }

        foreach ($candidates as $bin) {
            $exists = (str_contains($bin, DIRECTORY_SEPARATOR) || str_contains($bin, '/'))
                ? file_exists($bin)
                : $this->onPath($bin);

            if ($exists) {
                return $bin;
            }
        }

        Log::warning("OCR: {$label} binary not found. Install it to enable OCR for scanned PDFs.");
        return null;
    }

    private function onPath(string $bin): bool
    {
        $cmd = PHP_OS_FAMILY === 'Windows' ? 'where '.escapeshellarg($bin) : 'command -v '.escapeshellarg($bin);
        exec($cmd . ' 2>&1', $out, $code);
        return $code === 0;
    }

    /**
     * Extract text per page from the PDF using Smalot PDF Parser.
     * Each page has its header and footer zones stripped.
     *
     * @return string[] Array of text strings indexed by page number (0-based).
     */
    protected function extractPages(string $filePath): array
    {
        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($filePath);
            $pages = [];

            foreach ($pdf->getPages() as $page) {
                $rawText = $page->getText();
                $cleaned = $this->trimHeaderFooterLines($rawText);
                $cleaned = $this->stripPatternNoise($cleaned);
                $pages[] = $cleaned;
            }

            return $pages;
        } catch (\Exception $e) {
            Log::warning('PDF text extraction failed: ' . $e->getMessage());
            return [''];
        }
    }

    /**
     * Trim the top N and bottom N lines from page text to remove
     * header (~1.25 cm from top) and footer (~1.25 cm from bottom) zones.
     */
    protected function trimHeaderFooterLines(string $text, bool $isOcr = false): string
    {
        $lines = explode("\n", $text);
        $total = count($lines);

        if ($total <= ($this->headerLinesToTrim + $this->footerLinesToTrim + 2)) {
            return $text;
        }

        $lines = array_slice($lines, $this->headerLinesToTrim, $total - $this->headerLinesToTrim - $this->footerLinesToTrim);

        // For OCR text, also strip lines that are clearly page numbers / running headers
        if ($isOcr) {
            $lines = array_values(array_filter($lines, function (string $line): bool {
                $t = trim($line);
                if (preg_match('/^\d{1,3}$/', $t))       return false; // page number
                if (preg_match('/^-\s*\d{1,3}\s*-$/', $t)) return false; // "- 1 -"
                if (preg_match('/^page\s+\d+$/i', $t))   return false; // "Page 1"
                return true;
            }));
        }

        return implode("\n", $lines);
    }

    /**
     * Remove known header/footer text patterns from page content.
     */
    protected function stripPatternNoise(string $text): string
    {
        foreach ($this->stripPatterns as $pattern) {
            $text = preg_replace($pattern, '', $text);
        }
        return $text;
    }

    // ─────────────────────────────────────────────────────────────────────────
    //  OCR TEXT NORMALISATION
    // ─────────────────────────────────────────────────────────────────────────

    /** Preserve recognized wording; only normalize whitespace and line wrapping. */
    protected function normalizeOcrText(string $text): string
    {
        return $this->normalizeWhitespace($text);
    }


    // ──────────────────────────────────────────────────────────
    //  TITLE — text before "A Capstone Project Presented to…"
    // ──────────────────────────────────────────────────────────

    /**
     * Extract the title from the first page.
     *
     * Rule: The title is the text that appears BEFORE the phrase
     * "A Capstone Project Presented to the Faculty of..."
     */
    protected function extractTitle(string $firstPage, string $fullText = ''): string
    {
        $skipRe = '/^(republic|mindoro|bongabong|college|department|bachelor'
            . '|a\s+capstone|presented|submitted|in\s+partial|prepared\s+by'
            . '|this\s+capstone|approved|\d{1,3}$)/i';

        // ── Strategy 1: text before primary anchor ────────────────────────
        if (preg_match('/^(.*?)(?=A\s+Capstone\s+Project\s+Presented\s+to)/is', $firstPage, $m)) {
            $t = $this->cleanText($m[1]);
            if (strlen($t) > 5) return $t;
        }

        // ── Strategy 2: alternative anchor phrases ────────────────────────
        $anchors = [
            '/^(.*?)(?=In\s+Partial\s+Fulfillment)/is',
            '/^(.*?)(?=Submitted\s+to\s+the)/is',
            '/^(.*?)(?=Presented\s+to\s+the\s+Faculty)/is',
            '/^(.*?)(?=Prepared\s+by\s*:?\s*$)/im',
        ];
        foreach ($anchors as $anchor) {
            if (preg_match($anchor, $firstPage, $m)) {
                $t = $this->cleanText($m[1]);
                if (strlen($t) > 5 && strlen($t) < 450) return $t;
            }
        }

        // ── Strategy 3: longest consecutive ALL-CAPS / Title-Case block ────
        $lines     = array_values(array_filter(array_map('trim', explode("\n", $firstPage)), fn($l) => strlen($l) > 5));
        $candidate = '';
        $block     = [];
        foreach ($lines as $line) {
            if (preg_match($skipRe, $line)) {
                if (strlen(implode(' ', $block)) > strlen($candidate)) $candidate = implode(' ', $block);
                $block = [];
                continue;
            }
            if (strlen($line) >= 10 && (strtoupper($line) === $line || preg_match('/^[A-Z][a-z]/', $line))) {
                $block[] = $line;
            } else {
                if (strlen(implode(' ', $block)) > strlen($candidate)) $candidate = implode(' ', $block);
                $block = [];
            }
        }
        if (!empty($block) && strlen(implode(' ', $block)) > strlen($candidate)) $candidate = implode(' ', $block);
        if (strlen($candidate) > 10 && strlen($candidate) < 500) return $this->cleanText($candidate);

        // ── Strategy 4: first non-boilerplate line ────────────────────────
        foreach ($lines as $line) {
            if (preg_match($skipRe, $line)) continue;
            if (strlen($line) > 10 && strlen($line) < 350) return $this->cleanText($line);
        }

        return 'Untitled';
    }

    // ──────────────────────────────────────────────────────────
    //  AUTHORS — 3-4 lines after "Prepared by:"
    // ──────────────────────────────────────────────────────────

    /**
     * Extract author names from the first page.
     *
     * Rule: Extract the 3–4 lines immediately after "Prepared by:"
     * and before the date/year section.
     */
    protected function extractAuthor(string $firstPage, string $fullText = ''): string
    {
        $stopRe = '/^(January|February|March|April|May|June|July|August'
            . '|September|October|November|December|a\s+capstone|presented'
            . '|submitted|adviser|panelist|approved|department|college'
            . '|university|mindoro|bongabong|republic|in\s+partial|this\s+capstone)/i';

        // Anchor labels that precede author lists
        $anchors = [
            '/^Prepared\s+by\s*:?\s*(.*)$/i',
            '/^Submitted\s+by\s*:?\s*(.*)$/i',
            '/^Researchers?\s*:?\s*(.*)$/i',
            '/^Proponents?\s*:?\s*(.*)$/i',
            '/^Authors?\s*:?\s*(.*)$/i',
            '/^By\s*:?\s*(.*)$/i',
        ];

        // Search first page, then full document
        foreach ([$firstPage, $fullText] as $src) {
            if (empty(trim($src))) continue;
            $lines = explode("\n", $src);
            foreach ($lines as $idx => $line) {
                $trimmed = trim($line);
                $inline  = '';
                $hit     = false;
                foreach ($anchors as $anchor) {
                    if (preg_match($anchor, $trimmed, $m)) {
                        $hit    = true;
                        $inline = trim($m[1] ?? '');
                        break;
                    }
                }
                if (!$hit) continue;

                $authors = [];
                if (!empty($inline) && !preg_match('/^\d{4}$/', $inline) && strlen($inline) > 2) {
                    $authors[] = $inline;
                }
                for ($j = $idx + 1; $j < min($idx + 8, count($lines)); $j++) {
                    $next = trim($lines[$j]);
                    if (empty($next) || strlen($next) < 3)             continue;
                    if (preg_match('/^\d{4}$/', $next))                 break;
                    if (preg_match('/\b20[0-9]{2}\b/', $next) && strlen($next) < 20) break;
                    if (preg_match($stopRe, $next))                     break;
                    if (count($authors) >= 5)                           break;
                    if (preg_match('/^[A-Za-z\.\,\s\-\']+$/', $next) && strlen($next) < 100) {
                        $authors[] = $next;
                    }
                }
                if (!empty($authors)) {
                    return $this->cleanText(implode(', ', $authors));
                }
            }
        }

        // Name-block heuristic: two or more consecutive "Name"-looking lines
        $nameRe = '/^[A-Z][a-z]+(?:[\s,\.][A-Za-z]+){1,5}$/';
        $lines   = explode("\n", $firstPage);
        $block   = [];
        $prevName = false;
        foreach ($lines as $line) {
            $t = trim($line);
            if (preg_match($nameRe, $t) && strlen($t) < 80) {
                $block[] = $t;
                $prevName = true;
            } else {
                if ($prevName && count($block) >= 2) {
                    return $this->cleanText(implode(', ', array_slice($block, 0, 5)));
                }
                $block = [];
                $prevName = false;
            }
        }
        if (count($block) >= 2) {
            return $this->cleanText(implode(', ', array_slice($block, 0, 5)));
        }

        return 'Unknown Author';
    }

    // ──────────────────────────────────────────────────────────
    //  YEAR — last line of the first page (before footer)
    // ──────────────────────────────────────────────────────────

    /**
     * Extract year from the first page.
     *
     * Rule: Extract the year from the last line of the first page,
     * located right before the footer.
     */
    protected function extractYear(string $firstPage): ?int
    {
        $lines = array_filter(
            array_map('trim', explode("\n", $firstPage)),
            fn($line) => strlen($line) > 0
        );
        $lines = array_values($lines);

        // Scan from the bottom of page 1 upward looking for a year
        for ($i = count($lines) - 1; $i >= 0; $i--) {
            if (preg_match('/\b(20[0-9]{2})\b/', $lines[$i], $m)) {
                return (int) $m[1];
            }
        }

        return null;
    }

    // ──────────────────────────────────────────────────────────
    //  PROGRAM — BSIT or BSCpE detection
    // ──────────────────────────────────────────────────────────

    /**
     * Extract program (BSIT or BSCpE).
     */
    protected function extractProgram(string $text): ?string
    {
        if (preg_match('/\b(BS\s*IT|B\.?S\.?\s*I\.?T\.?|Bachelor\s+of\s+Science\s+in\s+Information\s+Technology)/i', $text)) {
            return 'BSIT';
        }
        if (preg_match('/\b(BS\s*CpE|B\.?S\.?\s*Cp\.?E\.?|Bachelor\s+of\s+Science\s+in\s+Computer\s+Engineering)/i', $text)) {
            return 'BSCpE';
        }
        return null;
    }

    // ──────────────────────────────────────────────────────────
    //  ABSTRACT — text between "EXECUTIVE SUMMARY" and "TABLE OF CONTENTS"
    // ──────────────────────────────────────────────────────────

    /**
     * Extract abstract section.
     *
     * Rule: The abstract starts on the line AFTER the "Executive Summary"
     * heading and ends on the last line before "Table of Contents" or
     * "Acknowledgement / Acknowledgment". All comparisons are case-insensitive.
     *
     * The heading line itself may carry trailing content (e.g. a page number
     * stamped by the PDF renderer). We skip everything on that line with
     * `[^\n]*\n` and only capture text beginning on the next line.
     */
    protected function extractAbstract(string $text): ?string
    {
        // End-section markers — covers both ACKNOWLEDGEMENT and ACKNOWLEDGMENT.
        $endRe = 'TABLE\s+OF\s+CONTENTS'
               . '|ACKNOWLEDGEMENTS?'
               . '|CHAPTER\s+[I1V]'
               . '|LIST\s+OF'
               . '|KEYWORDS?[\t ]*:';

        // ── Strategy 1: EXECUTIVE SUMMARY … end marker ────────────────────
        // `[^\n]*\n` skips any trailing text on the heading line so we only
        // capture content starting on the following line.
        if (preg_match('/^\s*EXECUTIVE\s+SUMMARY[^\n]*\n(.*?)(?=^[\t ]*(?:' . $endRe . ')|\z)/ims', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 50) return substr($a, 0, 5000);
        }

        // ── Strategy 2: ABSTRACT … end marker ─────────────────────────────
        if (preg_match('/^\s*ABSTRACT\b[^\n]*\n(.*?)(?=^[\t ]*(?:' . $endRe . ')|\z)/ims', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 50) return substr($a, 0, 5000);
        }

        // ── Strategy 3: SUMMARY alone … end marker ────────────────────────
        if (preg_match('/^\s*SUMMARY\b[^\n]*\n(.*?)(?=^[\t ]*(?:' . $endRe . ')|\z)/ims', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 50) return substr($a, 0, 5000);
        }

        return null;
    }

    /**
     * Clean a raw abstract block: strip noise lines (headings, page numbers)
     * and normalise whitespace, while preserving paragraph breaks.
     *
     * Paragraph breaks (one or more blank lines) are replaced with a sentinel
     * before calling cleanText() (which collapses all whitespace) and then
     * restored as "\n\n" so the final abstract retains readable paragraphs.
     */
    private function cleanAbstractText(string $text): string
    {
        // 1. Normalise all line endings
        $text = str_replace("\r\n", "\n", $text);
        $text = str_replace("\r",   "\n", $text);

        // 2. Collapse 3+ blank lines to 2 (max one blank line between paragraphs)
        $text = preg_replace('/\n{3,}/', "\n\n", $text);

        // 3. Replace every blank-line paragraph break with a safe sentinel
        //    so it survives the whitespace-collapsing cleanText() call.
        $sentinel = '§§PARA§§';
        $text = preg_replace('/\n\n+/', $sentinel, $text);

        // 4. Filter individual lines — remove page numbers and all-caps headings
        $lines    = explode("\n", $text);
        $filtered = [];
        foreach ($lines as $line) {
            $t = trim($line);
            // Drop standalone page numbers (1-3 digits only)
            if (preg_match('/^\s*\d{1,3}\s*$/', $t)) continue;
            // Drop all-caps section heading lines (≤4 words, no lowercase)
            if (preg_match('/^[A-Z\s]{3,60}$/', $t) && str_word_count($t) <= 4) continue;
            $filtered[] = $line;
        }

        // 5. Collapse within-paragraph whitespace via cleanText(), which
        //    replaces any \s+ (including \n within a paragraph) with a
        //    single space — the sentinel keeps paragraph splits intact.
        $cleaned = $this->cleanText(implode("\n", $filtered));

        // 6. Restore paragraph breaks
        $cleaned = str_replace($sentinel, "\n\n", $cleaned);

        return trim($cleaned);
    }

    // ──────────────────────────────────────────────────────────
    //  EXPLICIT PDF KEYWORDS
    // ──────────────────────────────────────────────────────────

    /**
     * Extract keywords from the document.
     */
    protected function extractKeywords(string $text): array
    {
        $keywords = [];

        // ── Explicit keyword section (multiple label variants) ─────────────
        $kwPatterns = [
            // Multi-line block after a keyword heading
            '/\bkey\s*words?\s*:?\s*[\r\n]+(.*?)(?:[\r\n]{2,}|\b(?:chapter|introduction|abstract|table\s+of\s+contents|acknowledgment)\b)/is',
            '/\bindex\s+terms?\s*:?\s*[\r\n]+(.*?)(?:[\r\n]{2,}|\b(?:chapter|introduction)\b)/is',
            // Inline  "Keywords: a, b, c"  on one line
            '/\bkey\s*words?\s*[:—–]\s*(.{5,300}?)(?:[\r\n]|$)/i',
        ];
        foreach ($kwPatterns as $pattern) {
            if (preg_match($pattern, $text, $m)) {
                $raw   = trim($m[1]);
                $parts = preg_split('/[,;|\n]/', $raw);
                foreach ($parts as $part) {
                    $part = trim(preg_replace('/[\r\n]+/', ' ', $part));
                    if (strlen($part) > 2 && strlen($part) < 60) {
                        $keywords[] = $this->cleanText($part);
                    }
                }
                if (!empty($keywords)) break;
            }
        }


        // Deduplicate, strip noise, limit to 15
        $seen  = [];
        $clean = [];
        foreach ($keywords as $kw) {
            $lower = mb_strtolower(trim($kw));
            if (strlen($lower) < 3 || isset($seen[$lower])) continue;
            if (preg_match('/^[\d\W]+$/', $lower))           continue;
            $seen[$lower] = true;
            $clean[] = $lower;
        }
        return array_slice(array_values($clean), 0, 15);
    }

    /**
     * Extract per-author contact details (email + phone) from the PDF.
     *
     * Strategy:
     *  1. Isolate the section of the document that starts at "APPENDIX N",
     *     "Curriculum Vitae", or similar headings.
     *  2. Split the author field by comma to get individual names.
     *  3. For each author, find the nearest email and phone in the CV block
     *     within a window of 200 lines after the author's name appears.
     *  4. If a field cannot be found, leave it as an empty string.
     *
     * @param  string $fullText    Full extracted PDF text
     * @param  string $authorField Comma-separated author string from extract()
     * @return array<int,array{name:string,email:string,contact:string}>
     */
    public function extractAuthorDetails(string $fullText, string $authorField): array
    {
        // Parse individual author names from the comma-separated field
        $names = array_values(array_filter(
            array_map('trim', explode(',', $authorField)),
            fn($n) => strlen($n) > 1 && strtolower($n) !== 'unknown author'
        ));

        if (empty($names)) {
            return [];
        }

        // Email regex
        $emailRe = '/[\w.+\-]+@[\w\-]+(?:\.[\w\-]+)+/';
        // Philippine phone regex: 09XXXXXXXXX, +639XXXXXXXXX, (0XX) XXX XXXX variants
        $phoneRe = '/(?:\+?63|0)9\d{9}|(?:\(0\d{2,3}\)\s*\d{3,4}[\-\s]?\d{4})|09\d{2}[\-\s]?\d{3}[\-\s]?\d{4}/';

        // Isolate the CV/Appendix section — everything after the first match
        $cvSectionPatterns = [
            '/APPENDIX\s+N[\s\S]/i',
            '/APPENDIX\s+[A-Z]\s*[:\-]?\s*(?:Curriculum|CV|Vitae)/i',
            '/Curriculum\s+Vitae/i',
            '/ABOUT\s+THE\s+(?:AUTHORS?|RESEARCHERS?|PROPONENTS?)/i',
        ];

        $cvText = '';
        foreach ($cvSectionPatterns as $pattern) {
            if (preg_match($pattern, $fullText, $m, PREG_OFFSET_CAPTURE)) {
                $cvText = substr($fullText, $m[0][1]);
                break;
            }
        }

        // If no dedicated CV section found, use the last 30% of the document
        if (empty($cvText)) {
            $cvText = substr($fullText, (int)(strlen($fullText) * 0.70));
        }

        $cvLines = explode("\n", $cvText);
        $results = [];

        foreach ($names as $name) {
            $email   = '';
            $contact = '';

            // Find the line where this author's name appears in the CV section
            $nameParts    = array_filter(array_map('trim', preg_split('/\s+/', strtolower($name))));
            $authorLineIdx = null;

            foreach ($cvLines as $idx => $line) {
                $lowerLine = strtolower($line);
                // Match if at least 2 name parts appear on the same line
                $hits = 0;
                foreach ($nameParts as $part) {
                    if (strlen($part) > 2 && str_contains($lowerLine, $part)) {
                        $hits++;
                    }
                }
                if ($hits >= min(2, count($nameParts))) {
                    $authorLineIdx = $idx;

                    // Also check if email/phone is on the same line
                    if (preg_match($emailRe, $line, $em)) {
                        $email = $em[0];
                    }
                    if (preg_match($phoneRe, $line, $pm)) {
                        $contact = preg_replace('/[^0-9+]/', '', $pm[0]);
                        // Normalise to 09XXXXXXXXX format
                        if (str_starts_with($contact, '639')) {
                            $contact = '0' . substr($contact, 2);
                        } elseif (str_starts_with($contact, '+639')) {
                            $contact = '0' . substr($contact, 3);
                        }
                    }
                    break;
                }
            }

            // Scan the next 200 lines after the author's name for email / phone
            if ($authorLineIdx !== null && (empty($email) || empty($contact))) {
                $window = array_slice($cvLines, $authorLineIdx + 1, 200);
                foreach ($window as $wLine) {
                    $lowerWLine = strtolower($wLine);

                    // Stop if we hit another author's name block
                    $hitOtherAuthor = false;
                    foreach ($names as $otherName) {
                        if ($otherName === $name) continue;
                        $otherParts = array_filter(array_map('trim', preg_split('/\s+/', strtolower($otherName))));
                        $otherHits  = 0;
                        foreach ($otherParts as $op) {
                            if (strlen($op) > 2 && str_contains($lowerWLine, $op)) $otherHits++;
                        }
                        if ($otherHits >= min(2, count($otherParts))) {
                            $hitOtherAuthor = true;
                            break;
                        }
                    }
                    if ($hitOtherAuthor) break;

                    if (empty($email) && preg_match($emailRe, $wLine, $em)) {
                        $email = $em[0];
                    }
                    if (empty($contact) && preg_match($phoneRe, $wLine, $pm)) {
                        $raw = preg_replace('/[^0-9+]/', '', $pm[0]);
                        if (str_starts_with($raw, '639'))  $raw = '0' . substr($raw, 2);
                        if (str_starts_with($raw, '+639')) $raw = '0' . substr($raw, 3);
                        $contact = $raw;
                    }

                    if (!empty($email) && !empty($contact)) break;
                }
            }

            $results[] = [
                'name'    => $name,
                'email'   => $email,
                'contact' => $contact,
            ];
        }

        return $results;
    }

    /**
     * Clean extracted text by removing unnecessary spacing,
     * repeated headers/footers, and formatting artifacts.
     */
    protected function cleanText(string $text): string
    {
        // Strip known patterns one more time
        foreach ($this->stripPatterns as $pattern) {
            $text = preg_replace($pattern, '', $text);
        }

        // Remove excess whitespace
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }
}
