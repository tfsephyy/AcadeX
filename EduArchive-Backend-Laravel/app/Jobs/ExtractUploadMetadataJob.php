<?php

namespace App\Jobs;

use App\Models\DocumentUpload;
use App\Services\MetadataAssistantService;
use App\Services\PdfEncryptorService;
use App\Services\PdfExtractorService;
use App\Services\UploadProcessingNotifier;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldBeUnique;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Validation\ValidationException;

class ExtractUploadMetadataJob implements ShouldQueue, ShouldBeUnique
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout;
    public int $tries;
    public int $uniqueFor = 3600;
    public array $backoff = [10, 60];

    public function __construct(public string $uploadId)
    {
        $this->timeout = max(30, (int) config('acadex.upload_extraction_timeout', 300));
        $this->tries = max(1, (int) config('acadex.upload_extraction_tries', 3));
        $this->onQueue((string) config('acadex.upload_queue', 'default'));
    }

    public function uniqueId(): string
    {
        return $this->uploadId;
    }

    public function handle(
        PdfExtractorService $extractor,
        MetadataAssistantService $assistant,
        PdfEncryptorService $encryptor,
        UploadProcessingNotifier $notifier,
    ): void {
        $upload = DocumentUpload::find($this->uploadId);
        if (!$upload) return;

        // Atomic claim is the duplicate-protection boundary. A second delivery
        // for the same upload cannot start a concurrent extraction.
        $claimed = DocumentUpload::whereKey($this->uploadId)
            ->whereIn('processing_status', [DocumentUpload::STATUS_QUEUED, DocumentUpload::STATUS_FAILED])
            ->update([
                'processing_status' => DocumentUpload::STATUS_PROCESSING,
                'processing_started_at' => now(),
                'processing_error' => null,
                'processing_completed_at' => null,
            ]);
        if (!$claimed) return;

        $upload->refresh();
        $temp = null;

        try {
            if ($upload->purpose !== 'pdf') {
                $this->markCompleted($upload, PdfExtractorService::emptyMetadata(), 'full_document', ['No metadata extraction is needed for this file type.']);
                $notifier->completed($upload->refresh());
                return;
            }

            $temp = $encryptor->decryptToTemp($upload->path);
            if (!$temp) {
                throw new \RuntimeException('The stored document could not be opened for extraction.');
            }

            try {
                $result = $extractor->extractPathWithSource($temp);
                $metadata = $assistant->enrich($result['metadata'], $result['source']);
                $notes = [];
                if (!array_filter($metadata)) {
                    $notes[] = 'Automatic extraction found no usable metadata. The file is stored and can be reviewed manually.';
                }
                $this->markCompleted($upload, $metadata, $result['scope'], $notes);
            } catch (ValidationException $error) {
                $message = collect($error->errors())->flatten()->first()
                    ?: 'This document cannot be processed automatically.';
                // The file is already stored, so a parser rejection is still a
                // usable upload. Expose it as "unavailable" for review instead
                // of discarding the file or retrying a permanent rejection.
                $this->markCompleted($upload, PdfExtractorService::emptyMetadata(), 'unavailable', [$message]);
            } catch (\Throwable $error) {
                Log::warning('Automatic metadata extraction unavailable.', [
                    'upload_id' => $this->uploadId,
                    'type' => get_class($error),
                ]);
                $this->markCompleted($upload, PdfExtractorService::emptyMetadata(), 'unavailable', [
                    'Automatic extraction could not read this document. The file is safe; review the details manually.',
                ]);
            }

            $notifier->completed($upload->refresh());
        } catch (\Throwable $error) {
            // Storage/decryption/database errors are genuine job failures and
            // are retried. Extraction fallbacks are handled above.
            $userMessage = 'Automatic document processing did not finish. The file is safe; retry processing or continue with manual review.';
            $this->markFailed($upload, $userMessage);
            $notifier->failed($upload->refresh(), $userMessage);
            Log::error('Upload metadata job failed.', [
                'upload_id' => $this->uploadId,
                'type' => get_class($error),
            ]);
            throw $error; // Bounded automatic retry.
        } finally {
            if ($temp && is_file($temp)) @unlink($temp);
        }
    }

    public function failed(\Throwable $exception): void
    {
        $upload = DocumentUpload::find($this->uploadId);
        if (!$upload) return;

        if (!in_array($upload->processing_status, [
            DocumentUpload::STATUS_COMPLETED,
            DocumentUpload::STATUS_FAILED,
            DocumentUpload::STATUS_SKIPPED,
        ], true)) {
            $this->markFailed($upload, 'Automatic document processing did not finish. The file is safe; retry processing or continue with manual review.');
            $upload->refresh();
        }
        app(UploadProcessingNotifier::class)->failed($upload, 'Automatic document processing did not finish.');
        Log::error('Upload metadata job permanently failed.', [
            'upload_id' => $this->uploadId,
            'type' => get_class($exception),
        ]);
    }

    private function markCompleted(DocumentUpload $upload, array $metadata, string $scope, array $notes = []): void
    {
        DocumentUpload::whereKey($this->uploadId)->update([
            'processing_status' => DocumentUpload::STATUS_COMPLETED,
            'extraction_result' => DocumentUpload::resultPayload($metadata, $scope, $notes),
            'processing_error' => null,
            'processing_completed_at' => now(),
        ]);
    }

    private function markFailed(DocumentUpload $upload, string $message): void
    {
        DocumentUpload::whereKey($this->uploadId)->update([
            'processing_status' => DocumentUpload::STATUS_FAILED,
            'processing_error' => $message,
            'processing_completed_at' => now(),
        ]);
    }
}
