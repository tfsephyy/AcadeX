<?php

namespace Tests\Unit;

use App\Http\Middleware\RejectOversizedUploads;
use App\Services\UploadLimits;
use Illuminate\Contracts\Debug\ExceptionHandler;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Tests\TestCase;

class UploadLimitsTest extends TestCase
{
    public function test_php_ini_sizes_are_converted_to_bytes(): void
    {
        self::assertSame(64 * 1024 * 1024, UploadLimits::bytesFromIni('64M'));
        self::assertSame(70 * 1024 * 1024, UploadLimits::bytesFromIni('70m'));
        self::assertSame(128 * 1024 * 1024, UploadLimits::bytesFromIni('128M'));
        self::assertSame(140 * 1024 * 1024, UploadLimits::bytesFromIni('140m'));
        self::assertSame(2 * 1024 * 1024 * 1024, UploadLimits::bytesFromIni('2G'));
        self::assertSame(512 * 1024, UploadLimits::bytesFromIni('512K'));
        self::assertSame(1024, UploadLimits::bytesFromIni('1024'));
        self::assertSame(0, UploadLimits::bytesFromIni('-1'));
        self::assertSame(0, UploadLimits::bytesFromIni('0'));
        self::assertSame(0, UploadLimits::bytesFromIni(false));
    }

    public function test_512_mib_memory_produces_effective_ceiling_no_greater_than_64_mib(): void
    {
        $ceiling = UploadLimits::calculateMemorySafeCeiling(512 * 1024 * 1024);

        self::assertLessThanOrEqual(64 * 1024 * 1024, $ceiling);
        self::assertSame(64 * 1024 * 1024, $ceiling);
    }

    public function test_256_mib_memory_produces_approximately_26_point_66_mib_ceiling(): void
    {
        $ceiling = UploadLimits::calculateMemorySafeCeiling(256 * 1024 * 1024);
        $expected = (int) floor((160 * 1024 * 1024) / 6.0); // 27,962,026 bytes (~26.66 MiB)

        self::assertSame($expected, $ceiling);
        self::assertSame(27962026, $ceiling);
    }

    public function test_unlimited_memory_still_produces_no_more_than_64_mib(): void
    {
        self::assertSame(64 * 1024 * 1024, UploadLimits::calculateMemorySafeCeiling(-1));
        self::assertSame(64 * 1024 * 1024, UploadLimits::calculateMemorySafeCeiling(0));
    }

    public function test_memory_at_or_below_baseline_reports_no_safe_capacity_and_fails_closed(): void
    {
        $baseline = UploadLimits::MEMORY_BASELINE_BYTES; // 96 MiB
        self::assertSame(0, UploadLimits::calculateMemorySafeCeiling($baseline));
        self::assertSame(0, UploadLimits::calculateMemorySafeCeiling($baseline - 1024));
        self::assertSame(0, UploadLimits::calculateMemorySafeCeiling(64 * 1024 * 1024));

        $limits = new UploadLimits();
        self::assertFalse($limits->hasSafeUploadMemory($baseline));
        self::assertFalse($limits->hasSafeUploadMemory(64 * 1024 * 1024));

        // When memory is unsafe, middleware fails closed with HTTP 503
        $unsafeLimits = new class extends UploadLimits {
            public function hasSafeUploadMemory(?int $memoryLimitBytes = null): bool
            {
                return false;
            }
        };
        $middleware = new RejectOversizedUploads($unsafeLimits);
        $request = Request::create('/api/v1/student/capstones/upload', 'POST');
        $executed = false;
        $response = $middleware->handle($request, function () use (&$executed) {
            $executed = true;
            return response('unexpected');
        });

        self::assertFalse($executed);
        self::assertSame(503, $response->getStatusCode());
        $payload = json_decode($response->getContent(), true);
        self::assertFalse($payload['success']);
        self::assertStringContainsString('below the safe application baseline', $payload['message']);
    }

    public function test_acadex_max_upload_bytes_zero_uses_automatic_ceiling(): void
    {
        $safe = 64 * 1024 * 1024;
        self::assertSame($safe, UploadLimits::calculateEffectiveAppMaxBytes($safe, 0));
    }

