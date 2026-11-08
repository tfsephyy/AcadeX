<?php

namespace App\Services\Extraction;

final class NameNormalizer
{
    public static function key(?string $name): string
    {
        $name = mb_strtolower((new TextNormalizer())->line($name ?? ''));
        $name = preg_replace('/(?:[,\s]+(?:ph\.?d\.?|m\.?i\.?t\.?|m\.?s\.?i\.?t\.?|m\.?s\.?c\.?|ed\.?d\.?))+$/iu', '', $name);
        $name = preg_replace('/,\s*(?:m\.?a\.?|m\.?s\.?)$/iu', '', $name);
        $name = preg_replace('/,\s*((?:jr|sr)\.?)$/iu', ' $1', $name);
        if (substr_count($name, ',') === 1) {
            [$surname, $given] = array_map('trim', explode(',', $name));
            $name = $given.' '.$surname;
        }
        $name = preg_replace('/^(?:(?:dr|prof|engr|mr|mrs|ms|miss|sir|maam)\.?\s+)+/iu', '', $name);
        $name = preg_replace('/[.\x{2019}\x{0027}]/u', '', $name);
        return trim(preg_replace('/[^\p{L}\p{M}\p{N}]+/u', ' ', $name));
    }
}
