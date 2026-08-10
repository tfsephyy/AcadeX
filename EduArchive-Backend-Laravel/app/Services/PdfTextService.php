<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * PdfTextService
 *
 * Extracts plain text from an encrypted capstone PDF stored on disk.
 *
 * Pipeline:
 *   1. Decrypt the encrypted PDF in-memory.
 *   2. Try smalot/pdfparser first (fast, works for text-based PDFs).
 *   3. If extracted text is too sparse (scanned PDF detected), fall back to
 *      OCR: Ghostscript converts pages → images, Tesseract reads the images.
 *   4. Clean up all temp files.
 *   5. Return the combined text for storage in the database.
 */
class PdfTextService
{
    /**
     * Minimum average characters per page to consider a PDF "text-based".
     * Below this threshold we assume the PDF is scanned and needs OCR.
     */
    private const MIN_CHARS_PER_PAGE = 80;

    /**
     * Maximum characters to store per capstone (protects DB column size).
     */
    private const MAX_CHARS = 50000;

    /**
     * Path to the Tesseract binary.
     */
    private const TESSERACT_BIN = 'C:\\Program Files\\Tesseract-OCR\\tesseract.exe';

    /**
     * Path to the Ghostscript binary (installed version).
     */
    private const GHOSTSCRIPT_BIN = 'C:\\Program Files\\gs\\gs10.07.1\\bin\\gswin64c.exe';

    // ─────────────────────────────────────────────────────────────────────────

    /**
     * Extract all text from an encrypted capstone PDF.
     *
     * @param  string  $encryptedPath  Storage-relative path (e.g. "capstones/abc.enc")
     * @return string|null             Extracted text, or null on failure
     */
    public function extractFromEncryptedPath(string $encryptedPath): ?string
    {
        // 1. Decrypt to raw bytes
        $encryptor = new PdfEncryptorService();
        $rawBytes  = $encryptor->decryptFromDisk($encryptedPath);

        if (empty($rawBytes)) {
            Log::warning("PdfTextService: could not decrypt [{$encryptedPath}]");
            return null;
        }

        // Write to a temp PDF file
        $tmpPdf = $this->tempFile('.pdf');

        try {
            file_put_contents($tmpPdf, $rawBytes);
            return $this->extractFromFile($tmpPdf);
        } finally {
            $this->deleteSafe($tmpPdf);
        }
    }

