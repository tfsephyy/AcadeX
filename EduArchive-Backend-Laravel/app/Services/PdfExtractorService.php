<?php

namespace App\Services;

use App\Services\Extraction\{AdviserExtractor, DocumentPage, FullPdfTextReader, HeaderFooterCleaner, KeywordExtractor, MetadataDocument, MetadataPipeline, PdfPageReader};
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;
use Symfony\Component\Process\ExecutableFinder;

/** PDF I/O and bounded traditional OCR. Metadata rules live in Extraction/. */
class PdfExtractorService
{
    private array $front = [];
    private array $tail = [];
    private array $all = [];
    private bool $keywordComplete = false;
    private float $ocrDeadline = 0;

    public static function maxAutomaticBytes(): int
    {
        return max(0, min(20 * 1024 * 1024, (int) config('acadex.max_automatic_extraction_bytes', 20 * 1024 * 1024)));
    }

    public static function emptyMetadata(): array
    {
        return ['title' => null, 'year' => null, 'author' => null, 'author_details' => [],
            'program' => 'BSIT', 'abstract' => null, 'keywords' => [], 'adviser_name' => null];
    }

    public function extract(UploadedFile $file): array { return $this->extractWithSource($file)['metadata']; }
    public function extractFromPath(string $path): array { return $this->extractPathWithSource($path)['metadata']; }
    public function extractWithSource(UploadedFile $file): array { return $this->extractPathWithSource($file->getRealPath()); }

    public function extractPathWithSource(string $path): array
    {
        $this->all = [];
        $this->keywordComplete = false;
        try {
            $result = $this->extractMetadataWithSource($path);
        } catch (\RuntimeException $error) {
            // A missing large-file front-matter sampler must not prevent the
            // independent full-document text pass from suggesting keywords.
            Log::warning('Metadata sample unavailable.', ['type' => get_class($error)]);
            $result = ['metadata' => self::emptyMetadata(), 'source' => '', 'scope' => 'unavailable',
                'notes' => ['Automatic front-matter extraction is unavailable. Enter missing details manually.']];
        }
        if (self::maxAutomaticBytes() < 1) return $result;
        try {
            if (filesize($path) > self::maxAutomaticBytes()) {
                $read = app(FullPdfTextReader::class)->read($path);
                $this->all = $read['pages'];
                $this->keywordComplete = $read['complete'];
            }
            // Reuse recognized front/tail pages; OCR unreadable middle pages in
            // sequence under the same deadline, without repeatedly counting them.
            $pages = [];
            foreach ($this->all as $page) $pages[$page->number] = $page;
            foreach (array_merge($this->front, $this->tail) as $page) {
                if (isset($pages[$page->number])) $pages[$page->number] = $page;
            }
            $cleaner = app(HeaderFooterCleaner::class);
            $cleaned = $cleaner->clean(new MetadataDocument(array_values($pages)));
            foreach ($cleaned->pages as $page) {
                if (trim($page->text()) !== '') continue;
                if (microtime(true) >= $this->ocrDeadline) { $this->keywordComplete = false; break; }
                $ocr = $this->nativeOcr($path, $page->number, 1);
                if (trim($ocr[0] ?? '') === '') { $this->keywordComplete = false; continue; }
                $pages[$page->number] = DocumentPage::fromText($ocr[0], $page->number);
            }
            if ($pages) {
                $document = $cleaner->clean(new MetadataDocument(array_values($pages)));
                $result['metadata']['keywords'] = app(KeywordExtractor::class)->extract($document,
                    $result['metadata']['title'], $result['metadata']['abstract']);
                $result['notes'] = array_values(array_filter($result['notes'] ?? [], fn ($note) => $note !== 'Review keywords: no reliable value was found.'));
            }
            $result['notes'][] = $this->keywordComplete && $pages
                ? 'Keywords were ranked by frequency across the whole PDF ('.count($pages).' pages).'
                : 'Full-PDF keyword reading was incomplete. Suggestions use the readable pages; review or add keywords manually.';
        } catch (\Throwable $error) {
            Log::warning('Full-PDF keyword reading unavailable.', ['type' => get_class($error)]);
            $result['notes'][] = 'Full-PDF keyword reading was unavailable. Review or add keywords manually.';
        }
        return $result;
    }

