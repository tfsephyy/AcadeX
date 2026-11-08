<?php

namespace App\Services\Extraction;

final class YearExtractor
{
    public const MONTH = '(?:January|February|March|April|May|June|July|August|September|October|November|December|Jan\.?|Feb\.?|Mar\.?|Apr\.?|Jun\.?|Jul\.?|Aug\.?|Sep(?:t)?\.?|Oct\.?|Nov\.?|Dec\.?)';

    public function extract(MetadataDocument $document): ?int
    {
        $lines = self::dateLines($document->firstPage());
        foreach (array_reverse($lines) as $line) {
            if (preg_match('/^'.self::MONTH.'\s*,?\s*(?:\d{1,2}\s*,?\s*)?((?:19|20)\d{2})\s*[.]?$/iu', $line, $match)) return $this->valid((int) $match[1]);
        }
        // Legacy title sheets sometimes contain only a year after the authors.
        $last = end($lines) ?: '';
        if (preg_match('/^((?:19|20)\d{2})$/u', $last, $match) && count($lines) >= 3) return $this->valid((int) $match[1]);
        return null;
    }

    public static function dateLines(string $text): array
    {
        $text = preg_replace('/^('.self::MONTH.')[\t ]*,?[\t ]*\R[\t ]*((?:19|20)\d{2})[\t ]*$/imu', '$1 $2', $text);
        return array_values(array_filter(array_map('trim', explode("\n", $text)), fn ($line) => $line !== ''));
    }

    private function valid(int $year): ?int
    {
        return $year >= 2000 && $year <= min(2099, (int) date('Y') + 1) ? $year : null;
    }
}
