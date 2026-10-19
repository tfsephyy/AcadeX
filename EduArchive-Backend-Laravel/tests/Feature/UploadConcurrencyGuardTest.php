<?php

namespace Tests\Feature;

use App\Http\Middleware\GuardUploadConcurrency;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Tests\SecurityTestCase;

/**
 * Upload concurrency guard control-flow test suite.
 *
 * NOTE: These tests verify middleware control flow, lock acquisition, HTTP 429 response
 * format, Retry-After headers, finally-block release behavior, and exception safety within
 * the test runner process. They do NOT prove host-wide serialization across separate PHP-FPM
 * workers. Production serialization requires an inter-process atomic lock store (such as
 * database, file, or Redis) and multi-process contention verification.
 */
class UploadConcurrencyGuardTest extends SecurityTestCase
{
    private function syntheticPdf(): string
    {
        $text = 'Synthetic concurrency guard test document';
        $stream = 'BT /F1 12 Tf 50 700 Td ('.$text.') Tj ET';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length '.strlen($stream).">>\nstream\n".$stream."\nendstream"];
        $pdf = "%PDF-1.4\n"; $offsets = [0];
        foreach ($objects as $i => $object) { $offsets[] = strlen($pdf); $pdf .= ($i + 1)." 0 obj\n".$object."\nendobj\n"; }
        $xref = strlen($pdf); $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) $pdf .= sprintf("%010d 00000 n \n", $offset);
        return $pdf."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF";
    }

    public function test_pre_held_lock_causes_controlled_429_rejection_with_retry_after(): void
    {
        $student = $this->user('student');
        $this->asUser($student);

        // Pre-acquire the lock
        $preLock = Cache::lock(GuardUploadConcurrency::LOCK_NAME, GuardUploadConcurrency::LOCK_TTL_SECONDS);
        self::assertTrue($preLock->get(), 'Pre-acquiring atomic lock should succeed.');

        try {
            $response = $this->post('/api/v1/student/capstones/upload', [
                'pdf' => UploadedFile::fake()->createWithContent('test.pdf', $this->syntheticPdf()),
                'skip_extraction' => 1,
            ], ['Accept' => 'application/json']);

            $response->assertStatus(429);
            $response->assertHeader('Retry-After', '10');
            $response->assertJson([
                'success' => false,
                'message' => 'Another upload is currently being processed on this server. Please try again shortly.',
            ]);
        } finally {
            $preLock->release();
        }
    }

    public function test_lock_is_released_after_a_successful_request(): void
    {
        $student = $this->user('student');
        $this->asUser($student);

        $response = $this->post('/api/v1/student/capstones/upload', [
            'pdf' => UploadedFile::fake()->createWithContent('test.pdf', $this->syntheticPdf()),
            'skip_extraction' => 1,
        ], ['Accept' => 'application/json']);

        $response->assertOk();

        // Lock must not be held after request completes
        $testLock = Cache::lock(GuardUploadConcurrency::LOCK_NAME, 10);
        self::assertTrue($testLock->get(), 'Lock should be released and immediately acquirable after successful request.');
        $testLock->release();
    }

    public function test_lock_is_released_after_handled_exception(): void
    {
        $middleware = new GuardUploadConcurrency();
        $request = Request::create('/api/v1/student/capstones/upload', 'POST');

        try {
            $middleware->handle($request, function () {
                throw new \Exception('Handled pipeline exception');
            });
            self::fail('Expected exception was not thrown');
        } catch (\Exception $e) {
            self::assertSame('Handled pipeline exception', $e->getMessage());
        }

        // Lock must have been released in the finally block
        $testLock = Cache::lock(GuardUploadConcurrency::LOCK_NAME, 10);
        self::assertTrue($testLock->get(), 'Lock must be released even after an exception in pipeline.');
        $testLock->release();
    }

    public function test_fails_clearly_if_cache_driver_cannot_support_atomic_locks(): void
    {
        // Mock Cache facade or driver to simulate a driver that doesn't support locks
        Cache::shouldReceive('store')
            ->andThrow(new \BadMethodCallException('This cache store does not support locking.'));

        $middleware = new GuardUploadConcurrency();
        $request = Request::create('/api/v1/student/capstones/upload', 'POST');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('Configured cache driver cannot support atomic locks');

        $middleware->handle($request, fn () => response('unexpected'));
    }

    public function test_in_production_process_local_cache_stores_are_rejected(): void
    {
        $this->app['env'] = 'production';
        config(['acadex.upload_lock_store' => 'array']);

        $middleware = new GuardUploadConcurrency();
        $request = Request::create('/api/v1/student/capstones/upload', 'POST');

        $this->expectException(RuntimeException::class);
        $this->expectExceptionMessage('process-local and cannot safely coordinate upload concurrency');

        $middleware->handle($request, fn () => response('unexpected'));
    }
}
