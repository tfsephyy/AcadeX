<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\DocumentUpload;
use App\Models\UploadTransfer;
use App\Models\User;
use App\Services\DocumentUploads;
use App\Services\PdfEncryptorService;
use App\Services\PrivateTemp;
use App\Services\UploadLimits;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

class UploadTransferController extends Controller
{
    use ApiResponses;

    public const CHUNK_BYTES = 2 * 1024 * 1024;

    private function owned(Request $request, string $transfer): UploadTransfer
    {
        $record = UploadTransfer::whereKey($transfer)->where('user_id', $request->user()->id)->lockForUpdate()->firstOrFail();
        if (!$record->upload_id && !$record->expires_at->isFuture()) abort(410, 'This upload expired. Select the PDF again.');
        return $record;
    }

    private function payload(UploadTransfer $record): array
    {
        return ['transfer_id' => $record->id, 'received_bytes' => $record->received_bytes,
            'size' => $record->size, 'chunk_bytes' => self::CHUNK_BYTES, 'upload_id' => $record->upload_id];
    }

    public function start(Request $request, string $transfer): JsonResponse
    {
        $values = $request->validate(['name' => 'required|string|max:255',
            'size' => 'required|integer|min:1|max:'.UploadLimits::CURRENT_ENCRYPTION_MAX_BYTES]);
        $record = DB::transaction(function () use ($request, $transfer, $values) {
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $existing = UploadTransfer::whereKey($transfer)->first();
            if ($existing) {
                $existing = $this->owned($request, $transfer);
                if ($existing->original_name !== $values['name'] || $existing->size !== (int) $values['size']) abort(409, 'Transfer details do not match.');
                return $existing;
            }
            // Reserve space for incomplete transfers as well as already-staged files.
            $usage = app(DocumentUploads::class)->pendingUsage($request->user());
            $transfers = UploadTransfer::where('user_id', $request->user()->id)->whereNull('upload_id')->where('expires_at', '>', now());
            $transferBytes = (int) (clone $transfers)->sum('size');
            $transferCount = (int) (clone $transfers)->count();

            $totalCount = $usage['count'] + $transferCount;
            $totalBytes = $usage['bytes'] + $transferBytes + (int) $values['size'];
            $maxUploads = max(1, (int) config('acadex.max_pending_uploads', 20));
            $maxBytes = max(1, (int) config('acadex.max_pending_upload_bytes', 1073741824));

            if ($totalCount >= $maxUploads || $totalBytes > $maxBytes) {
                throw ValidationException::withMessages(['pdf' =>
                    DocumentUploads::quotaMessage($totalCount, $usage['bytes'] + $transferBytes, $maxBytes)]);
            }
            return UploadTransfer::create(['id' => $transfer, 'user_id' => $request->user()->id,
                'original_name' => $values['name'], 'size' => $values['size'], 'chunks' => [], 'expires_at' => now()->addDay()]);
        }, 3);
        return $this->successResponse($this->payload($record));
    }

    public function chunk(Request $request, string $transfer): JsonResponse
    {
        $request->validate(['offset' => 'required|integer|min:0', 'chunk' => 'required|file|max:2048']);
        $path = null;
        try {
            $record = DB::transaction(function () use ($request, $transfer, &$path) {
                $record = $this->owned($request, $transfer);
                if ($record->upload_id) return $record;
                $offset = (int) $request->input('offset');
                $file = $request->file('chunk');
                $hash = hash_file('sha256', $file->getRealPath());
                $chunks = $record->chunks;
                // Acknowledgement may have been lost. Replaying the same bytes is safe.
                if ($offset < $record->received_bytes) {
                    foreach ($chunks as $chunk) {
                        if ($chunk['offset'] === $offset && hash_equals($chunk['hash'], $hash)) return $record;
                    }
                    abort(409, 'The replayed chunk does not match this transfer.');
                }
                $expected = min(self::CHUNK_BYTES, $record->size - $record->received_bytes);
                if ($offset !== $record->received_bytes || $expected < 1 || $file->getSize() !== $expected) abort(409, 'Chunk offset or size does not match. Reconnect to this transfer.');
                $path = app(PdfEncryptorService::class)->encryptAndStore('transfer-chunks', $file);
                $chunks[] = ['path' => $path, 'offset' => $offset, 'hash' => $hash, 'size' => $expected];
                $record->update(['chunks' => $chunks, 'received_bytes' => $offset + $expected]);
                return $record;
            });
        } catch (\Throwable $error) {
            if ($path) Storage::disk('local')->delete($path);
            throw $error;
        }
        return $this->successResponse($this->payload($record));
    }

