<?php

namespace Tests\Unit;

use App\Services\Extraction\{AbstractExtractor, AdviserExtractor, AuthorExtractor, ContactExtractor, DocumentPage, HeaderFooterCleaner, KeywordExtractor, MetadataDocument, MetadataPipeline, NameNormalizer, TitleExtractor, YearExtractor};
use Tests\TestCase;

class MetadataServicesTest extends TestCase
{
    private function clean(array $pages): MetadataDocument
    {
        return (new HeaderFooterCleaner())->clean(MetadataDocument::fromTexts($pages));
    }

    public function test_title_keeps_embedded_project_phrase_and_stops_at_wrapped_introduction(): void
    {
        $document = $this->clean(["ACADEX: A CAPSTONE PROJECT MINING SYSTEM\nUSING PDF DATA EXTRACTION\nA Research/Capstone\nProject\nPresented to the Faculty of\nPrepared by:\nJuan D. Dela Cruz\nOctober 2026"]);
        self::assertSame('ACADEX: A CAPSTONE PROJECT MINING SYSTEM USING PDF DATA EXTRACTION', (new TitleExtractor())->extract($document));
        self::assertSame(['Juan D. Dela Cruz'], (new AuthorExtractor())->extract($document));
        self::assertSame(2026, (new YearExtractor())->extract($document));
    }

    public function test_cleaner_uses_positions_and_repetition_without_chopping_meaningful_first_lines(): void
    {
        $pages = [];
        foreach ([1, 2, 3] as $number) {
            $text = "REPEATED DOCUMENT TITLE\n".($number === 1 ? 'Actual Capstone Title' : 'Distinct body content '.$number)."\nNovember, 2025\niv\nUniversity";
            $pages[] = DocumentPage::fromText($text, $number,
                [0 => ['y' => 780], 1 => ['y' => 650], 2 => ['y' => 70], 3 => ['y' => 25], 4 => ['y' => 10]], 800);
        }
        $clean = (new HeaderFooterCleaner())->clean(new MetadataDocument($pages));
        self::assertStringContainsString('Actual Capstone Title', $clean->firstPage());
        self::assertStringContainsString('November, 2025', $clean->firstPage());
        self::assertStringNotContainsString('REPEATED DOCUMENT TITLE', $clean->pages[1]->text());
        self::assertStringNotContainsString('University', $clean->text());
        self::assertStringNotContainsString("\niv\n", $clean->text());
        self::assertSame(1, $clean->pages[1]->lines[0]['index']);
        self::assertSame(650, $clean->pages[1]->lines[0]['y']);
        self::assertStringContainsString('University', $clean->pages[1]->rawText);
    }

    public function test_authors_are_separate_and_date_fallback_never_reads_reference_year(): void
    {
        $document = $this->clean(["A Digital Repository for 2020 Records\nA Capstone Project\nPrepared by:\nJuan D. Dela Cruz\nMaria L. Santos\nPedro R. Reyes\nMarch 15, 2023", 'References 2027']);
        self::assertSame(['Juan D. Dela Cruz', 'Maria L. Santos', 'Pedro R. Reyes'], (new AuthorExtractor())->extract($document));
        self::assertSame(2023, (new YearExtractor())->extract($document));
        self::assertNull((new YearExtractor())->extract($this->clean(['A Study About 2020 Records'])));
        self::assertSame(['Juan D. Dela Cruz', 'Maria L. Santos'], (new AuthorExtractor())->extract($this->clean([
            "A Capstone Project\nBachelor of Science in Information Technology\nJuan D. Dela Cruz\nMaria L. Santos\nDecember 2024"
        ])));
        self::assertSame([], (new AuthorExtractor())->extract($this->clean(['Byline Research System'])));
    }

