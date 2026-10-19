<?php

namespace App\Http\Middleware;

use App\Services\UploadLimits;
use Closure;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

/**
 * Validates request payload sizes against PHP post_max_size, effective application
 * ceilings, and memory safety requirements before reaching upload processing.
 */
class RejectOversizedUploads
{
    public function __construct(private UploadLimits $limits) {}

    public function handle(Request $request, Closure $next): mixed
    {
        // 1. Fail closed with 503 if PHP memory_limit is below the safe application baseline
        if (!$this->limits->hasSafeUploadMemory()) {
            Log::warning('Rejected upload request: server memory limit is below safe application baseline.', [
                'memory_limit' => $this->limits->memoryLimitBytes(),
                'user_id' => $request->user()?->id,
                'path' => $request->path(),
            ]);

            return new JsonResponse([
                'success' => false,
                'message' => 'Uploads are temporarily unavailable because the server memory limit is below the safe application baseline.',
            ], 503);
        }

        $contentLength = (int) ($request->server('CONTENT_LENGTH') ?: $request->headers->get('Content-Length', 0));
        $postMax = $this->limits->postMaxBytes();
        $effectiveMax = $this->limits->effectiveMaxBytes();

        // 2. Reject if Content-Length exceeds PHP post_max_size
        if ($contentLength > 0 && $postMax > 0 && $contentLength > $postMax) {
            Log::warning('Rejected an upload larger than post_max_size.', [
                'content_length' => $contentLength,
                'post_max_size' => $postMax,
                'user_id' => $request->user()?->id,
                'path' => $request->path(),
            ]);

            return new JsonResponse([
                'success' => false,
                'message' => 'The upload is too large for this server. The server accepts requests up to '
                    .$this->limits->humanBytes($postMax).'. Please compress the PDF or ask the administrator '
                    .'to raise the PHP post_max_size and upload_max_filesize limits.',
            ], 413);
        }

        // 3. Reject if any parsed uploaded file exceeds the effective application ceiling.
        // Multipart Content-Length includes multipart boundaries, headers, and form fields,
        // so Content-Length is compared to post_max_size (above), while the per-file
        // application ceiling is enforced on the actual uploaded file(s).
        if ($effectiveMax > 0) {
            foreach ($request->allFiles() as $field => $file) {
                $files = is_array($file) ? $file : [$file];
                foreach ($files as $f) {
                    if ($f instanceof UploadedFile && $f->getSize() > $effectiveMax) {
                        Log::warning('Rejected an uploaded file larger than effective application ceiling.', [
                            'field' => $field,
                            'file_size' => $f->getSize(),
                            'effective_max' => $effectiveMax,
                            'user_id' => $request->user()?->id,
                            'path' => $request->path(),
                        ]);

                        return new JsonResponse([
                            'success' => false,
                            'message' => 'The upload exceeds the maximum allowed size of '
                                .$this->limits->humanBytes($effectiveMax).'.',
                        ], 413);
                    }
                }
            }
        }

        return $next($request);
    }
}
