<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;

/**
 * PdfTextService
 *
 * Extracts plain text from an encrypted PDF stored on disk.
 * Decrypts in-memory to a temp file, parses, then deletes the temp file.
 */
class PdfTextService
{
    /**
     * Extract all text from an encrypted capstone PDF.
     * Returns the full text content (all pages joined), or null on failure.
     *
     * @param  string  $encryptedPath  Storage-relative path (e.g. "capstones/abc.enc")
     * @param  int     $maxChars       Maximum characters to return (for token safety)
     */
    public function extractFromEncryptedPath(string $encryptedPath, int $maxChars = 12000): ?string
    {
        // Decrypt to memory
        $encryptor = new PdfEncryptorService();
        $rawBytes  = $encryptor->decryptFromDisk($encryptedPath);

        if (empty($rawBytes)) {
            return null;
        }

        // Write decrypted bytes to a temp file
        $tmpPath = sys_get_temp_dir() . '/chatbot_pdf_' . uniqid('', true) . '.pdf';

        try {
            file_put_contents($tmpPath, $rawBytes);

            // Parse with smalot/pdfparser
            $parser = new \Smalot\PdfParser\Parser();
            $pdf    = $parser->parseFile($tmpPath);

            $pages = [];
            foreach ($pdf->getPages() as $page) {
                $text = $page->getText();
                if (!empty(trim($text))) {
                    $pages[] = trim($text);
                }
            }

            $fullText = implode("\n\n", $pages);

            // Trim to token-safe length
            if (mb_strlen($fullText) > $maxChars) {
                $fullText = mb_substr($fullText, 0, $maxChars) . "\n\n[... content truncated for length ...]";
            }

            return $fullText;

        } catch (\Exception $e) {
            Log::warning('Chatbot PDF text extraction failed: ' . $e->getMessage(), [
                'path' => $encryptedPath,
            ]);
            return null;
        } finally {
            // Always delete the temp file
            if (file_exists($tmpPath)) {
                @unlink($tmpPath);
            }
        }
    }
}
