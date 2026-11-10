<?php

namespace Tests\Feature;

use App\Models\Capstone;
use Tests\SecurityTestCase;

class ChatbotModesExecutionTest extends SecurityTestCase
{
    private Capstone $capstone;

    protected function setUp(): void
    {
        parent::setUp();
        $user = $this->user('student');
        $this->asUser($user);

        $this->capstone = Capstone::create([
            'title' => 'Automated Smart Agriculture Monitoring System',
            'author' => 'Maria Santos, Juan Dela Cruz',
            'year' => 2026,
            'program' => 'BS Information Technology',
            'category' => 'Internet of Things',
            'abstract' => 'This study developed an IoT-based smart agricultural sensor network monitoring soil moisture and temperature.',
            'status' => 'approved',
            'approval_status' => 'approved',
            'is_published' => true,
            'uploaded_by' => $user->id,
            'pdf_path' => 'capstones/synthetic-agri.pdf.enc',
            'pdf_text' => "--- [PAGE:1] ---\nAutomated Smart Agriculture Monitoring System by Maria Santos and Juan Dela Cruz.\nAbstract: This study developed an IoT-based sensor network.\n\n--- [PAGE:2] ---\nMethodology: Hardware prototyping with ESP32 microcontrollers, DHT22 sensors, and MQTT protocol.\n\n--- [PAGE:3] ---\nResults: Soil moisture detection achieved 98.4% sensor accuracy across 30 field trials.",
            'pdf_text_indexed_at' => now(),
        ]);
    }

    public function test_pdf_only_mode_answers_from_document_with_page_citation(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'What microcontroller and sensors were used in this methodology?',
            'mode' => 'pdf_only',
            'capstone_id' => $this->capstone->id,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.mode', 'pdf_only');
        $reply = $response->json('data.reply');
        $this->assertNotEmpty($reply);
        // Fallback or AI should reference ESP32 or DHT22 and cite Page 2
        $this->assertTrue(
            str_contains($reply, 'ESP32') || str_contains($reply, '[PAGE:2]') || str_contains($reply, 'Page 2') || str_contains($reply, 'methodology')
        );
    }

    public function test_summary_action_returns_structured_academic_summary(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Summarize this capstone',
            'action' => 'summary',
            'mode' => 'pdf_only',
            'capstone_id' => $this->capstone->id,
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('Summary', $reply);
        $this->assertStringContainsString('Automated Smart Agriculture', $reply);
        $this->assertTrue(
            str_contains($reply, 'Objectives') || str_contains($reply, 'Methodology') || str_contains($reply, 'Findings')
        );
    }

    public function test_general_mode_answers_technology_question(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'What is React.js?',
            'mode' => 'general',
            'capstone_id' => $this->capstone->id,
        ]);

        $response->assertOk();
        $response->assertJsonPath('data.mode', 'general');
        $reply = $response->json('data.reply');
        $this->assertNotEmpty($reply);
        $this->assertStringContainsString('React', $reply);
    }

    public function test_pdf_only_mode_refuses_when_information_is_absent_in_document(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'What is the cryptocurrency budget and bitcoin wallet address?',
            'mode' => 'pdf_only',
            'capstone_id' => $this->capstone->id,
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertStringContainsString('could not find information', $reply);
        $this->assertStringContainsString('PDF Only Mode', $reply);
    }
}
