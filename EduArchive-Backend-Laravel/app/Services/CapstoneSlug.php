<?php

namespace App\Services;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

/**
 * Human-readable, unique capstone slugs.
 *
 * Slug generation is deliberately separate from citation formatting. A slug
 * is assigned once at creation and is never rewritten when a title is edited,
 * so previously shared links keep resolving.
 */
class CapstoneSlug
{
    public static function forTitle(string $title, ?int $ignoreId = null): string
    {
        $base = self::baseForTitle($title);

        $slug = $base;
        $suffix = 2;
        while (self::exists($slug, $ignoreId)) {
            $slug = $base.'-'.$suffix;
            $suffix++;
        }

        return $slug;
    }

    /** Numeric-only slugs collide with the legacy numeric-ID route namespace. */
    public static function baseForTitle(string $title): string
    {
        $base = Str::slug($title);
        $base = $base !== '' ? mb_substr($base, 0, 170) : 'capstone';
        return ctype_digit($base) ? 'capstone-'.$base : $base;
    }

    private static function exists(string $slug, ?int $ignoreId): bool
    {
        $query = DB::table('capstones')->where('slug', $slug);
        if ($ignoreId !== null) {
            $query->where('id', '!=', $ignoreId);
        }
        return $query->exists();
    }
}
