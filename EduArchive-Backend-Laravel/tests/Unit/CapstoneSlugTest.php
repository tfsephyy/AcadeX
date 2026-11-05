<?php

namespace Tests\Unit;

use App\Services\CapstoneSlug;
use PHPUnit\Framework\TestCase;

class CapstoneSlugTest extends TestCase
{
    public function test_numeric_titles_get_a_non_numeric_slug_prefix(): void
    {
        self::assertSame('capstone-2026', CapstoneSlug::baseForTitle('2026'));
        self::assertSame('capstone-2026', CapstoneSlug::baseForTitle(' 2026 '));
    }

    public function test_regular_title_slugs_keep_their_readable_form(): void
    {
        self::assertSame('machine-learning', CapstoneSlug::baseForTitle('Machine Learning'));
    }
}
