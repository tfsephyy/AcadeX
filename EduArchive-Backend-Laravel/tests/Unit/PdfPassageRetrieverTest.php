<?php

namespace Tests\Unit;

use App\Services\Chatbot\PdfPassageRetriever;
use PHPUnit\Framework\TestCase;

class PdfPassageRetrieverTest extends TestCase
{
    private PdfPassageRetriever $retriever;

    protected function setUp(): void
    {
        parent::setUp();
        $this->retriever = new PdfPassageRetriever();
    }

    public function test_splits_text_by_page_markers(): void
    {
        $text = "--- [PAGE:1] ---\nFirst page introduction to inventory management.\n\n"
              . "--- [PAGE:2] ---\nSecond page discusses database normalization.\n\n"
              . "--- [PAGE:3] ---\nThird page describes React user interface.";

        $passages = $this->retriever->extractPages($text);

        $this->assertCount(3, $passages);
        $this->assertSame(1, $passages[0]['page']);
        $this->assertStringContainsString('First page introduction', $passages[0]['text']);
        $this->assertSame(2, $passages[1]['page']);
        $this->assertSame(3, $passages[2]['page']);
    }

    public function test_scores_and_ranks_passages_by_query_terms(): void
    {
        $text = "--- [PAGE:1] ---\nIntroduction to general capstone projects and acknowledgements.\n\n"
              . "--- [PAGE:2] ---\nMethodology: Agile development methodology with two-week sprints.\n\n"
              . "--- [PAGE:3] ---\nTechnologies used: Laravel 11 framework, MySQL database, and Docker containers.";

        $ranked = $this->retriever->retrieveRankedPages($text, 'What framework and database were used in this capstone?', 2);

        $this->assertNotEmpty($ranked);
        // Page 3 contains 'framework', 'database', 'Laravel', 'MySQL' and should rank #1
        $this->assertSame(3, $ranked[0]['page']);
    }

    public function test_limits_context_within_character_budget(): void
    {
        $p1 = str_repeat('A', 500);
        $p2 = str_repeat('B', 500);
        $p3 = str_repeat('C', 500);
        $text = "--- [PAGE:1] ---\nkeyword {$p1}\n\n--- [PAGE:2] ---\nkeyword {$p2}\n\n--- [PAGE:3] ---\nkeyword {$p3}";

        $context = $this->retriever->retrieveContext($text, 'keyword', 1200);

        // Budget is 1200 chars, so 3 pages (~1600 chars) cannot all fit, only top pages fit
        $this->assertLessThanOrEqual(1300, strlen($context));
        $this->assertStringContainsString('--- [PAGE:', $context);
    }

    public function test_handles_unmarked_text_gracefully(): void
    {
        $rawText = "Plain document without page delimiters discussing machine learning algorithms and random forest.";

        $passages = $this->retriever->extractPages($rawText);

        $this->assertNotEmpty($passages);
        $this->assertSame(1, $passages[0]['page']);
        $this->assertStringContainsString('Plain document without page delimiters', $passages[0]['text']);
    }

    public function test_formats_context_with_page_citations(): void
    {
        $text = "--- [PAGE:4] ---\nChapter 4: Results and Evaluation.\nPrecision was 94.2% on test dataset.";

        $context = $this->retriever->retrieveContext($text, 'precision evaluation', 2000);

        $this->assertStringContainsString('--- [PAGE:4] ---', $context);
        $this->assertStringContainsString('Precision was 94.2%', $context);
    }
}
