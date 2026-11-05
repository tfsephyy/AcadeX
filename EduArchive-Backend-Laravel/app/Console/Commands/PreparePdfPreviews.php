<?php
namespace App\Console\Commands;

use Illuminate\Console\Command;
use App\Models\Capstone;
use App\Services\PdfPreviewService;

class PreparePdfPreviews extends Command
{
    protected $signature = 'acadex:prepare-pdf-previews {--limit=0 : Maximum number of existing capstones to prepare}';
    protected $description = 'Prepare private encrypted web previews while retaining original uploaded PDFs.';

    public function handle(PdfPreviewService $service): int
    {
        $prepared = 0; $unavailable = 0;
        $query = Capstone::withoutGlobalScopes()->whereNotNull('pdf_path')->orderBy('id');
        if ((int)$this->option('limit') > 0) $query->limit((int)$this->option('limit'));
        foreach ($query->cursor() as $capstone) {
            if ($service->prepare($capstone->pdf_path)) $prepared++; else $unavailable++;
        }
        $this->info("Previews ready: {$prepared}; unavailable: {$unavailable}. Originals retained.");
        return $unavailable ? self::FAILURE : self::SUCCESS;
    }
}
