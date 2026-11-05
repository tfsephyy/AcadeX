<?php

namespace App\Services;

use App\Models\DocumentUpload;
use App\Models\Notification;
use Illuminate\Support\Facades\Log;

/** Creates deduplicated in-app status notifications for background uploads. */
class UploadProcessingNotifier
{
    public function completed(DocumentUpload $upload): void
    {
        $this->send($upload, true, null);
    }

    public function failed(DocumentUpload $upload, string $message): void
    {
        $this->send($upload, false, $message);
    }

    private function send(DocumentUpload $upload, bool $success, ?string $error): void
    {
        try {
            $key = 'upload_processing:'.$upload->id.':'.($success ? 'completed' : 'failed');
            Notification::firstOrCreate(
                ['dedupe_key' => $key],
                [
                    'admin_id' => $upload->user_id,
                    'type' => $success ? 'upload_processing_completed' : 'upload_processing_failed',
                    'title' => $success ? 'Document processing completed' : 'Document processing failed',
                    'message' => $success
                        ? 'Your document was processed. Review the extracted details before submitting the capstone.'
                        : 'Your document could not be processed automatically. The file is safe; you can retry from the upload window.'.($error ? ' '.$error : ''),
                    'related_upload_id' => $upload->id,
                    'is_read' => false,
                ]
            );
        } catch (\Throwable $error) {
            Log::warning('Upload processing notification could not be stored.', ['type' => get_class($error)]);
        }
    }
}
