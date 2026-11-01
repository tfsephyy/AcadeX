<?php

namespace Tests\Unit;

use App\Services\PdfExtractorService;
use App\Services\PdfMetadataSampler;
use Illuminate\Http\UploadedFile;
use Tests\Support\MetadataPdfFixture;
use Tests\TestCase;

class BoundedMetadataExtractionTest extends TestCase
{
    public function test_watermark_only_results_do_not_become_fake_title_or_author_suggestions(): void
    {
        $extractor = new class extends PdfExtractorService {
            protected function extractRawPages(string $filePath): array { return ['CamScanner']; }
            protected function extractPagesViaOcr(string $filePath): array { return ['CamScanner']; }
        };
        $data = $extractor->extract(UploadedFile::fake()->createWithContent('scan.pdf', '%PDF-1.4'));
        self::assertNull($data['title']);
        self::assertNull($data['author']);
        self::assertSame([], $data['author_details']);
    }

    public function test_large_pdf_uses_a_bounded_sample_and_fills_metadata_without_parsing_original(): void
    {
        $sample = tempnam(sys_get_temp_dir(), 'acadex-sample-');
        MetadataPdfFixture::write($sample);
        $sampler = new class($sample) {
            public int $calls = 0;
            public function __construct(private string $path) {}
            public function create(UploadedFile $source): string { $this->calls++; return $this->path; }
        };
        $this->app->instance(PdfMetadataSampler::class, $sampler);
        // Empty original cannot produce metadata. Only the valid bounded sample can.
        $source = UploadedFile::fake()->create('large.pdf', 100 * 1024, 'application/pdf');
        try {
            $data = (new PdfExtractorService())->extract($source);
            self::assertSame('SYNTHETIC CAMPUS ARCHIVE SYSTEM', $data['title']);
            self::assertSame('Alex Example, Jamie Sample', $data['author']);
            self::assertSame(2026, $data['year']);
            self::assertSame('BSIT', $data['program']);
            self::assertStringContainsString('synthetic document archive', $data['abstract']);
            self::assertContains('education', $data['keywords']);
            self::assertSame(1, $sampler->calls);
            self::assertFileDoesNotExist($sample);
        } finally { if (is_file($sample)) unlink($sample); }
    }
}