    public function test_executive_summary_stops_at_each_heading_and_only_repairs_known_spacing(): void
    {
        foreach (['TABLE OF CONTENTS', 'TABLE OF CONTENT', 'TABLE OF CONTEND', 'ACKNOWLEDGEMENT', 'ACKNOWLEDGMENTS', 'ACKNOWLEDGEMENTS'] as $ending) {
            $document = $this->clean(["EXECUTIVE\nSUMMARY\nThe systemprovides access and providesweb-based informa tion technology.\nIt keeps syst0m, a1pha and API-42 exactly as printed.\n\nA second paragraph preserves meaning.\nii\n$ending\nUnrelated section must be excluded."]);
            $value = (new AbstractExtractor())->extract($document);
            self::assertStringContainsString('informa', $value);
            self::assertStringContainsString('information technology.', $value);
            self::assertStringContainsString('system provides access and provides web-based', $value);
            self::assertStringContainsString('syst0m, a1pha and API-42', $value);
            self::assertStringContainsString("\n\nA second paragraph", $value);
            self::assertStringNotContainsString('Unrelated', $value);
            self::assertStringNotContainsString($ending, $value);
        }
        self::assertNull((new AbstractExtractor())->extract($this->clean(['Body text has no reliable abstract heading.'])));
    }

    public function test_keywords_are_literal_unique_ranked_technical_terms_limited_to_fifteen(): void
    {
        $title = 'PDF extraction and metadata extraction in a digital repository';
        $abstract = 'The web-based system uses Laravel, MySQL, React, encryption, authentication and access control for information retrieval and document management, with Python, Docker, JavaScript, SQL and APIs.';
        $document = $this->clean([$title."\nEXECUTIVE SUMMARY\n".$abstract]);
        $keywords = (new KeywordExtractor())->extract($document, $title, $abstract);
        self::assertCount(15, $keywords);
        self::assertContains('pdf extraction', $keywords);
        self::assertCount(count($keywords), array_unique($keywords));
        foreach ($keywords as $keyword) self::assertStringContainsString($keyword, mb_strtolower($document->text()));
        self::assertNotContains('artificial intelligence', $keywords);
    }

    public function test_contacts_stay_inside_named_cv_profiles_and_conflicts_remain_empty(): void
    {
        $authors = ['Juan D. Dela Cruz', 'Maria L. Santos', 'Pedro R. Reyes'];
        $document = $this->clean([
            "Support: unrelated@example.invalid 09111111111",
            "CURRICULUM VITAE\nName: Juan D. Dela Cruz\nEmail: juan @example.invalid\nMobile: 0912-345-6789\nName: Someone Else\nEmail: wrong@example.invalid\nMobile: 09999999999",
            "Curriculum Vitae\nSantos, Maria L.\nEmail: maria@example.invalid\nContact: 639987654321\nCURRICULUM VITAE\nPedro R. Reyes\nEmail: first@example.invalid\nEmail: second@example.invalid",
        ]);
        $contacts = (new ContactExtractor())->extract($document, $authors);
        self::assertSame(['name' => $authors[0], 'email' => 'juan@example.invalid', 'contact' => '09123456789'], $contacts[0]);
        self::assertSame(['name' => $authors[1], 'email' => 'maria@example.invalid', 'contact' => '+639987654321'], $contacts[1]);
        self::assertSame(['name' => $authors[2], 'email' => '', 'contact' => ''], $contacts[2]);
    }

    public function test_contact_page_boundaries_and_duplicate_names_never_guess_an_owner(): void
    {
        $document = $this->clean(["CURRICULUM VITAE\nJuan Cruz", "Email: wrong@example.invalid\nMobile: 09123456789"]);
        self::assertSame('', (new ContactExtractor())->extract($document, ['Juan Cruz'])[0]['email']);
        $document = $this->clean(["CURRICULUM VITAE\nJuan Cruz\nEmail: wrong@example.invalid"]);
        self::assertSame(['', ''], array_column((new ContactExtractor())->extract($document, ['Juan Cruz', 'JUAN CRUZ']), 'email'));
    }

