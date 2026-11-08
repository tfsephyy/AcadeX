<?php

namespace Tests\Unit;

use App\Services\PdfExtractorService;
use App\Services\PdfMetadataSampler;
use Illuminate\Http\UploadedFile;
use Tests\Support\MetadataPdfFixture;
use Tests\TestCase;

class BoundedMetadataExtractionTest extends TestCase
{
    public function test_text_metadata_stops_after_front_matter_and_retains_source_fields(): void
    {
        $this->mock(\App\Services\BoundedPdfOcr::class)->shouldNotReceive('extract');
        $path = tempnam(sys_get_temp_dir(), 'acadex-frontmatter-');
        try {
            MetadataPdfFixture::write($path, 0, 150, 'Alex Example');
            $extractor = new class extends PdfExtractorService {
                protected function extractPagesViaOcr(string $path): array
                {
                    throw new \RuntimeException('Readable PDF must not invoke OCR for sparse remaining pages.');
                }
            };
            $result = $extractor->extractPathWithSource($path);
            self::assertSame('first_12_pages', $result['scope']);
            self::assertStringContainsString('Synthetic page 12', $result['source']);
            self::assertStringNotContainsString('Synthetic page 13', $result['source']);
            self::assertSame('Alex Example', $result['metadata']['adviser_name']);
            self::assertSame('SYNTHETIC CAMPUS ARCHIVE SYSTEM', $result['metadata']['title']);
        } finally { unlink($path); }
    }

    public function test_abstract_wording_is_preserved_and_keywords_use_only_source_terms(): void
    {
        $body = 'This study records of3.48 and theimprove ments exactly as printed in the PDF. It describes a web application without declaring keywords.';
        $extractor = new class($body) extends PdfExtractorService {
            public function __construct(private string $body) {}
            protected function extractRawPages(string $path): array
            {
                return ["ABSTRACT\n".$this->body."\nCHAPTER I"];
            }
        };
        $path = tempnam(sys_get_temp_dir(), 'acadex-wording-');
        try {
            file_put_contents($path, '%PDF-1.4 synthetic source');
            $data = $extractor->extractFromPath($path);
            self::assertSame($body, $data['abstract']);
            self::assertSame(['web application'], $data['keywords']);
        } finally { unlink($path); }
    }

    public function test_native_metadata_ocr_caps_pages_without_weakening_the_existing_safety_limit(): void
    {
        $args = \App\Services\BoundedPdfOcr::renderCommand('gs', 'synthetic.pdf', 'page.png', 12);
        self::assertContains('-dLastPage=12', $args);
        self::assertContains('-dLastPage=30', \App\Services\BoundedPdfOcr::renderCommand('gs', 'synthetic.pdf', 'page.png', 999));
    }

    public function test_ocr_wording_is_preserved_and_missing_abstract_is_not_inferred_from_body_text(): void
    {
        $body = 'This study preserves data such as syst0m and a1pha without replacing letters or adding summaries. '.str_repeat('Synthetic document body text. ', 5);
        $extractor = new class($body) extends PdfExtractorService {
            public function __construct(private string $body) {}
            protected function extractRawPages(string $path): array { return ['CamScanner']; }
            protected function extractPagesViaOcr(string $path): array
            {
                return ["Header one\nHeader two\nHeader three\n".$this->body];
            }
        };
        $path = tempnam(sys_get_temp_dir(), 'acadex-no-inference-');
        try {
            file_put_contents($path, '%PDF-1.4 synthetic');
            $result = $extractor->extractPathWithSource($path);
            self::assertStringEndsWith(trim($body), trim($result['source']));
            self::assertNull($result['metadata']['abstract']);
            foreach ($result['metadata']['keywords'] as $keyword) self::assertStringContainsString($keyword, mb_strtolower($result['source']));
        } finally { unlink($path); }
    }

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
        $handle = fopen($source->getRealPath(), 'r+b');
        fwrite($handle, '%PDF-1.4');
        ftruncate($handle, 100 * 1024 * 1024);
        fclose($handle);
        try {
            $data = (new PdfExtractorService())->extract($source);
            self::assertSame('SYNTHETIC CAMPUS ARCHIVE SYSTEM', $data['title']);
            self::assertSame('Alex Example, Jamie Sample', $data['author']);
            self::assertSame(2026, $data['year']);
            self::assertSame('BSIT', $data['program']);
            self::assertStringContainsString('synthetic document archive', $data['abstract']);
            self::assertContains('document management', $data['keywords']);
            self::assertNotContains('education', $data['keywords']);
            self::assertSame(1, $sampler->calls);
            self::assertFileDoesNotExist($sample);
        } finally { if (is_file($sample)) unlink($sample); }
    }
}
