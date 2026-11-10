<?php

namespace Tests\Feature;

use App\Models\Capstone;
use Tests\SecurityTestCase;

class ChatbotComparisonTest extends SecurityTestCase
{
    private Capstone $capstone1;
    private Capstone $capstone2;

    protected function setUp(): void
    {
        parent::setUp();
        $user = $this->user('student');
        $this->asUser($user);

        $this->capstone1 = Capstone::create([
            'title' => 'Automated Smart Agriculture Monitoring System',
            'author' => 'Maria Santos',
            'year' => 2026,
            'program' => 'BS Information Technology',
            'category' => 'Internet of Things',
            'abstract' => 'IoT-based soil moisture sensing using ESP32.',
            'status' => 'approved',
            'approval_status' => 'approved',
            'is_published' => true,
            'uploaded_by' => $user->id,
            'pdf_path' => 'capstones/test1.pdf.enc',
            'pdf_text' => "--- [PAGE:1] ---\nSmart Agriculture using ESP32.",
            'pdf_text_indexed_at' => now(),
        ]);

        $this->capstone2 = Capstone::create([
            'title' => 'Hydroponic Nutrient Automation and Monitoring',
            'author' => 'Juan Dela Cruz',
            'year' => 2025,
            'program' => 'BS Information Technology',
            'category' => 'Internet of Things',
            'abstract' => 'Hydroponic pH and EC nutrient regulation using Raspberry Pi.',
            'status' => 'approved',
            'approval_status' => 'approved',
            'is_published' => true,
            'uploaded_by' => $user->id,
            'pdf_path' => 'capstones/test2.pdf.enc',
            'pdf_text' => "--- [PAGE:1] ---\nHydroponic Automation using Raspberry Pi.",
            'pdf_text_indexed_at' => now(),
        ]);
    }

    public function test_similar_action_finds_related_capstones_in_same_program_or_category(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Find similar capstones in the archive',
            'action' => 'similar',
            'capstone_id' => $this->capstone1->id,
            'mode' => 'smart',
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('Similar', $reply);
        $this->assertStringContainsString('Hydroponic Nutrient Automation', $reply);
        $this->assertStringContainsString("[LINK:{$this->capstone2->id}]", $reply);
    }

    public function test_compare_action_returns_structured_side_by_side_comparison(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Compare these two capstones',
            'action' => 'compare',
            'capstone_id' => $this->capstone1->id,
            'compare_capstone_id' => $this->capstone2->id,
            'mode' => 'smart',
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('Comparison', $reply);
        $this->assertStringContainsString($this->capstone1->title, $reply);
        $this->assertStringContainsString($this->capstone2->title, $reply);
        $this->assertStringContainsString('Objectives', $reply);
        $this->assertStringContainsString('Technologies', $reply);
    }
}
