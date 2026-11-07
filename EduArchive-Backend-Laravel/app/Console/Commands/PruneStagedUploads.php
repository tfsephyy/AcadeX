<?php

namespace App\Console\Commands;

use App\Models\Capstone;
use App\Models\CapstoneResource;
use App\Models\DocumentUpload;
use App\Models\UploadTransfer;
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
            ->select('id')
            ->chunkById(100, function ($rows) use (&$pruned) {
                foreach ($rows as $row) {
                    $deletedPath = null;
                    $deletedChunkFiles = [];

                    DB::transaction(function () use ($row, &$deletedPath, &$deletedChunkFiles, &$pruned) {
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
                        $isReferenced = Capstone::where('pdf_path', $path)
                            ->orWhere('imrad_path', $path)
                            ->exists()
                            || CapstoneResource::where('file_path', $path)->exists();

                        if ($isReferenced) {
                            Log::warning("PruneStagedUploads: Staged upload [{$upload->id}] path is referenced by a capstone or resource; skipping deletion.", [
                                'upload_id' => $upload->id,
                                'path' => $path,
                            ]);
                            return;
                        }

                        // Collect transfer chunk files pointing to this upload.
                        $transfers = UploadTransfer::where('upload_id', $upload->id)->lockForUpdate()->get();
                        foreach ($transfers as $transfer) {
                            if (!empty($transfer->chunks)) {
                                $deletedChunkFiles = array_merge($deletedChunkFiles, array_column($transfer->chunks, 'path'));
                            }
                        }

                        $deletedPath = $path;
                        $upload->delete();
                        $pruned++;
                    });

                    // Delete storage files after transaction
                    $disk = Storage::disk('local');
                    if (!empty($deletedChunkFiles)) {
                        $disk->delete($deletedChunkFiles);
                    }
                    if ($deletedPath) {
                        $disk->delete($deletedPath);
                    }
                }
            });

        $this->info("Expired staged uploads removed ({$pruned}).");
        return self::SUCCESS;
    }
}
