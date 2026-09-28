<?php

namespace App\Jobs;

use App\Models\Capstone;
use App\Services\PdfTextService;
use Illuminate\Bus\Queueable;
use Illuminate\Contracts\Queue\ShouldQueue;
use Illuminate\Foundation\Bus\Dispatchable;
use Illuminate\Queue\InteractsWithQueue;
use Illuminate\Queue\SerializesModels;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;

class ExtractPdfTextJob implements ShouldQueue
{
    use Dispatchable, InteractsWithQueue, Queueable, SerializesModels;

    public int $timeout = 600; // 10 minutes max per PDF
    public int $tries = 2;

    public function __construct(
        public int $capstoneId
    ) {}

    public function handle(PdfTextService $service): void
    {
        $capstone = Capstone::find($this->capstoneId);

        if (!$capstone || !$capstone->pdf_path) {
            Log::warning("ExtractPdfTextJob: Capstone {$this->capstoneId} not found or has no PDF.");
            return;
        }

        if (!Storage::disk('local')->exists($capstone->pdf_path)) {
            Log::warning("ExtractPdfTextJob: PDF file not found for capstone {$this->capstoneId}");
            return;
        }

        try {
            $text = $service->extractFromEncryptedPath($capstone->pdf_path);

            if (!empty($text)) {
                $capstone->update([
                    'pdf_text' => $text,
                    'pdf_text_indexed_at' => now(),
                ]);
                Log::info("ExtractPdfTextJob: Successfully extracted text for capstone {$this->capstoneId}");
            } else {
                Log::warning("ExtractPdfTextJob: No text extracted for capstone {$this->capstoneId}");
            }
        } catch (\Throwable $e) {
            Log::error("ExtractPdfTextJob failed for capstone {$this->capstoneId}: {$e->getMessage()}");
            throw $e; // Re-throw to trigger retry
        }
    }

    public function failed(\Throwable $exception): void
    {
        Log::error("ExtractPdfTextJob permanently failed for capstone {$this->capstoneId}: {$exception->getMessage()}");
    }
}
