<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Services\Chatbot\ChatbotAiService;
use App\Services\Chatbot\ChatbotQueryService;
use Tests\SecurityTestCase;

class ChatbotMultiTurnAndGroundingTest extends SecurityTestCase
{
    public function test_chatbot_resolves_referenced_capstone_from_conversation_history(): void
    {
        $student = $this->user('student');
        $capstone = $this->capstone($student, [
            'title'              => 'Automated Aquaponics Water Monitoring',
            'author'             => 'Alex Rivera',
            'year'               => 2026,
            'program'            => 'BS Information Technology',
            'category'           => 'Internet of Things',
            'abstract'           => 'This paper presents an automated water quality system using IoT sensors.',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'published',
        ]);

        $this->asUser($student);

        // Turn 2: User references "the first one" without sending capstone_id directly in the request
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message'              => 'Tell me more about the first one',
            'conversation_history' => [
                ['role' => 'user', 'content' => 'Find capstones about aquaponics'],
                ['role' => 'assistant', 'content' => "I found 1 capstone project:\n\n**1. Automated Aquaponics Water Monitoring** [ID:{$capstone->id}]"],
            ],
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');
        $this->assertNotEmpty($reply);
        $this->assertStringContainsString('Automated Aquaponics Water Monitoring', $reply);
        $this->assertSame($capstone->id, $response->json('data.suggested_capstones.0.id'));
    }

    public function test_chatbot_provides_targeted_field_answers(): void
    {
        $student = $this->user('student');
        $capstone = $this->capstone($student, [
            'title'              => 'AI-Powered Crop Yield Predictor',
            'author'             => 'Elena Ramos, Carlos Reyes',
            'year'               => 2025,
            'program'            => 'BS Computer Science',
            'category'           => 'Artificial Intelligence',
            'abstract'           => 'Machine learning models predicting rice crop yield from meteorological data.',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'published',
        ]);

        $this->asUser($student);

        // 1. Author inquiry
        $resAuthor = $this->postJson('/api/v1/chatbot/message', [
            'message'     => 'Who is the author of this capstone?',
            'capstone_id' => $capstone->id,
        ])->assertOk();
        $this->assertStringContainsString('Elena Ramos, Carlos Reyes', $resAuthor->json('data.reply'));

        // 2. Year inquiry
        $resYear = $this->postJson('/api/v1/chatbot/message', [
            'message'     => 'What year was this capstone submitted?',
            'capstone_id' => $capstone->id,
        ])->assertOk();
        $this->assertStringContainsString('2025', $resYear->json('data.reply'));

        // 3. Program inquiry
        $resProgram = $this->postJson('/api/v1/chatbot/message', [
            'message'     => 'What program is this project for?',
            'capstone_id' => $capstone->id,
        ])->assertOk();
        $this->assertStringContainsString('BS Computer Science', $resProgram->json('data.reply'));
    }

    public function test_page_citations_are_sanitized_against_actual_document_pages(): void
    {
        $student = $this->user('student');
        $capstone = $this->capstone($student, [
            'title'              => 'Two Page Research Report',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'published',
            'pdf_text'           => "--- [PAGE:1] ---\nTitle and introduction.\n--- [PAGE:2] ---\nMethodology and findings.",
        ]);

        $aiService = app(ChatbotAiService::class);

        // AI generated a valid [PAGE:2] citation and a hallucinated [PAGE:99] citation
        $aiReply = "The system achieved 95% accuracy [PAGE:2]. Extra details are listed in [PAGE:99].";

        $sanitized = $aiService->sanitizePageCitations($aiReply, $capstone);

        // Valid page citation preserved
        $this->assertStringContainsString('[PAGE:2]', $sanitized);
        // Hallucinated page citation stripped
        $this->assertStringNotContainsString('[PAGE:99]', $sanitized);
    }

    public function test_chatbot_query_service_enforces_visitor_access_boundaries(): void
    {
        $owner = $this->user('student');
        $visitor = $this->user('visitor');

        // Unpublished, non-copyrighted capstone with no IMRAD
        $restrictedCap = $this->capstone($owner, [
            'title'              => 'Restricted Internal Prototype',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'unpublished',
            'copyright_status'   => null,
            'imrad_path'         => null,
        ]);

        $querySvc = app(ChatbotQueryService::class);

        // Visitor must NOT be able to find the restricted capstone via search
        $visitorSearch = $querySvc->search('visitor', 'Restricted Internal Prototype', [], $visitor);
        $this->assertTrue($visitorSearch->isEmpty());

        // Visitor must NOT be able to find it via findById
        $visitorDirect = $querySvc->findById('visitor', $restrictedCap->id, $visitor);
        $this->assertNull($visitorDirect);

        // Authenticated student CAN find the approved capstone
        $studentDirect = $querySvc->findById('student', $restrictedCap->id, $owner);
        $this->assertNotNull($studentDirect);
        $this->assertSame($restrictedCap->id, $studentDirect->id);
    }
}
