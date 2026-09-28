<?php

namespace App\Console\Commands;

use App\Jobs\ExtractPdfTextJob;
use App\Models\Capstone;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackfillPdfText extends Command
{
    protected $signature   = 'capstones:backfill-pdf-text
                                {--force : Re-extract even if pdf_text already exists}
                                {--sync : Run synchronously instead of queuing}';

    protected $description = 'Extract PDF text from all uploaded capstones and store it in the database for chatbot use.';

    public function handle(): int
    {
        $query = Capstone::whereNotNull('pdf_path');

        if (!$this->option('force')) {
            $query->whereNull('pdf_text');
        }

        $capstones = $query->get(['id', 'title', 'pdf_path']);
        $total     = $capstones->count();

        if ($total === 0) {
            $this->info('All capstones already have pdf_text indexed. Use --force to re-extract.');
            return self::SUCCESS;
        }

        $useQueue = !$this->option('sync');

        if ($useQueue) {
            $this->info("Queueing {$total} PDF extraction job(s)...");
            $this->info("Run 'php artisan queue:work' to process them.");
        } else {
            $this->info("Processing {$total} capstone(s) synchronously...");
        }

        $queued  = 0;
        $skipped = 0;

        foreach ($capstones as $capstone) {
            if (!Storage::disk('local')->exists($capstone->pdf_path)) {
                $this->warn("  Skipped [{$capstone->id}] {$capstone->title} — file not found.");
                $skipped++;
                continue;
            }

            if ($useQueue) {
                ExtractPdfTextJob::dispatch($capstone->id);
                $queued++;
            } else {
                // Synchronous fallback for testing
                $this->info("  Processing [{$capstone->id}] {$capstone->title}...");
                try {
                    ExtractPdfTextJob::dispatchSync($capstone->id);
                    $queued++;
                } catch (\Throwable $e) {
                    $this->error("  Error: " . $e->getMessage());
                    $skipped++;
                }
            }
        }

        $this->newLine();
        $this->info("Done. ✅ Queued/Processed: {$queued}  ⏭️  Skipped: {$skipped}");

        if ($useQueue) {
            $this->warn("Remember to run: php artisan queue:work");
        }

        return self::SUCCESS;
    }
}
