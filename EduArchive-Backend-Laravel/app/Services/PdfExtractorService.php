<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

class PdfExtractorService
{
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
        '/Bongabong,?\s*Oriental\s+Mindoro\s*\d*\s*Philippines?/i',
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
        $filePath = $file->getRealPath();

        // Parse PDF — get raw pages (no trimming)
        $rawPages = $this->extractRawPages($filePath);
        $rawFirstPage = $rawPages[0] ?? '';

        // Detect scanned PDF: if average chars/page is too low, run OCR
        $totalChars = array_sum(array_map('mb_strlen', $rawPages));
        $pageCount  = max(1, count($rawPages));
        $avgChars   = $totalChars / $pageCount;
        $isOcr      = false;

        if ($avgChars < self::OCR_THRESHOLD) {
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

        // OCR normalisation: fix broken words, spaced capitals, and common
        // character-substitution artifacts BEFORE any regex runs.
        if ($isOcr) {
            $rawPages     = array_map([$this, 'normalizeOcrText'], $rawPages);
            $rawFirstPage = $rawPages[0] ?? '';
        }

        // Clean pages (header/footer trimmed) for title, author, abstract, etc.
        $pages = array_map(function ($rawText) use ($isOcr) {
            $cleaned = $this->trimHeaderFooterLines($rawText, $isOcr);
            return $this->stripPatternNoise($cleaned);
        }, $rawPages);

        $firstPageText = $pages[0] ?? '';
        $fullText      = implode("\n", $pages);

        $abstract = $this->extractAbstract($fullText);
        if ($abstract) {
            $abstract = $this->autoCorrectText($abstract);
        }

        $authorField   = $this->extractAuthor($firstPageText, $fullText);
        $authorDetails = $this->extractAuthorDetails($fullText, $authorField);

        return [
            'title'          => $this->extractTitle($firstPageText, $fullText),
            'year'           => $this->extractYear($rawFirstPage),
            'author'         => $authorField,
            'author_details' => $authorDetails,
            'program'        => $this->extractProgram($fullText),
            'abstract'       => $abstract,
            'keywords'       => $this->extractKeywords($fullText),
        ];
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

            foreach ($pdf->getPages() as $page) {
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
        $serviceUrl = rtrim(env('OCR_SERVICE_URL', 'http://localhost:8001'), '/') . '/api/ocr';

        try {
            // Prepare multipart/form-data POST with the PDF file
            $boundary = '----EduArchiveBoundary' . bin2hex(random_bytes(8));
            $fileName = basename($filePath);
            $fileContent = file_get_contents($filePath);

            if ($fileContent === false) {
                Log::warning('PaddleOCR: could not read file: ' . $filePath);
                return [''];
            }

            // Build multipart body manually (no Guzzle dependency needed)
            $body  = "--{$boundary}\r\n";
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
            if (!str_contains($statusLine, '200')) {
                Log::warning('PaddleOCR: non-200 response: ' . $statusLine . ' — ' . substr($raw, 0, 200));
                return [''];
            }

            $json = json_decode($raw, true);
            if (!is_array($json) || ($json['type'] ?? '') !== 'pdf') {
                Log::warning('PaddleOCR: unexpected response format.');
                return [''];
            }

            // Map {page: N, text: "..."} → 0-indexed string array
            $pages = [];
            foreach ($json['pages'] ?? [] as $pageObj) {
                $pages[] = (string) ($pageObj['text'] ?? '');
            }

            if (empty($pages)) {
                return [''];
            }

            Log::info('PaddleOCR: extracted ' . count($pages) . ' page(s) from ' . basename($filePath));
            return $pages;

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
        $gs   = $this->findBinary(self::GS_PATHS, 'Ghostscript');
        $tess = $this->findBinary(self::TESS_PATHS, 'Tesseract');

        if (!$gs || !$tess) {
            return [''];
        }

        $tmpDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'eduocr_' . uniqid('', true);
        @mkdir($tmpDir, 0777, true);

        try {
            // Render PDF → PNG (300 DPI, one file per page)
            $outPattern = $tmpDir . DIRECTORY_SEPARATOR . 'page_%04d.png';
            $gsCmd = sprintf(
                '"%s" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r300 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="%s" "%s" 2>&1',
                $gs, $outPattern, $filePath
            );
            exec($gsCmd, $gsOut, $gsCode);

            if ($gsCode !== 0) {
                Log::warning('OCR: Ghostscript failed (code ' . $gsCode . '): ' . implode(' ', $gsOut));
                return [''];
            }

            $images = glob($tmpDir . DIRECTORY_SEPARATOR . 'page_*.png') ?: [];
            sort($images);

            if (empty($images)) {
                Log::warning('OCR: Ghostscript produced no images.');
                return [''];
            }

            $pages = [];
            foreach (array_slice($images, 0, 60) as $imgPath) {
                $outBase = $imgPath . '_ocr';
                $tessCmd = sprintf(
                    '"%s" "%s" "%s" -l eng --psm 6 2>&1',
                    $tess, $imgPath, $outBase
                );
                exec($tessCmd, $tessOut, $tessCode);

                $txtFile  = $outBase . '.txt';
                $pageText = '';
                if (file_exists($txtFile)) {
                    $pageText = trim(file_get_contents($txtFile));
                    @unlink($txtFile);
                }
                $pages[] = $pageText;
            }

            return $pages;

        } catch (\Throwable $e) {
            Log::error('OCR pipeline error: ' . $e->getMessage());
            return [''];
        } finally {
            foreach (glob($tmpDir . DIRECTORY_SEPARATOR . '*') ?: [] as $f) {
                @unlink($f);
            }
            @rmdir($tmpDir);
        }
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
        $cmd  = PHP_OS_FAMILY === 'Windows' ? "where \"{$bin}" : "which \"{$bin}\"";
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

    /**
     * Fix the most common OCR artifacts before any regex-based extraction runs.
     *
     * Fixes applied:
     *  1. Hyphenated line-break re-join  ("infor-\nmation" → "information")
     *  2. Spaced capital headings        ("E X E C U T I V E" → "EXECUTIVE")
     *  3. Broken single-letter prefix    ("P repared" → "Prepared")
     *  4. Digit→letter in word context   (0→o, 1→l)
     *  5. Collapse runs of 3+ blank lines to 2
     *  6. Collapse multiple spaces (preserve newlines)
     *  7. Key phrase normalisation so section anchors are always found
     */
    protected function normalizeOcrText(string $text): string
    {
        // 1. Re-join hyphenated line-breaks
        $text = preg_replace('/([a-zA-Z])-\n([a-zA-Z])/', '$1$2', $text);

        // 2. Spaced capital letters in headings ("E X E C U T I V E S U M M A R Y" → "EXECUTIVE SUMMARY")
        $text = preg_replace_callback('/\b([A-Z])(?:\s+([A-Z])){3,}\b/', function ($m) {
            return preg_replace('/\s+/', '', $m[0]);
        }, $text);

        // 3. Broken single-cap prefix ("P repared" → "Prepared")
        $text = preg_replace('/\b([A-Z])\s+([a-z]{2,})\b/', '$1$2', $text);

        // 4. Common digit→letter substitutions inside words
        $text = preg_replace('/([a-zA-Z])0([a-zA-Z])/', '${1}o${2}', $text);
        $text = preg_replace('/([a-zA-Z])1([a-zA-Z])/', '${1}l${2}', $text);

        // 5. Collapse 3+ blank lines to 2
        $text = preg_replace('/\n{3,}/', "\n\n", $text);

        // 6. Collapse multiple spaces
        $text = preg_replace('/[ \t]{2,}/', ' ', $text);

        // 7. Key phrase normalisation — ensures section anchors are always found
        $fixes = [
            '/exec\s*utive\s*summ?\s*ary/i'          => 'EXECUTIVE SUMMARY',
            '/table\s*of\s*cont\s*ents/i'             => 'TABLE OF CONTENTS',
            '/prep\s*ared\s*by/i'                     => 'Prepared by',
            '/subm\s*itted\s*by/i'                    => 'Submitted by',
            '/key\s*words?/i'                          => 'Keywords',
            '/acknowledg\s*[em]+ent/i'                => 'ACKNOWLEDGMENT',
            '/\bA\s+Cap\s*stone\s+Project/i'          => 'A Capstone Project',
            '/Presented\s+to\s+the\s+Fac\s*ulty/i'   => 'Presented to the Faculty',
            '/In\s+Partial\s+Ful\s*fill\s*ment/i'     => 'In Partial Fulfillment',
            '/B\s*S\s*I\s*T\b/'                       => 'BSIT',
            '/B\s*S\s*C\s*p\s*E\b/'                   => 'BSCpE',
            '/Bachelor\s+of\s+Sci\s*ence\s+in\s+Info\s*rmation\s+Tech/i' => 'Bachelor of Science in Information Technology',
        ];
        foreach ($fixes as $pattern => $replacement) {
            $text = preg_replace($pattern, $replacement, $text);
        }

        return $text;
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
               . '|KEYWORDS?';

        // ── Strategy 1: EXECUTIVE SUMMARY … end marker ────────────────────
        // `[^\n]*\n` skips any trailing text on the heading line so we only
        // capture content starting on the following line.
        if (preg_match('/EXECUTIVE\s+SUMMARY[^\n]*\n(.*?)(?=' . $endRe . ')/is', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 50) return substr($a, 0, 5000);
        }

        // ── Strategy 2: ABSTRACT … end marker ─────────────────────────────
        if (preg_match('/\bABSTRACT\b[^\n]*\n(.*?)(?=' . $endRe . ')/is', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 50) return substr($a, 0, 5000);
        }

        // ── Strategy 3: SUMMARY alone … end marker ────────────────────────
        if (preg_match('/\bSUMMARY\b[^\n]*\n(.*?)(?=' . $endRe . ')/is', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 50) return substr($a, 0, 5000);
        }

        // ── Strategy 4: first long paragraph starting with a study phrase ──
        if (preg_match('/(?:^|\n)((?:The\s+study|This\s+study|This\s+research'
            . '|This\s+capstone|This\s+project|The\s+research|The\s+project'
            . '|The\s+proponents?)[^\n]{80,}(?:\n[^\n]+){2,15})/i', $text, $m)) {
            $a = $this->cleanAbstractText($m[1]);
            if (strlen($a) > 80) return substr($a, 0, 5000);
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
    //  ABSTRACT AUTO-CORRECTION
    // ──────────────────────────────────────────────────────────

    /**
     * Auto-correct common PDF extraction artifacts in abstract text.
     *
     * Pass A – soft line-break mid-word rejoiner
     *   PDFs often break a word across a line without a hyphen. The parser
     *   concatenates both halves with a space ("caps tone", "solutio n",
     *   "sec ured"). We detect these by looking for a lowercase fragment
     *   preceded by a space where the combined string looks like one word.
     *
     * Pass B – space-before-hyphen compound fixer
     *   "time -consuming" → "time-consuming",  "A Cloud -Based" → "A Cloud-Based"
     *
     * Pass C – missing-space injection
     *   "Registrar'sOffice" → "Registrar's Office"  (lowercase → uppercase boundary)
     *   "aCloud"            → "a Cloud"              (article + uppercase word)
     *
     * Pass D – digit ↔ letter boundary spaces
     *   "of3.48" → "of 3.48",  "3.48it" → "3.48 it"
     *
     * Pass E – common spaced-letter OCR artifacts ("t h e" → "the", etc.)
     *
     * Paragraph breaks (\n\n) are preserved throughout all passes.
     */
    protected function autoCorrectText(string $text): string
    {
        // Protect paragraph breaks from being clobbered by single-line regexes.
        $paraSentinel = '§§PARA§§';
        $text = preg_replace('/\n\n+/', $paraSentinel, $text);

        // ── Pass A: rejoin mid-word line-break splits ─────────────────────────
        // Pattern: a run of ≥2 lowercase letters, then a space, then 1-4
        // lowercase letters that are NOT a standalone common word.
        // "caps tone" → "capstone",  "solutio n" → "solution"
        $commonWords = [
            'a','an','as','at','be','by','do','go','he','if','in','is','it',
            'me','my','no','of','on','or','so','to','up','us','we','and','are',
            'but','can','did','due','for','had','has','her','him','his','how',
            'its','let','may','not','now','old','our','out','own','say','see',
            'she','the','too','two','use','was','who','why','yet','you',
            'been','also','back','both','come','each','even','from','give',
            'have','here','into','just','know','like','make','many','more',
            'much','must','need','next','only','open','over','same','some',
            'such','than','that','them','then','they','this','time','used',
            'very','want','well','were','what','when','will','with','your',
        ];
        $text = preg_replace_callback(
            '/([a-z]{2,})\s+([a-z]{1,4})(?=[\s,\.;:\-]|$)/u',
            function ($m) use ($commonWords) {
                $fragment = $m[2];
                // Don't rejoin if the trailing part is itself a common word
                if (in_array($fragment, $commonWords, true)) {
                    return $m[0];
                }
                // Rejoin only if the combined word has a vowel (avoids garbled joins)
                $combined = $m[1] . $fragment;
                if (preg_match('/[aeiou]/i', $combined) && strlen($combined) >= 4) {
                    return $combined;
                }
                return $m[0];
            },
            $text
        );

        // ── Pass B: space before hyphen in compounds ──────────────────────────
        // "time -consuming" → "time-consuming"
        $text = preg_replace('/([a-zA-Z])\s+-\s*([a-zA-Z])/', '$1-$2', $text);

        // ── Pass C: missing space at lowercase→uppercase word boundary ────────
        // "Registrar'sOffice" → "Registrar's Office"
        // "aCloud"            → "a Cloud"
        // Only insert when the uppercase letter starts a ≥3-char sequence
        // (avoids splitting acronyms like "OCR", "PSA").
        $text = preg_replace_callback(
            '/([a-z\']{2,})([A-Z][a-z]{2,})/',
            function ($m) {
                return $m[1] . ' ' . $m[2];
            },
            $text
        );

        // ── Pass D: digit ↔ letter boundary spaces ───────────────────────────
        // "of3.48" → "of 3.48",  "3.48it" → "3.48 it"
        $text = preg_replace('/([a-zA-Z])(\d)/', '$1 $2', $text);
        $text = preg_replace('/(\d)([a-zA-Z])/', '$1 $2', $text);

        // ── Pass E: common OCR spaced-letter artifacts ────────────────────────
        $commonBrokenWords = [
            '/\bt h e\b/i'      => 'the',
            '/\bt o\b/i'        => 'to',
            '/\bo f\b/i'        => 'of',
            '/\bi n\b/i'        => 'in',
            '/\bi t\b/i'        => 'it',
            '/\bi s\b/i'        => 'is',
            '/\ba n d\b/i'      => 'and',
            '/\bf o r\b/i'      => 'for',
            '/\bw i t h\b/i'    => 'with',
            '/\bt h a t\b/i'    => 'that',
            '/\bt h i s\b/i'    => 'this',
            '/\bw h i c h\b/i'  => 'which',
            '/\bf r o m\b/i'    => 'from',
            '/\bh a v e\b/i'    => 'have',
            '/\bw e r e\b/i'    => 'were',
            '/\bb e e n\b/i'    => 'been',
            '/\bt h e i r\b/i'  => 'their',
            '/\ba r e\b/i'      => 'are',
            '/\bw a s\b/i'      => 'was',
            '/\bn o t\b/i'      => 'not',
            '/\bb u t\b/i'      => 'but',
            '/\ba l s o\b/i'    => 'also',
            '/\bm o r e\b/i'    => 'more',
            '/\bs u c h\b/i'    => 'such',
            '/\bw h e n\b/i'    => 'when',
            '/\bs o m e\b/i'    => 'some',
            '/\bt h e n\b/i'    => 'then',
            '/\bt h a n\b/i'    => 'than',
            '/\bo t h e r\b/i'  => 'other',
            '/\ba b o u t\b/i'  => 'about',
            '/\bc a n\b/i'      => 'can',
            '/\bw i l l\b/i'    => 'will',
            '/\be a c h\b/i'    => 'each',
            '/\bm a k e\b/i'    => 'make',
            '/\bl i k e\b/i'    => 'like',
            '/\bu s e d\b/i'    => 'used',
            '/\bu s e r\b/i'    => 'user',
            '/\bu s e r s\b/i'  => 'users',
            '/\bs y s t e m\b/i' => 'system',
            '/\bp r o j e c t\b/i' => 'project',
            '/\bd a t a\b/i'    => 'data',
            '/\bs t u d y\b/i'  => 'study',
            '/\br e s e a r c h\b/i' => 'research',
        ];
        foreach ($commonBrokenWords as $pattern => $replacement) {
            $text = preg_replace($pattern, $replacement, $text);
        }

        // ── Punctuation cleanup ───────────────────────────────────────────────
        // Multiple spaces → single space (within a paragraph line only)
        $text = preg_replace('/[ \t]{2,}/', ' ', $text);

        // Space before punctuation ("word ." → "word.")
        $text = preg_replace('/\s+([.,;:!?])/', '$1', $text);

        // Missing space after sentence-ending punctuation before next word
        $text = preg_replace('/([.!?])([A-Z][a-z])/', '$1 $2', $text);

        // Fix double periods / commas
        $text = preg_replace('/\.{2,}/', '.', $text);
        $text = preg_replace('/,{2,}/', ',', $text);

        // Capitalize first letter after sentence-ending punctuation + space
        $text = preg_replace_callback('/([.!?])\s+([a-z])/', function ($m) {
            return $m[1] . ' ' . strtoupper($m[2]);
        }, $text);

        // Restore paragraph breaks
        $text = str_replace($paraSentinel, "\n\n", $text);

        // Ensure first character is capitalized
        return ucfirst(trim($text));
    }

    /**
     * Simple heuristic to check if a string looks like a valid English word.
     * Uses common word patterns and minimum length checks.
     */
    protected function isLikelyWord(string $word): bool
    {
        $word = strtolower($word);

        // Very common English words
        $commonWords = [
            'the',
            'and',
            'for',
            'are',
            'but',
            'not',
            'you',
            'all',
            'can',
            'had',
            'her',
            'was',
            'one',
            'our',
            'out',
            'has',
            'his',
            'how',
            'its',
            'may',
            'new',
            'now',
            'old',
            'see',
            'way',
            'who',
            'did',
            'get',
            'let',
            'say',
            'she',
            'too',
            'use',
            'with',
            'this',
            'that',
            'from',
            'have',
            'been',
            'were',
            'they',
            'will',
            'each',
            'make',
            'like',
            'into',
            'over',
            'such',
            'than',
            'them',
            'then',
            'some',
            'when',
            'what',
            'also',
            'more',
            'about',
            'which',
            'their',
            'other',
            'there',
            'these',
            'could',
            'would',
            'should',
            'through',
            'system',
            'project',
            'data',
            'study',
            'research',
            'capstone',
            'university',
            'information',
            'technology',
            'development',
            'application',
            'user',
            'users',
            'used',
            'using',
            'based',
            'results',
        ];

        if (in_array($word, $commonWords)) {
            return true;
        }

        // Check word doesn't have unusual consonant clusters
        if (strlen($word) >= 3 && strlen($word) <= 15) {
            // Reject if too many consecutive consonants (5+)
            if (preg_match('/[bcdfghjklmnpqrstvwxyz]{5,}/i', $word)) {
                return false;
            }
            return true;
        }

        return false;
    }

    // ──────────────────────────────────────────────────────────
    //  KEYWORDS
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

        // ── Tech-term scanning ─────────────────────────────────────────────
        $keywords = array_merge($keywords, $this->extractTechTerms($text));

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
     * Extract technology-related terms.
     */
    protected function extractTechTerms(string $text): array
    {
        $techPatterns = [
            'machine learning',
            'deep learning',
            'artificial intelligence',
            'neural network',
            'web application',
            'mobile application',
            'database',
            'API',
            'REST',
            'PHP',
            'Laravel',
            'React',
            'Vue',
            'Angular',
            'Node.js',
            'Python',
            'Java',
            'JavaScript',
            'TypeScript',
            'C#',
            'Flutter',
            'Kotlin',
            'MySQL',
            'MongoDB',
            'PostgreSQL',
            'Firebase',
            'IoT',
            'blockchain',
            'cloud computing',
            'data mining',
            'image processing',
            'natural language processing',
            'NLP',
            'computer vision',
            'automation',
            'robotics',
            'QR code',
            'barcode',
            'RFID',
            'GPS',
            'e-commerce',
            'e-learning',
            'management system',
            'information system',
            'decision support',
            'expert system',
            'Android',
            'iOS',
            'Arduino',
            'Raspberry Pi',
            'PDF',
            'data extraction',
            'web scraping',
            'repository',
        ];

        $found = [];
        $lowerText = strtolower($text);
        foreach ($techPatterns as $term) {
            if (str_contains($lowerText, strtolower($term))) {
                $found[] = strtolower($term);
            }
        }

        return $found;
    }

    // ──────────────────────────────────────────────────────────
    //  AUTHOR DETAILS — Email & Contact from CV / Appendix N
    // ──────────────────────────────────────────────────────────

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
