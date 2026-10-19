<?php

use App\Http\Middleware\VerifyApiCsrfToken;
use App\Http\Middleware\RoleMiddleware;
use Illuminate\Foundation\Application;
use Illuminate\Foundation\Configuration\Exceptions;
use Illuminate\Foundation\Configuration\Middleware;
use Illuminate\Http\Exceptions\PostTooLargeException;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

return Application::configure(basePath: dirname(__DIR__))
    ->withRouting(
        web: __DIR__.'/../routes/web.php',
        api: __DIR__.'/../routes/api.php',
        commands: __DIR__.'/../routes/console.php',
        health: '/up',
    )
    ->withMiddleware(function (Middleware $middleware): void {
        $middleware->replace(\Illuminate\Http\Middleware\TrustProxies::class, \App\Http\Middleware\TrustConfiguredProxies::class);
        // Use Laravel's session and CSRF boundary for every browser API request,
        // including login/registration. The SPA obtains its CSRF token as JSON
        // so API cookies can remain host-only on a separate HTTPS hostname.
        $middleware->api(prepend: [
            \Illuminate\Cookie\Middleware\EncryptCookies::class,
            \Illuminate\Cookie\Middleware\AddQueuedCookiesToResponse::class,
            \Illuminate\Session\Middleware\StartSession::class,
            VerifyApiCsrfToken::class,
        ]);

        // Register named middleware aliases
        $middleware->alias([
            'role' => RoleMiddleware::class,
            'uploads.limit' => \App\Http\Middleware\RejectOversizedUploads::class,
            'uploads.concurrency' => \App\Http\Middleware\GuardUploadConcurrency::class,
        ]);
    })
    ->withExceptions(function (Exceptions $exceptions): void {
        // ValidatePostSize runs before route middleware and throws this when the
        // multipart body is larger than post_max_size. Return the same useful
        // JSON/413 shape as RejectOversizedUploads instead of Laravel's generic
        // HTML error page (or a misleading empty-form 422).
        $exceptions->render(function (PostTooLargeException $exception, Request $request) {
            if (! $request->is('api/*') && ! $request->expectsJson()) {
                return null;
            }

            $limits = app(\App\Services\UploadLimits::class);
            $contentLength = (int) ($request->server('CONTENT_LENGTH') ?: $request->headers->get('Content-Length', 0));
            Log::warning('Rejected an oversized API request before routing.', [
                'content_length' => $contentLength,
                'post_max_size' => $limits->postMaxBytes(),
                'path' => $request->path(),
            ]);

            return response()->json([
                'success' => false,
                'message' => 'The upload is too large for this server. The server accepts requests up to '
                    .$limits->humanBytes($limits->postMaxBytes()).'. Please compress the PDF or ask the administrator '
                    .'to raise the PHP post_max_size and upload_max_filesize limits.',
            ], 413);
        });
    })->create();
