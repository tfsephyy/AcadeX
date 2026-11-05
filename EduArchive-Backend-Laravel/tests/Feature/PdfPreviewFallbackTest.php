<?php
namespace Tests\Feature;

use App\Services\PdfEncryptorService;
use App\Services\PdfPreviewService;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class PdfPreviewFallbackTest extends SecurityTestCase
{
    public function test_missing_preview_dependency_retains_original_and_original_viewing(): void
    {
        config(['acadex.qpdf_binary' => '/not-installed/qpdf']);
        $path='capstones/synthetic-preview.enc';
        app(PdfEncryptorService::class)->encryptRawAndStore($path,'%PDF-1.4 synthetic original');
        $before=hash_file('sha256',Storage::disk('local')->path($path));
        $service=app(PdfPreviewService::class);
        self::assertFalse($service->prepare($path));
        self::assertSame($before,hash_file('sha256',Storage::disk('local')->path($path)));
        $doc=$service->openForViewing($path);
        self::assertNotNull($doc);$doc->close();
        self::assertFalse(Storage::disk('local')->exists($service->previewPath($path)));
    }
}