    private function extractMetadataWithSource(string $path): array
    {
        $this->front = $this->tail = [];
        $this->ocrDeadline = microtime(true) + 90;
        clearstatcache(true, $path);
        if (!is_readable($path) || !is_file($path)) $this->invalidPdf();
        $handle = fopen($path, 'rb');
        try { $signature = fread($handle, 1024); } finally { fclose($handle); }
        if (!str_contains($signature, '%PDF-')) $this->invalidPdf();
        if (filesize($path) > self::maxAutomaticBytes()) {
            if (self::maxAutomaticBytes() < 1) return ['metadata' => self::emptyMetadata(), 'source' => '', 'scope' => 'unavailable'];
            $sample = app(PdfMetadataSampler::class)->create(new UploadedFile($path, 'source.pdf', 'application/pdf', null, true));
            try {
                $result = $this->extractMetadataWithSource($sample);
                $result['scope'] = 'first_12_pages';
                $tailSample = null;
                $tailAvailable = false;
                try {
                    $tailSample = app(PdfMetadataSampler::class)->createTail(new UploadedFile($path, 'source.pdf', 'application/pdf', null, true));
                    if ($tailSample) {
                        $tail = app(PdfPageReader::class)->read($tailSample['path'])['front'];
                        if ($this->blank($tail) && microtime(true) < $this->ocrDeadline) {
                            $texts = $this->nativeOcr($tailSample['path'], 1, count($tail));
                            if (trim(implode('', $texts)) !== '') $tail = MetadataDocument::fromTexts($texts)->pages;
                        }
                        $tail = array_map(fn ($page) => new DocumentPage($page->number + $tailSample['first'] - 1,
                            $page->rawText, $page->lines, $page->height), $tail);
                        $result = app(MetadataPipeline::class)->extract(new MetadataDocument(array_merge($this->front, $tail)));
                        $result['scope'] = 'first_12_pages';
                        $result['notes'][] = 'Metadata uses the first 12 pages; CV contacts were checked in the last 12 pages.';
                        $tailAvailable = true;
                    }
                } catch (\Throwable $error) {
                    Log::warning('CV sample unavailable.', ['type' => get_class($error)]);
                } finally { if ($tailSample) @unlink($tailSample['path']); }
                if (!$tailAvailable) $result['notes'][] = 'Large-document CV sampling is unavailable. Review contact details manually.';
                return $result;
            } finally { @unlink($sample); }
        }

        $raw = $this->extractRawPages($path);
        $front = $this->front ?: MetadataDocument::fromTexts($raw)->pages;
        if ($this->sparse($front)) {
            $ocr = $this->extractPagesViaOcr($path);
            if (trim(implode('', $ocr)) !== '') $front = MetadataDocument::fromTexts($ocr)->pages;
        }
        if ($this->tail && $this->blank($this->tail) && microtime(true) < $this->ocrDeadline) {
            $first = $this->tail[0]->number;
            $ocr = $this->nativeOcr($path, $first, count($this->tail));
            if (trim(implode('', $ocr)) !== '') {
                $this->tail = array_map(fn ($text, $index) => DocumentPage::fromText($text, $first + $index), $ocr, array_keys($ocr));
            }
        }
        $this->front = $front;
        $result = app(MetadataPipeline::class)->extract(new MetadataDocument(array_merge($front, $this->tail)));
        $result['scope'] = count($front) >= PdfMetadataSampler::MAX_PAGES ? 'first_12_pages' : 'full_document';
        if ($this->tail) $result['notes'][] = 'CV contacts were checked in the last 12 pages. Verify missing contacts against the original PDF.';
        return $result;
    }

    protected function extractRawPages(string $path): array
    {
        try {
            $read = app(PdfPageReader::class)->read($path);
            $this->front = $read['front'];
            $this->tail = $read['tail'];
            $this->all = $read['all'];
            $this->keywordComplete = $read['complete'];
            return array_map(fn ($page) => $page->rawText, $this->front);
        } catch (\Throwable $error) {
            Log::warning('PDF text reader unavailable.', ['type' => get_class($error)]);
            return [''];
        }
    }

    private function sparse(array $pages): bool
    {
        $cleaned = app(HeaderFooterCleaner::class)->clean(new MetadataDocument($pages));
        $lengths = array_map(fn ($page) => mb_strlen(trim($page->text())), $cleaned->pages);
        $total = array_sum($lengths);
        return $total / max(1, count($lengths)) < 80 && !($total >= 240 && max($lengths ?: [0]) >= 160);
    }

    private function blank(array $pages): bool
    {
        return trim(app(HeaderFooterCleaner::class)->clean(new MetadataDocument($pages))->text()) === '';
    }

    protected function extractPagesViaOcr(string $path): array
    {
        return $this->nativeOcr($path, 1, PdfMetadataSampler::MAX_PAGES);
    }

    private function nativeOcr(string $path, int $first, int $count): array
    {
        $finder = new ExecutableFinder();
        $gs = $finder->find('gs') ?: $finder->find('gswin64c');
        $tess = $finder->find('tesseract');
        if (PHP_OS_FAMILY === 'Windows') {
            $gs = $gs ?: (glob('C:/Program Files/gs/gs*/bin/gswin64c.exe')[0] ?? null);
            $tess = $tess ?: (is_file('C:/Program Files/Tesseract-OCR/tesseract.exe') ? 'C:/Program Files/Tesseract-OCR/tesseract.exe' : null);
        }
        return $gs && $tess ? app(BoundedPdfOcr::class)->extract($gs, $tess, $path, 6, $count, $first,
            max(0, $this->ocrDeadline - microtime(true))) : [''];
    }

    /** Compatibility entry point using the same cleanup and field service. */
    public function extractAdviserName(array $pages): ?string
    {
        return app(AdviserExtractor::class)->extract(app(HeaderFooterCleaner::class)->clean(MetadataDocument::fromTexts($pages)));
    }

    private function invalidPdf(): never
    {
        throw ValidationException::withMessages(['pdf' => 'The PDF could not be read. Review its details manually or upload a readable PDF.']);
    }
}