    public function test_configured_30_mib_limit_results_in_30_mib_when_safe_ceiling_is_higher(): void
    {
        $safe = 64 * 1024 * 1024;
        $configured = 30 * 1024 * 1024;
        self::assertSame($configured, UploadLimits::calculateEffectiveAppMaxBytes($safe, $configured));
    }

    public function test_configured_128_mib_limit_is_clamped_to_safe_ceiling(): void
    {
        $safe = 64 * 1024 * 1024;
        $configured = 128 * 1024 * 1024;
        self::assertSame($safe, UploadLimits::calculateEffectiveAppMaxBytes($safe, $configured));
    }

    public function test_configured_value_must_never_exceed_memory_safe_upload_ceiling(): void
    {
        $cases = [
            ['safe' => 26 * 1024 * 1024, 'configured' => 50 * 1024 * 1024, 'expected' => 26 * 1024 * 1024],
            ['safe' => 64 * 1024 * 1024, 'configured' => 96 * 1024 * 1024, 'expected' => 64 * 1024 * 1024],
            ['safe' => 64 * 1024 * 1024, 'configured' => 128 * 1024 * 1024, 'expected' => 64 * 1024 * 1024],
            ['safe' => 0,                'configured' => 50 * 1024 * 1024, 'expected' => 0],
        ];

        foreach ($cases as $case) {
            $effective = UploadLimits::calculateEffectiveAppMaxBytes($case['safe'], $case['configured']);
            self::assertSame($case['expected'], $effective);
            self::assertLessThanOrEqual($case['safe'], $effective);
        }

        // Test with App instance
        config(['acadex.max_upload_bytes' => 128 * 1024 * 1024]);
        $stubLimits = new class extends UploadLimits {
            public function memorySafeUploadCeiling(): int
            {
                return 64 * 1024 * 1024;
            }
        };

        // Even though configured is 128 MiB, appMaxBytes() is strictly clamped to 64 MiB
        self::assertSame(64 * 1024 * 1024, $stubLimits->appMaxBytes());
        self::assertNotSame(128 * 1024 * 1024, $stubLimits->appMaxBytes());
    }

    public function test_file_over_effective_application_ceiling_is_rejected_before_extraction_or_encryption(): void
    {
        $limits = new class extends UploadLimits {
            public function postMaxBytes(): int
            {
                return 10 * 1024;
            }
            public function fileMaxBytes(): int
            {
                return 5 * 1024;
            }
            public function appMaxBytes(): int
            {
                return 1024; // 1 KiB per-file ceiling
            }
        };

        $middleware = new RejectOversizedUploads($limits);

        // Upload a 2 KiB fake file when per-file ceiling is 1 KiB
        $file = UploadedFile::fake()->create('document.pdf', 2);
        $request = Request::create('/api/v1/student/capstones/upload', 'POST', [], [], ['pdf' => $file]);

        $executed = false;
        $response = $middleware->handle($request, function () use (&$executed) {
            $executed = true;
            return response('unexpected');
        });

        self::assertFalse($executed);
        self::assertSame(413, $response->getStatusCode());
        $payload = json_decode($response->getContent(), true);
        self::assertFalse($payload['success']);
        self::assertStringContainsString('1 KB', $payload['message']);
        self::assertStringContainsString('exceeds the maximum allowed size', $payload['message']);
    }

    public function test_multipart_request_with_content_length_above_file_ceiling_but_file_under_ceiling_passes(): void
    {
        $limits = new class extends UploadLimits {
            public function postMaxBytes(): int
            {
                return 10 * 1024; // 10 KiB request limit
            }
            public function fileMaxBytes(): int
            {
                return 5 * 1024; // 5 KiB file limit
            }
            public function appMaxBytes(): int
            {
                return 1024; // 1 KiB per-file ceiling
            }
        };

        $middleware = new RejectOversizedUploads($limits);

        // File is 800 bytes (< 1024 ceiling), but multipart request CONTENT_LENGTH is 1500 bytes (> 1024 ceiling)
        // due to multipart headers, boundaries, and form fields.
        $validFile = UploadedFile::fake()->createWithContent('document.pdf', str_repeat('A', 800));
        $request = Request::create('/api/v1/student/capstones/upload', 'POST', [
            'skip_extraction' => '1',
            'title' => 'Test Capstone Title',
        ], [], [
            'pdf' => $validFile,
        ], [
            'CONTENT_LENGTH' => '1500',
        ]);

        $executed = false;
        $response = $middleware->handle($request, function () use (&$executed) {
            $executed = true;
            return response('passed');
        });

        self::assertTrue($executed);
        self::assertSame(200, $response->getStatusCode());
    }

