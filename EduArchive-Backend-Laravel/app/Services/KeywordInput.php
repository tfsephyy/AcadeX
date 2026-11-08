<?php

namespace App\Services;

/** Shared limits and comma-list normalization before validation/persistence. */
final class KeywordInput
{
    public const MAX_KEYWORDS = 15;
    public const MAX_LENGTH = 100;

    public static function normalize(mixed $raw): mixed
    {
        if (is_string($raw)) $raw = [$raw];
        if (!is_array($raw)) return $raw; // Let Laravel reject invalid types.
        $result = [];
        $seen = [];
        foreach ($raw as $value) {
            if (!is_string($value)) { $result[] = $value; continue; }
            foreach (explode(',', $value) as $name) {
                $name = mb_strtolower(trim(preg_replace('/\s+/u', ' ', $name)));
                if ($name === '' || isset($seen[$name])) continue;
                $seen[$name] = true;
                $result[] = $name; // Keep long entries so validation rejects them.
            }
        }
        return $result;
    }
}
