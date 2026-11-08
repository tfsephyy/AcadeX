<?php

namespace Tests\Unit;

use App\Services\Extraction\{KeywordExtractor, MetadataDocument};
use Tests\TestCase;

class TechnicalKeywordExtractorTest extends TestCase
{
    public function test_general_words_are_excluded_even_when_repeated_or_explicitly_labelled(): void
    {
        $source = str_repeat('Education students community school helps records results testing useful. ', 30)
            ."\nKeywords: Education, Community, Students, LARAVEL, React, react, MySQL, Database Management, PDF Extraction, OCR, Web Development";
        $keywords = (new KeywordExtractor())->extract(MetadataDocument::fromTexts([$source]), 'Laravel repository', 'React and MySQL');
        foreach (['education', 'students', 'community', 'school', 'testing', 'useful', 'records', 'results'] as $general) self::assertNotContains($general, $keywords);
        foreach (['laravel', 'react', 'mysql', 'database management', 'pdf extraction', 'ocr', 'web development'] as $technical) self::assertContains($technical, $keywords);
        self::assertSame(count($keywords), count(array_unique($keywords)));
        self::assertLessThanOrEqual(15, count($keywords));
    }

    public function test_fewer_terms_are_not_padded_and_word_boundaries_prevent_substring_matches(): void
    {
        $source = 'A reactive community likes theatrical performances, relational friendships and maternal care.';
        self::assertSame([], (new KeywordExtractor())->extract(MetadataDocument::fromTexts([$source]), null, null));
        self::assertSame(['laravel'], (new KeywordExtractor())->extract(MetadataDocument::fromTexts(['Laravel LARAVEL laravel']), null, null));
        self::assertSame(['c++', 'c#'], (new KeywordExtractor())->extract(MetadataDocument::fromTexts(['C++ and C#']), null, null));
    }

    public function test_frequency_is_primary_and_title_abstract_relevance_breaks_ties(): void
    {
        $title = 'Laravel';
        $abstract = 'Laravel';
        $source = "Laravel Laravel\nPython\n".str_repeat('MySQL ', 8);
        $keywords = (new KeywordExtractor())->extract(MetadataDocument::fromTexts([$source]), $title, $abstract);
        self::assertSame(['mysql', 'laravel', 'python'], $keywords);
        self::assertNotContains('react', $keywords);
    }

    public function test_research_terms_in_middle_pages_are_ranked_without_inventing_filler(): void
    {
        $document = new MetadataDocument([
            \App\Services\Extraction\DocumentPage::fromText('Laravel', 1),
            \App\Services\Extraction\DocumentPage::fromText(str_repeat('questionnaire data analysis capstone project ', 10), 64),
        ]);
        $keywords = (new KeywordExtractor())->extract($document, 'Laravel', null);
        self::assertSame(['capstone project', 'data analysis', 'capstone', 'questionnaire', 'laravel'], $keywords);
        self::assertNotContains('research methodology', $keywords);
    }
}