    public function complete(Request $request, string $transfer): JsonResponse
    {
        $temp = null;
        $stagedPath = null;
        $response = null;
        $quotaFailed = false;
        try {
            DB::transaction(function () use ($request, $transfer, &$temp, &$response, &$stagedPath, &$quotaFailed) {
                // Same lock order as allocation/staging; serialized across tabs and retries.
                User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
                $record = $this->owned($request, $transfer);
                if ($record->upload_id) {
                    $response = app(CapstoneController::class)->uploadStatus($request, $record->upload_id);
                    return;
                }
                if ($record->received_bytes !== $record->size) abort(409, 'The file has not finished uploading.');
                $temp = PrivateTemp::file();
                $output = fopen($temp, 'wb');
                if (!is_resource($output)) throw new \RuntimeException('Cannot open private assembly stream.');
                try {
                    foreach ($record->chunks as $chunk) {
                        $document = app(PdfEncryptorService::class)->openVerifiedDocument($chunk['path']);
                        if (!$document) abort(410, 'An upload chunk is unavailable. Select the PDF again.');
                        try { $document->copyTo($output); } finally { $document->close(); }
                    }
                } finally { fclose($output); }
                if (filesize($temp) !== $record->size) throw new \RuntimeException('Assembled upload size mismatch.');
                // Reuse PDF validation, encryption, ownership quotas and queued extraction.
                $request->files->set('pdf', new UploadedFile($temp, $record->original_name, 'application/pdf', null, true));
                try {
                    $response = app(CapstoneController::class)->upload($request);
                } catch (ValidationException $e) {
                    $quotaFailed = true;
                    throw $e;
                }
                if ($response->getStatusCode() >= 400) {
                    $quotaFailed = true;
                    return;
                }
                $id = $response->getData(true)['data']['upload_id'];
                $stagedPath = DocumentUpload::findOrFail($id)->path;
                $record->update(['upload_id' => $id]);
            });
        } catch (\Throwable $error) {
            // File writes are outside database transactions. If finalization
            // rolls back, leave only its resumable chunks for the next attempt.
            if ($stagedPath && !DocumentUpload::where('path', $stagedPath)->exists()) {
                Storage::disk('local')->delete($stagedPath);
            }
            if ($quotaFailed || $error instanceof ValidationException) {
                UploadTransfer::whereKey($transfer)->where('user_id', $request->user()->id)->update(['expires_at' => now()]);
            }
            throw $error;
        } finally {
            if ($temp && is_file($temp)) @unlink($temp);
        }
        if ($response && $response->getStatusCode() >= 400) {
            UploadTransfer::whereKey($transfer)->where('user_id', $request->user()->id)->update(['expires_at' => now()]);
            return $response;
        }
        if ($response && $response->getStatusCode() < 400) {
            // Finalization is already committed. Retried finalization only reads
            // the same upload_id, so acknowledged chunks are now disposable.
            $record = UploadTransfer::whereKey($transfer)->where('user_id', $request->user()->id)->first();
            if ($record?->upload_id && $record->chunks) {
                if (Storage::disk('local')->delete(array_column($record->chunks, 'path'))) {
                    $record->update(['chunks' => []]);
                }
            }
        }
        return $response;
    }

    public function cancel(Request $request, string $transfer): JsonResponse
    {
        DB::transaction(function () use ($request, $transfer) {
            $record = $this->owned($request, $transfer);
            // Completed extraction is retained; cancellation only stops a transfer.
            if ($record->upload_id) return;
            Storage::disk('local')->delete(array_column($record->chunks, 'path'));
            $record->update(['chunks' => [], 'received_bytes' => 0, 'expires_at' => now()]);
        });
        return $this->successResponse(null, 'Transfer cancelled.');
    }
}
