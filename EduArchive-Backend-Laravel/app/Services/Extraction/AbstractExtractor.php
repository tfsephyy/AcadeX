<?php

namespace App\Services\Extraction;

class AbstractExtractor
{
    public function __construct(private TextNormalizer $normalizer = new TextNormalizer()) {}

    public function extract(MetadataDocument $document): ?string
    {
        foreach (['EXECUTIVE\s+SUMMARY', 'ABSTRACT', 'SUMMARY'] as $heading) {
            $collecting = false;
            $parts = [];
            $previousPage = null;
            foreach ($document->pages as $page) {
                if ($page->number > 12 || ($collecting && $previousPage !== null && $page->number !== $previousPage + 1)) break;
                $text = $this->normalizer->headings($page->text());
                foreach (explode("\n", $text) as $line) {
                    if (!$collecting) {
                        if (preg_match('/^\s*'.$heading.'\s*[:.]?\s*$/iu', $line)) $collecting = true;
                        continue;
                    }
                    if (preg_match('/^\s*(?:TABLE\s+OF\s+CONT(?:ENTS?|END|ENDS)\b|ACKNOWLEDG(?:E?MENTS?)\b|CHAPTER\s+[IVX\d]+\b|LIST\s+OF\b|KEY\s*WORDS?\s*:|INDEX\s+TERMS?\s*:)/iu', $line)) {
                        return $this->value($parts);
                    }
                    $parts[] = $line;
                }
                if ($collecting) $parts[] = '';
                $previousPage = $page->number;
            }
            if ($collecting) return $this->value($parts);
        }
        return null;
    }

    private function value(array $parts): ?string
    {
        $text = $this->normalizer->prose(implode("\n", $parts));
        $text = implode("\n\n", array_values(array_unique(explode("\n\n", $text))));
        return mb_strlen($text) >= 30 ? mb_substr($text, 0, 12000) : null;
    }
}
