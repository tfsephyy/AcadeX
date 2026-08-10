<?php

namespace App\Console\Commands;

use App\Models\Capstone;
use App\Services\PdfEncryptorService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Storage;

class EncryptExistingPdfs extends Command
{
    protected $signature   = 'pdfs:encrypt-existing {--dry-run : List files without encrypting}';
    protected $description = 'Re-encrypt all unencrypted PDFs and resource files stored on disk (one-time migration).';

    public function handle(): int
    {
        $encryptor = new PdfEncryptorService();
        $isDryRun  = $this->option('dry-run');

        if (!$isDryRun) {
            $this->warn('⚠️  This will encrypt all plain PDF/resource files on disk. Make sure you have a backup!');
            if (!$this->confirm('Do you want to continue?')) {
                $this->info('Aborted.');
                return self::FAILURE;
            }
        }

        $this->info('Scanning capstone PDF files...');
        $capstonePaths = Capstone::whereNotNull('pdf_path')->pluck('pdf_path');

        $done = 0;
        $skipped = 0;

        foreach ($capstonePaths as $path) {
            if (!Storage::disk('local')->exists($path)) {
                $this->warn("  MISSING: {$path}");
                $skipped++;
                continue;
            }

            if ($isDryRun) {
                $this->line("  [dry-run] Would encrypt: {$path}");
                $done++;
                continue;
            }

            $result = $encryptor->reEncryptPlainFile($path);
            if ($result) {
                $this->line("  ✓ Encrypted: {$path}");
                $done++;
            } else {
                $this->line("  ↷ Already encrypted (skipped): {$path}");
                $skipped++;
            }
        }

        // Also scan resource files
        $this->info('Scanning resource files...');
        $resourceFiles = Storage::disk('local')->allFiles('capstone_resources');

        foreach ($resourceFiles as $path) {
            if ($isDryRun) {
                $this->line("  [dry-run] Would encrypt resource: {$path}");
                $done++;
                continue;
            }

            $result = $encryptor->reEncryptPlainFile($path);
            if ($result) {
                $this->line("  ✓ Encrypted resource: {$path}");
                $done++;
            } else {
                $this->line("  ↷ Already encrypted (skipped): {$path}");
                $skipped++;
            }
        }

        $this->info('');
        $this->info("Done. Processed: {$done}  |  Skipped: {$skipped}");

        return self::SUCCESS;
    }
}
