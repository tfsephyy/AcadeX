<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Contracts\Cache\LockProvider;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Cache;
use RuntimeException;
use Throwable;

/**
 * Concurrency guard for whole-file encryption upload processing endpoints.
 * Enforces a single global upload slot on single-host deployments using an atomic cache lock.
 *
 * NOTE: Multi-process host-wide concurrency serialization requires an inter-process
 * cache lock store (such as database, file, or Redis). Process-local stores (array, null)
 * are rejected in production.
 */
class GuardUploadConcurrency
{
    public const LOCK_NAME = 'acadex_upload_processing_lock';
    public const LOCK_TTL_SECONDS = 660;

    public function handle(Request $request, Closure $next): mixed
    {
        $storeName = config('acadex.upload_lock_store') ?: config('cache.default', 'database');

        if (app()->environment('production') && in_array($storeName, ['array', 'null'], true)) {
            throw new RuntimeException("Configured upload lock store [{$storeName}] is process-local and cannot safely coordinate upload concurrency across PHP-FPM workers in production. Configure an inter-process store (database, file, redis).");
        }

        try {
            $repository = Cache::store($storeName);
            if (!$repository->getStore() instanceof LockProvider) {
                throw new RuntimeException("Configured upload lock store [{$storeName}] does not implement the LockProvider contract.");
            }
            $lock = $repository->lock(self::LOCK_NAME, self::LOCK_TTL_SECONDS);
        } catch (Throwable $e) {
            throw new RuntimeException('Configured cache driver cannot support atomic locks for upload concurrency guard: '.$e->getMessage(), 0, $e);
        }

        try {
            $acquired = $lock->get();
        } catch (Throwable $e) {
            throw new RuntimeException('Failed acquiring atomic cache lock for upload concurrency guard: '.$e->getMessage(), 0, $e);
        }

        if (!$acquired) {
            return new JsonResponse([
                'success' => false,
                'message' => 'Another upload is currently being processed on this server. Please try again shortly.',
            ], 429, ['Retry-After' => '10']);
        }

        try {
            return $next($request);
        } finally {
            $lock->release();
        }
    }
}
