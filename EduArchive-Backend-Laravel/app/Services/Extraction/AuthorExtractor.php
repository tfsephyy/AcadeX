<?php

namespace App\Services\Extraction;

final class AuthorExtractor
{
    public function __construct(private TextNormalizer $normalizer = new TextNormalizer()) {}

    /** @return string[] Names remain separate internally, including surname commas. */
    public function extract(MetadataDocument $document): array
    {
        $lines = YearExtractor::dateLines($this->normalizer->headings($document->firstPage()));
        $names = [];
        foreach ($lines as $index => $line) {
            if (!preg_match('/^(?:Prepared\s+by|Submitted\s+by|Authors?|Researchers?|Proponents?|by)\b\s*:?\s*(.*)$/iu', $line, $match)) continue;
            $candidates = array_merge($match[1] !== '' ? [$match[1]] : [], array_slice($lines, $index + 1));
            foreach ($candidates as $candidate) {
                if (!$this->isName($candidate)) break;
                $names[] = $this->normalizer->line(trim($candidate, ' ;:'));
                if (count($names) >= 15) break;
            }
            break;
        }
        if (!$names) {
            // Only names immediately above a real month/year date qualify.
            foreach ($lines as $index => $line) {
                if (!preg_match('/^'.YearExtractor::MONTH.'\s*,?\s*(?:\d{1,2}\s*,?\s*)?(?:19|20)\d{2}\s*$/iu', $line)) continue;
                for ($before = $index - 1; $before >= 0 && $this->isName($lines[$before]); $before--) array_unshift($names, $lines[$before]);
                break;
            }
        }
        $unique = [];
        foreach ($names as $name) $unique[mb_strtolower($name)] = $name;
        return array_values($unique);
    }

    public function isName(string $text): bool
    {
        if (mb_strlen($text) > 120 || preg_match('/\d|@|:|\b(?:University|Bachelor|Project|Research|Presented|Submitted|Prepared|Adviser|Faculty|Campus|Requirements|Fulfillment|Summary|Chapter|Curriculum)\b/iu', $text)) return false;
        if (preg_match('/^'.YearExtractor::MONTH.'\b/iu', $text)) return false;
        return (bool) preg_match('/^\p{L}[\p{L}\p{M}.,\x{2019}\x{0027}()\-]*(?:\s+[\p{L}\p{M}.,\x{2019}\x{0027}()\-]+){1,11}$/u', $text);
    }
}