    public function test_memory_limit_summary_distinguishes_unlimited_from_no_safe_capacity(): void
    {
        $unlimitedLimits = new class extends UploadLimits {
            public function rawMemoryLimit(): string { return '-1'; }
            public function memoryLimitBytes(): int { return 0; }
        };
        self::assertSame('-1 (unlimited)', $unlimitedLimits->memoryLimitSummary());

        $zeroLimits = new class extends UploadLimits {
            public function rawMemoryLimit(): string { return '0'; }
            public function memoryLimitBytes(): int { return 0; }
        };
        self::assertSame('0 (0 bytes / no safe capacity)', $zeroLimits->memoryLimitSummary());

        $normalLimits = new class extends UploadLimits {
            public function rawMemoryLimit(): string { return '512M'; }
            public function memoryLimitBytes(): int { return 512 * 1024 * 1024; }
        };
        self::assertSame('512 MB (raw: 512M)', $normalLimits->memoryLimitSummary());
    }

    public function test_oversized_content_length_returns_a_413_with_the_actual_server_ceiling(): void
    {
        $limits = new class extends UploadLimits {
            public function postMaxBytes(): int
            {
                return 70 * 1024 * 1024;
            }
            public function fileMaxBytes(): int
            {
                return 64 * 1024 * 1024;
            }
            public function appMaxBytes(): int
            {
                return 64 * 1024 * 1024;
            }
        };
        $middleware = new RejectOversizedUploads($limits);
        $request = Request::create('/api/v1/student/capstones/upload', 'POST', [], [], [], [
            'CONTENT_LENGTH' => (string) (75 * 1024 * 1024),
        ]);

        $response = $middleware->handle($request, fn () => response('unexpected'));

        self::assertSame(413, $response->getStatusCode());
        $payload = json_decode($response->getContent(), true);
        self::assertFalse($payload['success']);
        self::assertStringContainsString('70 MB', $payload['message']);
        self::assertStringContainsString('post_max_size', $payload['message']);
    }

    public function test_requests_below_the_ceiling_and_chunked_requests_pass_through(): void
    {
        $limits = new class extends UploadLimits {
            public function postMaxBytes(): int
            {
                return 70 * 1024 * 1024;
            }
            public function fileMaxBytes(): int
            {
                return 64 * 1024 * 1024;
            }
            public function appMaxBytes(): int
            {
                return 64 * 1024 * 1024;
            }
        };
        $middleware = new RejectOversizedUploads($limits);

        foreach ([1024, 0] as $length) {
            $server = $length > 0 ? ['CONTENT_LENGTH' => (string) $length] : [];
            $request = Request::create('/api/v1/student/capstones/upload', 'POST', [], [], [], $server);
            $response = $middleware->handle($request, fn () => response('passed'));
            self::assertSame(200, $response->getStatusCode());
        }
    }

    public function test_post_too_large_exception_is_rendered_as_a_json_413(): void
    {
        $request = Request::create('/api/v1/student/capstones/upload', 'POST', [], [], [], [
            'CONTENT_LENGTH' => (string) (3 * 1024 * 1024),
            'HTTP_ACCEPT' => 'application/json',
        ]);

        $response = app(ExceptionHandler::class)->render($request, new PostTooLargeException());

        self::assertSame(413, $response->getStatusCode());
        $payload = json_decode($response->getContent(), true);
        self::assertFalse($payload['success']);
        self::assertStringContainsString('The upload is too large', $payload['message']);
        self::assertStringContainsString('post_max_size', $payload['message']);
    }
}
