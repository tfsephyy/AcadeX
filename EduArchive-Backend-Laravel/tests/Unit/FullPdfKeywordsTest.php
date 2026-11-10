<?php

namespace Tests\Unit;

use App\Services\{BoundedPdfOcr, PdfExtractorService, PdfMetadataSampler};
use App\Services\Extraction\{FullPdfTextReader, PdfPageReader};
use Tests\Support\MetadataPdfFixture;
use Tests\TestCase;

class FullPdfKeywordsTest extends TestCase
{
    public function test_actual_middle_chapter_terms_beat_front_matter_and_last_pages_without_changing_other_metadata(): void
    {
        $this->mock(BoundedPdfOcr::class)->shouldNotReceive('extract');
        $path = tempnam(sys_get_temp_dir(), 'acadex-full-keywords-');
        try {
            MetadataPdfFixture::write($path, 0, 150, 'Alex Example', [
                64 => array_fill(0, 12, 'Questionnaire data analysis MySQL Laravel usability testing'),
                110 => array_fill(0, 6, 'Questionnaire MySQL'),
            ]);
            $read = (new PdfPageReader())->read($path);
            self::assertCount(150, $read['all']);
            self::assertTrue($read['complete']);
            $result = (new PdfExtractorService())->extractPathWithSource($path);
            self::assertSame(['mysql', 'questionnaire'], array_slice($result['metadata']['keywords'], 0, 2));
            foreach (['data analysis', 'laravel', 'usability testing'] as $term) self::assertContains($term, $result['metadata']['keywords']);
            self::assertSame('SYNTHETIC CAMPUS ARCHIVE SYSTEM', $result['metadata']['title']);
            self::assertSame('Alex Example', $result['metadata']['adviser_name']);
            self::assertSame('first_12_pages', $result['scope']);
            self::assertStringNotContainsString('Questionnaire', $result['source']);
            self::assertContains('Keywords were ranked by frequency across the whole PDF (150 pages).', $result['notes']);
        } finally { unlink($path); }
    }

    public function test_middle_image_page_uses_native_ocr_and_missing_coverage_is_disclosed(): void
    {
        $finder = new \Symfony\Component\Process\ExecutableFinder();
        $gs = $finder->find('gs') ?: $finder->find('gswin64c') ?: (glob('C:/Program Files/gs/gs*/bin/gswin64c.exe')[0] ?? null);
        $tess = $finder->find('tesseract') ?: (is_file('C:/Program Files/Tesseract-OCR/tesseract.exe') ? 'C:/Program Files/Tesseract-OCR/tesseract.exe' : null);
        if (!$gs || !$tess) {
            self::markTestSkipped('Native OCR binaries (Ghostscript/Tesseract) are unavailable on this host.');
        }

        $path = tempnam(sys_get_temp_dir(), 'acadex-middle-scan-');
        try {
            MetadataPdfFixture::write($path, 0, 40, null, [20 => []]);
            $this->mock(BoundedPdfOcr::class)->shouldReceive('extract')->once()
                ->withArgs(fn ($gs, $tess, $pdf, $psm, $count, $first, $seconds) => $pdf === $path && $count === 1 && $first === 20 && $seconds > 0)
                ->andReturn([str_repeat('random sampling ', 8)]);
            $result = (new PdfExtractorService())->extractPathWithSource($path);
            self::assertSame('random sampling', $result['metadata']['keywords'][0]);
            self::assertContains('Keywords were ranked by frequency across the whole PDF (40 pages).', $result['notes']);
        } finally { unlink($path); }
    }

    public function test_large_text_pass_reads_every_page_and_cleans_its_private_files(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'acadex-large-text-');
        try {
            MetadataPdfFixture::write($path, 0, 40, null, [20 => array_fill(0, 9, 'System design research methodology')]);
            $read = (new FullPdfTextReader())->read($path);
            if (!$read['complete']) self::markTestSkipped('Native Ghostscript text reader is unavailable on this host.');
            self::assertCount(40, $read['pages']);
            self::assertStringContainsString('System design', $read['pages'][19]->text());
            config(['acadex.max_automatic_extraction_bytes' => 100]);
            $this->mock(PdfMetadataSampler::class)->shouldReceive('create')->once()->andThrow(new \RuntimeException('No sampler'));
            $result = (new PdfExtractorService())->extractPathWithSource($path);
            self::assertContains('research methodology', $result['metadata']['keywords']);
            self::assertSame('unavailable', $result['scope']);
            self::assertContains('Keywords were ranked by frequency across the whole PDF (40 pages).', $result['notes']);
        } finally { unlink($path); }
    }

    public function test_unreadable_middle_page_keeps_other_fields_and_warns_about_incomplete_keywords(): void
    {
        $finder = new \Symfony\Component\Process\ExecutableFinder();
        $gs = $finder->find('gs') ?: $finder->find('gswin64c') ?: (glob('C:/Program Files/gs/gs*/bin/gswin64c.exe')[0] ?? null);
        $tess = $finder->find('tesseract') ?: (is_file('C:/Program Files/Tesseract-OCR/tesseract.exe') ? 'C:/Program Files/Tesseract-OCR/tesseract.exe' : null);
        if (!$gs || !$tess) {
            self::markTestSkipped('Native OCR binaries (Ghostscript/Tesseract) are unavailable on this host.');
        }

        $path = tempnam(sys_get_temp_dir(), 'acadex-incomplete-keywords-');
        try {
            MetadataPdfFixture::write($path, 0, 40, 'Alex Example', [20 => []]);
            $this->mock(BoundedPdfOcr::class)->shouldReceive('extract')->once()->andReturn(['']);
            $result = (new PdfExtractorService())->extractPathWithSource($path);
            self::assertSame('SYNTHETIC CAMPUS ARCHIVE SYSTEM', $result['metadata']['title']);
            self::assertContains('document management', $result['metadata']['keywords']);
            self::assertContains('Full-PDF keyword reading was incomplete. Suggestions use the readable pages; review or add keywords manually.', $result['notes']);
        } finally { unlink($path); }
    }

    public function test_native_text_reader_retains_blank_pages_for_later_ocr(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'acadex-blank-keywords-');
        try {
            MetadataPdfFixture::write($path, 0, 40, null, [20 => []]);
            $read = (new FullPdfTextReader())->read($path);
            if (!$read['complete']) self::markTestSkipped('Native Ghostscript text reader is unavailable on this host.');
            self::assertCount(40, $read['pages']);
            self::assertSame(20, $read['pages'][19]->number);
            self::assertSame('', trim($read['pages'][19]->text()));
        } finally { unlink($path); }
    }
}
