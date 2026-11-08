<?php

namespace App\Services\Extraction;

final class TitleExtractor
{
    public function __construct(private TextNormalizer $normalizer = new TextNormalizer()) {}

    public function extract(MetadataDocument $document): ?string
    {
        $collected = [];
        $lines = array_values(array_filter(explode("\n", $document->firstPage()), fn ($line) => trim($line) !== ''));
        foreach ($lines as $index => $line) {
            $line = trim($line);
            if ($line === '') continue;
            // Anchored to the introductory line, never a phrase inside a title.
            $intro = false;
            for ($size = 1; $size <= 3; $size++) {
                $joined = implode(' ', array_slice($lines, $index, $size));
                if (preg_match('/^A\s+(?:Research\s*\/\s*Capstone|Capstone\s*\/\s*Research|Capstone|Research|Thesis)\s+(?:Project|Study|Paper)(?:\s+(?:Presented|Submitted|In)\b.*)?$/iu', $joined)) $intro = true;
            }
            if ($intro || preg_match('/^(?:Presented\s+to\b|Submitted\s+to\b|In\s+Partial\s+Fulfill?ment\b|of\s+the\s+Requirements\b|Bachelor\s+of\b|Prepared\s+by\b|by\s*:?$)/iu', $line)) break;
            $collected[] = $line;
        }
        $title = $this->normalizer->prose(implode(' ', $collected));
        // Without a project boundary, only a single plausible title line is safe.
        if (count($collected) > 6 || mb_strlen($title) < 6 || mb_strlen($title) > 255) return null;
        return $title ?: null;
    }
}
