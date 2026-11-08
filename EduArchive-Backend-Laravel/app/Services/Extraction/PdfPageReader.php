<?php

namespace App\Services\Extraction;

use App\Services\PdfMetadataSampler;

final class PdfPageReader
{
    /** Read all text for keywords; retain coordinates only for metadata windows. */
    public function read(string $path): array
    {
        $pdf = (new \Smalot\PdfParser\Parser())->parseFile($path);
        $pages = $pdf->getPages();
        $front = [];
        $tail = [];
        $count = count($pages);
        $all = [];
        $bytes = 0;
        $complete = true;
        $deadline = microtime(true) + 30;
        foreach ($pages as $index => $page) {
            if ($index >= 20000) { $complete = false; break; }
            try { $text = $page->getText(); }
            catch (\Throwable) { $text = ''; } // Try native OCR without losing other pages.
            $bytes += strlen($text);
            if ($bytes > 8 * 1024 * 1024 || microtime(true) > $deadline) { $complete = false; break; }
            $all[] = DocumentPage::fromText($text, $index + 1);
            if ($index >= PdfMetadataSampler::MAX_PAGES && $index < $count - 12) continue;
            $positions = [];
            $details = $page->getDetails();
            $box = $details['MediaBox'] ?? null;
            $height = is_array($box) && isset($box[3]) ? (float) $box[3] - (float) $box[1] : null;
            try {
                $fragments = $page->getDataTm();
                foreach (preg_split('/\R/u', $text) as $lineIndex => $line) {
                    $normalized = preg_replace('/\s+/u', ' ', trim($line));
                    if ($normalized === '') continue;
                    foreach ($fragments as $fragment) {
                        $part = preg_replace('/\s+/u', ' ', trim((string) ($fragment[1] ?? '')));
                        if ($part !== '' && str_contains($normalized, $part) && isset($fragment[0][5])) {
                            $positions[$lineIndex] = ['x' => (float) $fragment[0][4], 'y' => (float) $fragment[0][5]];
                            break;
                        }
                    }
                }
            } catch (\Throwable) { /* Repeated-edge detection remains available without coordinates. */ }
            $result = DocumentPage::fromText($text, $index + 1, $positions, $height);
            if ($index < PdfMetadataSampler::MAX_PAGES) $front[] = $result; else $tail[] = $result;
        }
        return ['front' => $front, 'tail' => $tail, 'all' => $all, 'complete' => $complete, 'total_pages' => $count];
    }
}