    /**
     * Extract text from a plain (unencrypted) PDF file path.
     */
    public function extractFromFile(string $pdfPath): ?string
    {
        // ── Step 1: Try text-layer extraction (fast) ──────────────────────
        $text = $this->extractTextLayer($pdfPath);

        $pageCount = $this->estimatePageCount($pdfPath);
        $avgChars  = $pageCount > 0 ? (mb_strlen($text ?? '') / $pageCount) : 0;

        if (!empty($text) && $avgChars >= self::MIN_CHARS_PER_PAGE) {
            Log::info("PdfTextService: text-layer extraction OK ({$avgChars} avg chars/page)");
            return $this->truncate($text);
        }

        // ── Step 2: Fallback to OCR ───────────────────────────────────────
        Log::info("PdfTextService: sparse text ({$avgChars} chars/page), attempting OCR...");

        if (!$this->isGhostscriptAvailable()) {
            Log::warning('PdfTextService: Ghostscript not found — cannot perform OCR. Install from https://www.ghostscript.com');
            // Return whatever little text we got, if any
            return !empty($text) ? $this->truncate($text) : null;
        }

        if (!$this->isTesseractAvailable()) {
            Log::warning('PdfTextService: Tesseract not found — cannot perform OCR. Install from https://github.com/UB-Mannheim/tesseract/wiki');
            return !empty($text) ? $this->truncate($text) : null;
        }

        $ocrText = $this->extractWithOcr($pdfPath);

        if (!empty($ocrText)) {
            Log::info('PdfTextService: OCR extraction succeeded.');
            return $this->truncate($ocrText);
        }

        // Return text-layer result even if sparse (better than nothing)
        return !empty($text) ? $this->truncate($text) : null;
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Text-layer extraction (smalot/pdfparser)
    // ─────────────────────────────────────────────────────────────────────────

    private function extractTextLayer(string $pdfPath): ?string
    {
        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf    = $parser->parseFile($pdfPath);
            $pages  = [];

            foreach ($pdf->getPages() as $page) {
                $t = trim($page->getText());
                if (!empty($t)) {
                    $pages[] = $t;
                }
            }

            return implode("\n\n", $pages) ?: null;
        } catch (\Throwable $e) {
            Log::warning('PdfTextService text-layer error: ' . $e->getMessage());
            return null;
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // OCR pipeline: Ghostscript → PNG images → Tesseract
    // ─────────────────────────────────────────────────────────────────────────

    private function extractWithOcr(string $pdfPath): ?string
    {
        $tmpDir = sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'edubot_ocr_' . uniqid('', true);
        @mkdir($tmpDir, 0777, true);

        try {
            // ── Render PDF pages to PNG images via Ghostscript ────────────
            $outputPattern = $tmpDir . DIRECTORY_SEPARATOR . 'page_%04d.png';
            $gs            = $this->findGhostscript();

            $gsCmd = sprintf(
                '"%s" -dNOPAUSE -dBATCH -dSAFER -sDEVICE=png16m -r300 -dTextAlphaBits=4 -dGraphicsAlphaBits=4 -sOutputFile="%s" "%s" 2>&1',
                $gs,
                $outputPattern,
                $pdfPath
            );

            exec($gsCmd, $gsOutput, $gsCode);

            if ($gsCode !== 0) {
                Log::warning('PdfTextService: Ghostscript failed: ' . implode(' ', $gsOutput));
                return null;
            }

            // ── Run Tesseract on each page image ──────────────────────────
            $images   = glob($tmpDir . DIRECTORY_SEPARATOR . 'page_*.png');
            $textParts = [];

            if (empty($images)) {
                Log::warning('PdfTextService: Ghostscript produced no images.');
                return null;
            }

            $tess = $this->findTesseract();

            foreach (array_slice($images, 0, 50) as $imagePath) { // cap at 50 pages
                $outBase = $imagePath . '_ocr';
                $tessCmd = sprintf(
                    '"%s" "%s" "%s" -l eng --psm 3 2>&1',
                    $tess,
                    $imagePath,
                    $outBase
                );

                exec($tessCmd, $tessOutput, $tessCode);

                $txtFile = $outBase . '.txt';
                if (file_exists($txtFile)) {
                    $pageText = trim(file_get_contents($txtFile));
                    if (!empty($pageText)) {
                        $textParts[] = $pageText;
                    }
                    $this->deleteSafe($txtFile);
                }
            }

            return !empty($textParts) ? implode("\n\n", $textParts) : null;

        } catch (\Throwable $e) {
            Log::error('PdfTextService OCR error: ' . $e->getMessage());
            return null;
        } finally {
            // Clean up temp images
            foreach (glob($tmpDir . DIRECTORY_SEPARATOR . '*') as $f) {
                $this->deleteSafe($f);
            }
            @rmdir($tmpDir);
        }
    }

    // ─────────────────────────────────────────────────────────────────────────
    // Helpers
    // ─────────────────────────────────────────────────────────────────────────

    private function estimatePageCount(string $pdfPath): int
    {
        try {
            $parser = new \Smalot\PdfParser\Parser();
            return count($parser->parseFile($pdfPath)->getPages());
        } catch (\Throwable) {
            return 1;
        }
    }

    private function truncate(string $text): string
    {
        $text = preg_replace('/\s{3,}/', "\n\n", $text); // collapse excess whitespace
        return mb_substr(trim($text), 0, self::MAX_CHARS);
    }

    private function tempFile(string $ext): string
    {
        return sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'edubot_pdf_' . uniqid('', true) . $ext;
    }

    private function deleteSafe(string $path): void
    {
        if (file_exists($path)) {
            @unlink($path);
        }
    }

    // ── Tool discovery ────────────────────────────────────────────────────────

    private function isGhostscriptAvailable(): bool
    {
        return $this->findGhostscript() !== null;
    }

    private function isTesseractAvailable(): bool
    {
        return $this->findTesseract() !== null;
    }

    private function findGhostscript(): ?string
    {
        // Common Windows install locations
        $candidates = [
            self::GHOSTSCRIPT_BIN,
        ];

        // Also search Program Files for any gs version
        foreach (glob('C:\\Program Files\\gs\\gs*\\bin\\gswin64c.exe') ?: [] as $path) {
            $candidates[] = $path;
        }
        foreach (glob('C:\\Program Files\\gs\\gs*\\bin\\gswin32c.exe') ?: [] as $path) {
            $candidates[] = $path;
        }

        // Check PATH
        $candidates[] = 'gswin64c';
        $candidates[] = 'gswin32c';
        $candidates[] = 'gs';

        foreach ($candidates as $bin) {
            if ($this->commandExists($bin)) {
                return $bin;
            }
        }

        return null;
    }

    private function findTesseract(): ?string
    {
        $candidates = [
            self::TESSERACT_BIN,
            'C:\\Program Files\\Tesseract-OCR\\tesseract.exe',
            'C:\\Program Files (x86)\\Tesseract-OCR\\tesseract.exe',
            'tesseract', // if on PATH
        ];

        foreach ($candidates as $bin) {
            if ($this->commandExists($bin)) {
                return $bin;
            }
        }

        return null;
    }

    private function commandExists(string $bin): bool
    {
        // For full paths, check if file exists
        if (str_contains($bin, DIRECTORY_SEPARATOR) || str_contains($bin, '/')) {
            return file_exists($bin);
        }

        // For short names, try where/which
        $check = PHP_OS_FAMILY === 'Windows'
            ? "where \"{$bin}\" >nul 2>&1"
            : "which \"{$bin}\" >/dev/null 2>&1";

        exec($check, $out, $code);
        return $code === 0;
    }
}
