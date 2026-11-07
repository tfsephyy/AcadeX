<?php

namespace App\Console\Commands;

use App\Models\UploadTransfer;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

class PruneUploadTransfers extends Command
{
    protected $signature = 'acadex:prune-upload-transfers';
    protected $description = 'Remove expired temporary upload chunks; retain staged documents and capstones';

    public function handle(): int
    {
        UploadTransfer::where('expires_at', '<=', now())->select('id')->chunkById(100, function ($rows) {
            foreach ($rows as $row) DB::transaction(function () use ($row) {
                $transfer = UploadTransfer::whereKey($row->id)->where('expires_at', '<=', now())->lockForUpdate()->first();
                if (!$transfer) return;
                Storage::disk('local')->delete(array_column($transfer->chunks, 'path'));
                $transfer->delete();
            });
        });
        $this->info('Expired temporary transfers removed.');
        return self::SUCCESS;
    }
}