    public function test_normalized_names_handle_prefixes_credentials_and_surname_order_without_fuzzy_matching(): void
    {
        self::assertSame(NameNormalizer::key('Maria L. Santos'), NameNormalizer::key(' Dr. MARIA  L SANTOS, MIT '));
        self::assertSame(NameNormalizer::key('Maria L. Santos'), NameNormalizer::key('Santos, Maria L.'));
        self::assertNotSame(NameNormalizer::key('Maria L Santos'), NameNormalizer::key('Maria M Santos'));
        self::assertNotSame(NameNormalizer::key('Juan Ma'), NameNormalizer::key('Juan'));
    }

    public function test_wrapped_labels_dates_and_formatted_roman_page_numbers(): void
    {
        $document = $this->clean(["A Digital Repository\nA Capstone Project\nPrepared\nby:\nJuan D. Dela Cruz\nNovember,\n2025\n(iii)",
            "EXECUTIVE\nSUMMARY\nThe system provides secure searchable records for the academic institution.\nPage iv of ix\nTABLE OF\nCONTENTS\nUnrelated body text."]);
        self::assertSame(['Juan D. Dela Cruz'], (new AuthorExtractor())->extract($document));
        self::assertSame(2025, (new YearExtractor())->extract($document));
        self::assertSame('The system provides secure searchable records for the academic institution.', (new AbstractExtractor())->extract($document));
        self::assertStringNotContainsString('(iii)', $document->text());
        self::assertStringNotContainsString('Page iv', $document->text());
    }

    public function test_unfamiliar_repeated_header_is_removed_from_first_page_without_losing_reused_title(): void
    {
        $first = DocumentPage::fromText("Unfamiliar College Header\n\nActual Repository Title\nA Capstone Project\nby\nJuan D. Dela Cruz\nOctober 2026", 1,
            [0 => ['y' => 780], 2 => ['y' => 650]], 800);
        $pages = [$first];
        foreach ([2, 3] as $number) $pages[] = DocumentPage::fromText("Unfamiliar College Header\nUnique page content $number", $number,
            [0 => ['y' => 780], 1 => ['y' => 650]], 800);
        $clean = (new HeaderFooterCleaner())->clean(new MetadataDocument($pages));
        self::assertStringNotContainsString('Unfamiliar College Header', $clean->text());
        self::assertSame('Actual Repository Title', (new TitleExtractor())->extract($clean));
        $clean = $this->clean(["Actual Repository Title\nA Capstone Project\nby\nJuan D. Dela Cruz\nOctober 2026",
            "Actual Repository Title\nEXECUTIVE SUMMARY\nA reliable abstract contains enough useful text for extraction.",
            "Actual Repository Title\nDistinct contents text"]);
        self::assertSame('Actual Repository Title', (new TitleExtractor())->extract($clean));
        self::assertStringNotContainsString('Actual Repository Title', $clean->pages[1]->text());
    }

    public function test_failure_in_one_service_preserves_other_fields_and_raw_text_privately(): void
    {
        $this->app->instance(AbstractExtractor::class, new class extends AbstractExtractor {
            public function extract(MetadataDocument $document): ?string { throw new \RuntimeException('PRIVATE DOCUMENT TEXT'); }
        });
        $raw = "A Digital Repository\nA Capstone Project\nby\nJuan D. Dela Cruz\nOctober 2026";
        $result = app(MetadataPipeline::class)->extract(MetadataDocument::fromTexts([$raw]));
        self::assertSame('A Digital Repository', $result['metadata']['title']);
        self::assertSame('Juan D. Dela Cruz', $result['metadata']['author']);
        self::assertSame('BSIT', $result['metadata']['program']);
        self::assertNull($result['metadata']['abstract']);
        self::assertContains('Review abstract: no reliable value was found.', $result['notes']);
        self::assertStringNotContainsString('PRIVATE DOCUMENT TEXT', implode(' ', $result['notes']));
        self::assertSame($raw, $result['raw_source']);
    }
}
