<?php

namespace Tests\Unit;

use App\Services\Chatbot\PdfPassageRetriever;
use Tests\TestCase;

class PdfPassageRetrieverTest extends TestCase
{
    private PdfPassageRetriever $retriever;

    protected function setUp(): void
    {
        parent::setUp();
        $this->retriever = new PdfPassageRetriever();
    }

    public function test_extract_pages_parses_delimited_pages(): void
    {
        $text = "--- [PAGE:1] ---\nFirst page title and introduction.\n--- [PAGE:2] ---\nMethodology and hardware setup.\n--- [PAGE:3] ---\nResults and discussion.";
        $pages = $this->retriever->extractPages($text);

        $this->assertCount(3, $pages);
        $this->assertSame(1, $pages[0]['page']);
        $this->assertStringContainsString('First page title', $pages[0]['text']);
        $this->assertSame(2, $pages[1]['page']);
        $this->assertStringContainsString('Methodology', $pages[1]['text']);
        $this->assertSame(3, $pages[2]['page']);
        $this->assertStringContainsString('Results', $pages[2]['text']);
    }

    public function test_extract_pages_fallback_on_unindexed_text(): void
    {
        $text = "Plain unindexed document without delimiter marks.";
        $pages = $this->retriever->extractPages($text);

        $this->assertCount(1, $pages);
        $this->assertSame(1, $pages[0]['page']);
        $this->assertSame($text, $pages[0]['text']);
    }

    public function test_extract_query_terms_filters_stopwords_and_punctuation(): void
    {
        $query = "What is the deep learning methodology for crop disease detection?!";
        $terms = $this->retriever->extractQueryTerms($query);

        $this->assertContains('deep', $terms);
        $this->assertContains('learning', $terms);
        $this->assertContains('methodology', $terms);
        $this->assertContains('crop', $terms);
        $this->assertContains('disease', $terms);
        $this->assertContains('detection', $terms);

        $this->assertNotContains('what', $terms);
        $this->assertNotContains('is', $terms);
        $this->assertNotContains('the', $terms);
        $this->assertNotContains('for', $terms);
    }

    public function test_retrieve_context_prioritizes_high_scoring_tail_pages_within_budget(): void
    {
        // Construct document where Page 1 has filler text, Page 2 has irrelevant text,
        // and Page 3 has highly relevant methodology and hardware terms
        $page1Text = str_repeat("General introduction to institutional research policies and formatting guidelines. ", 30);
        $page2Text = str_repeat("Administrative overview and historical background of the department. ", 30);
        $page3Text = "Methodology: We developed an IoT edge node utilizing an ESP32 microcontroller with DHT22 humidity sensor and MQTT telemetry protocol.";

        $fullDoc = "--- [PAGE:1] ---\n{$page1Text}\n--- [PAGE:2] ---\n{$page2Text}\n--- [PAGE:3] ---\n{$page3Text}";

        // Budget that fits Page 3 plus at most one large page
        $context = $this->retriever->retrieveContext($fullDoc, "ESP32 DHT22 sensor microcontroller methodology", 2500);

        // Page 3 must be present in the retrieved context because its relevance score is highest
        $this->assertStringContainsString('[PAGE:3]', $context);
        $this->assertStringContainsString('ESP32 microcontroller', $context);
    }

    public function test_retrieve_context_returns_pages_in_document_order(): void
    {
        $page1Text = "Objectives and background problem statement for smart agriculture.";
        $page2Text = "Methodology and experimental design using sensor arrays.";
        $page3Text = "Results: Evaluation demonstrated 98% accuracy.";

        $fullDoc = "--- [PAGE:1] ---\n{$page1Text}\n--- [PAGE:2] ---\n{$page2Text}\n--- [PAGE:3] ---\n{$page3Text}";

        $context = $this->retriever->retrieveContext($fullDoc, "smart agriculture methodology sensor accuracy", 5000);

        $posPage1 = strpos($context, '[PAGE:1]');
        $posPage2 = strpos($context, '[PAGE:2]');
        $posPage3 = strpos($context, '[PAGE:3]');

        $this->assertNotFalse($posPage1);
        $this->assertNotFalse($posPage2);
        $this->assertNotFalse($posPage3);
        $this->assertTrue($posPage1 < $posPage2);
        $this->assertTrue($posPage2 < $posPage3);
    }
}
