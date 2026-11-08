<?php

namespace Tests\Unit;

use App\Services\PdfExtractorService;
use Tests\Support\MetadataPdfFixture;
use Tests\TestCase;

class AdviserExtractionTest extends TestCase
{
    public function test_name_above_adviser_is_read_from_a_real_approval_sheet_pdf(): void
    {
        $path = tempnam(sys_get_temp_dir(), 'acadex-adviser-');
        try {
            MetadataPdfFixture::write($path, 0, 3, 'Alex Example');
            $metadata = (new PdfExtractorService())->extractFromPath($path);
            self::assertSame('Alex Example', $metadata['adviser_name']);
            self::assertSame('SYNTHETIC CAMPUS ARCHIVE SYSTEM', $metadata['title']);
            self::assertSame('Alex Example, Jamie Sample', $metadata['author']);
        } finally { unlink($path); }
    }

    public function test_matching_uses_only_the_immediately_preceding_name_in_the_approval_section(): void
    {
        $extractor = new PdfExtractorService();
        self::assertSame('Engr. José Dela Cruz, MIT', $extractor->extractAdviserName([
            "ACKNOWLEDGMENTS\nWrong Person\nAdviser",
            "University\nAPPROVAL SHEET\nPanel Person\nPanelist\n Engr. José  Dela Cruz, MIT\n___\n\nAdviser\nDean Person\nDean",
        ]));
        self::assertNull($extractor->extractAdviserName(["ACKNOWLEDGMENTS\nWrong Person\nAdviser"]));
        self::assertNull($extractor->extractAdviserName(["APPROVAL SHEET .... iii\nWrong Person\nAdviser"]));
        self::assertNull($extractor->extractAdviserName(["APPROVAL SHEET\nSubmitted by:\nAdviser"]));
        self::assertNull($extractor->extractAdviserName(["APPROVAL SHEET", "Wrong Person\nAdviser"]));
        self::assertNull($extractor->extractAdviserName(["APPROVAL SHEET\nAdviser"]));
        self::assertSame('Dean Smith', $extractor->extractAdviserName(["APPROVAL\nSHEET\nDean Smith\nAdviser"]));
    }

    public function test_ocr_page_lines_feed_the_same_adviser_extraction(): void
    {
        $extractor = new class extends PdfExtractorService {
            protected function extractRawPages(string $path): array { return ['CamScanner']; }
            protected function extractPagesViaOcr(string $path): array
            {
                return ["Republic of the Philippines\nMindoro State University\nBongabong Oriental Mindoro\nAPPROVAL SHEET\nAlex Example\nAdviser"];
            }
        };
        $path = tempnam(sys_get_temp_dir(), 'acadex-ocr-adviser-');
        try {
            file_put_contents($path, '%PDF-1.4 synthetic OCR fixture');
            self::assertSame('Alex Example', $extractor->extractFromPath($path)['adviser_name']);
        } finally { unlink($path); }
    }
}
