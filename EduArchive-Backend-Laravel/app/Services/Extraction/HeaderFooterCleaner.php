<?php

namespace App\Services\Extraction;

final class HeaderFooterCleaner
{
    public function __construct(private TextNormalizer $normalizer = new TextNormalizer()) {}

    public function clean(MetadataDocument $document): MetadataDocument
    {
        $occurrences = [];
        foreach ($document->pages as $page) {
            $visible = array_values(array_filter($page->lines, fn ($line) => trim($line['text']) !== ''));
            foreach ($visible as $index => $line) {
                if (!$this->margin($line, $index, count($visible), $page)) continue;
                $key = mb_strtolower($this->normalizer->line($line['text']));
                $occurrences[$key][$page->number] = true;
            }
        }
        $pages = [];
        foreach ($document->pages as $page) {
            $visible = array_values(array_filter($page->lines, fn ($line) => trim($line['text']) !== ''));
            $indexes = array_column($visible, 'index');
            $titleIndexes = $page->number === 1 ? $this->titleContent($visible, $occurrences) : [];
            $clean = [];
            foreach ($page->lines as $line) {
                $text = $this->normalizer->line($line['text']);
                $key = mb_strtolower($text);
                $position = array_search($line['index'], $indexes, true);
                $margin = $position !== false && $this->margin($line, $position, count($visible), $page);
                $protected = $this->protectedContent($text, $page->number);
                if ($this->pageNumber($text)) continue;
                $repeated = count($occurrences[$key] ?? []) >= 3 && !in_array($line['index'], $titleIndexes, true);
                if (!$protected && $margin && ($repeated || $this->knownMargin($text))) continue;
                if (preg_match('/^(?:Scanned with\s+)?(?:CamScanner|Adobe Scan|Microsoft Lens)\s*$/iu', $text)) continue;
                $clean[] = array_replace($line, ['text' => $text]);
            }
            $pages[] = new DocumentPage($page->number, $page->rawText, $clean, $page->height);
        }
        return new MetadataDocument($pages);
    }

    /** Protect the actual first-page title, even when reused in later headers. */
    private function titleContent(array $lines, array $occurrences): array
    {
        $candidates = [];
        $boundary = false;
        foreach ($lines as $line) {
            $text = $this->normalizer->line($line['text']);
            if (preg_match('/^(?:A\s+(?:Research\s*\/\s*Capstone|Capstone\s*\/\s*Research|Capstone|Research|Thesis)(?:\s+(?:Project|Study|Paper)(?:\s+(?:Presented|Submitted|In)\b.*)?)?$|Presented\s+to\b|Submitted\s+to\b|In\s+Partial\b|Prepared\s+by\b)/iu', $text)) {
                $boundary = true;
                break;
            }
            if ($this->knownMargin($text) || $this->pageNumber($text)) continue;
            $candidates[] = $line;
        }
        if (!$boundary) return [];
        // A repeated edge followed by an independent title block is a header.
        // Blank lines or a larger positional gap provide the block boundary.
        $start = 0;
        foreach ($candidates as $index => $line) {
            if ($index === 0) continue;
            $before = $candidates[$index - 1];
            $gap = $line['index'] > $before['index'] + 1
                || ($line['y'] !== null && $before['y'] !== null && abs($before['y'] - $line['y']) > 36);
            $beforeKey = mb_strtolower($this->normalizer->line($before['text']));
            if ($gap && count($occurrences[$beforeKey] ?? []) >= 3) $start = $index;
        }
        return array_column(array_slice($candidates, $start), 'index');
    }

    private function margin(array $line, int $index, int $count, DocumentPage $page): bool
    {
        if ($line['y'] !== null && $page->height) return $line['y'] >= $page->height * .88 || $line['y'] <= $page->height * .12;
        // Without coordinates, repetition at the same page edges is evidence.
        return $index < 3 || $index >= max(0, $count - 3);
    }

    private function protectedContent(string $text, int $page): bool
    {
        if (preg_match('/^(?:EXECUTIVE\s+SUMMARY|ABSTRACT|APPROVAL\s+SHEET|CURRICULUM\s+VITAE|TABLE\s+OF\s+CONT\w+|ACKNOWLEDG\w+|CHAPTER\s+[IVX\d]+|Adviser)\s*[:.]?$/iu', $text)) return true;
        return $page === 1 && preg_match('/^(?:(?:January|February|March|April|May|June|July|August|September|October|November|December)\b.*)?(?:19|20)\d{2}\s*$/iu', $text);
    }

    private function knownMargin(string $text): bool
    {
        return (bool) preg_match('/^(?:Republic of the Philippines|Mindoro State University(?:\s*[-–—]\s*Bongabong Campus)?|(?:Labasan,?\s*)?Bongabong,?\s*Oriental\s+Mindoro(?:\s+\d+)?(?:\s+Philippines?)?|University)\s*$/iu', $text);
    }

    private function pageNumber(string $text): bool
    {
        $text = preg_replace('/^[\s\-–—().]+|[\s\-–—().]+$/u', '', $text);
        return (bool) preg_match('/^(?:(?:page\s+)?(?:\d{1,3}|[ivxlcdm]{1,8})(?:\s*(?:of|\/)\s*(?:\d{1,3}|[ivxlcdm]{1,8}))?|\d{1,3}\s*\|\s*page)$/iu', $text);
    }
}
