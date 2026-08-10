<?php

namespace App\Console\Commands;

use App\Models\Capstone;
use App\Services\PdfTextService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class BackfillPdfText extends Command
{
    protected $signature   = 'capstones:backfill-pdf-text
                                {--force : Re-extract even if pdf_text already exists}';

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

        $this->info("Indexing PDF text for {$total} capstone(s)...");
        $bar     = $this->output->createProgressBar($total);
        $service = new PdfTextService();
        $success = 0;
        $failed  = 0;

        $bar->start();

        foreach ($capstones as $capstone) {
            try {
                if (!Storage::disk('local')->exists($capstone->pdf_path)) {
                    $this->newLine();
                    $this->warn("  Skipped [{$capstone->id}] {$capstone->title} — file not found on disk.");
                    $failed++;
                    $bar->advance();
                    continue;
                }

                $text = $service->extractFromEncryptedPath($capstone->pdf_path);

                if (empty($text)) {
                    $this->newLine();
                    $this->warn("  Skipped [{$capstone->id}] {$capstone->title} — no text extracted.");
                    $failed++;
                    $bar->advance();
                    continue;
                }

                $capstone->update(['pdf_text' => $text]);
                $success++;
            } catch (\Throwable $e) {
                $this->newLine();
                $this->error("  Error [{$capstone->id}] {$capstone->title}: " . $e->getMessage());
                $failed++;
            }

            $bar->advance();
        }

        $bar->finish();
        $this->newLine(2);
        $this->info("Done. ✅ Indexed: {$success}  ❌ Failed/Skipped: {$failed}");

        return self::SUCCESS;
    }
}
