<?php

namespace App\Console\Commands;

use App\Models\DocumentUpload;
use App\Models\UploadTransfer;
use App\Models\User;
use App\Services\DocumentUploads;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class PruneStagedUploads extends Command
{
    protected $signature = 'acadex:prune-staged-uploads';
    protected $description = 'Remove expired unsubmitted staged uploads and their encrypted files; retain claimed and active uploads';

    public function handle(): int
    {
        $pruned = 0;

        DocumentUpload::whereNull('capstone_id')
            ->where('expires_at', '<=', now())
            ->select(['id', 'user_id'])
            ->chunkById(100, function ($rows) use (&$pruned) {
                foreach ($rows as $row) {
                    $deletedPath = null;

                    DB::transaction(function () use ($row, &$deletedPath, &$pruned) {
                        // Match allocation/submission lock order to avoid deadlocks.
                        if (!User::whereKey($row->user_id)->lockForUpdate()->first()) return;

                        $upload = DocumentUpload::whereKey($row->id)
                            ->whereNull('capstone_id')
                            ->where('expires_at', '<=', now())
                            ->lockForUpdate()
                            ->first();

                        if (!$upload) return;

                        // Skip active extractions started within the last 15 minutes.
                        if ($upload->processing_status === DocumentUpload::STATUS_PROCESSING
                            && $upload->processing_started_at
                            && $upload->processing_started_at->isAfter(now()->subMinutes(15))) {
                            return;
                        }

                        // Never delete if any capstone or resource references this path.
                        $path = $upload->path;
                        if (app(DocumentUploads::class)->isPathReferenced($path)) {
                            Log::warning("PruneStagedUploads: Staged upload [{$upload->id}] path is referenced by a capstone or resource; skipping deletion.", [
                                'upload_id' => $upload->id,
                                'path' => $path,
                            ]);
                            return;
                        }

                        // Collect transfer chunk files pointing to this upload.
                        $transfers = UploadTransfer::where('upload_id', $upload->id)->lockForUpdate()->get();
                        $deletedChunkFiles = [];
                        foreach ($transfers as $transfer) {
                            if (!empty($transfer->chunks)) {
                                $deletedChunkFiles = array_merge($deletedChunkFiles, array_column($transfer->chunks, 'path'));
                            }
                        }

                        // Remove chunk files before deleting the upload, which cascades
                        // its transfer rows and their chunk-path metadata.
                        $disk = Storage::disk('local');
                        $existingChunkFiles = array_values(array_filter($deletedChunkFiles, fn ($path) => $disk->exists($path)));
                        if ($existingChunkFiles && !$disk->delete($existingChunkFiles)) {
                            Log::warning("PruneStagedUploads: Could not remove transfer chunks for upload [{$upload->id}]; leaving the upload for a later retry.", [
                                'upload_id' => $upload->id,
                            ]);
                            return;
                        }

                        if (!$upload->delete()) {
                            Log::warning("PruneStagedUploads: Could not remove staged upload row [{$upload->id}].", [
                                'upload_id' => $upload->id,
                            ]);
                            return;
                        }

                        $deletedPath = $path;
                        $pruned++;
                    });

                    // Delete storage files after transaction
                    $disk = Storage::disk('local');
                    if ($deletedPath && $disk->exists($deletedPath) && !$disk->delete($deletedPath)) {
                        Log::warning("PruneStagedUploads: Could not remove encrypted file for upload [{$row->id}].", [
                            'upload_id' => $row->id,
                        ]);
                    }
                }
            });

        $this->info("Expired staged uploads removed ({$pruned}).");
        return self::SUCCESS;
    }
}
