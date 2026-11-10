<?php

namespace Tests\Feature;

use App\Models\Capstone;
use Tests\SecurityTestCase;

class ChatbotResearchGapsTest extends SecurityTestCase
{
    private Capstone $capstone;

    protected function setUp(): void
    {
        parent::setUp();
        $user = $this->user('student');
        $this->asUser($user);

        $this->capstone = Capstone::create([
            'title' => 'Deep Learning Plant Disease Detection via Mobile App',
            'author' => 'Ana Reyes, Carlos Gomez',
            'year' => 2026,
            'program' => 'BS Computer Science',
            'category' => 'Artificial Intelligence',
            'abstract' => 'This capstone presents a lightweight convolutional neural network running on edge mobile devices to detect tomato leaf blight.',
            'status' => 'approved',
            'approval_status' => 'approved',
            'is_published' => true,
            'uploaded_by' => $user->id,
            'pdf_path' => 'capstones/synthetic-leaf.pdf.enc',
            'pdf_text' => "--- [PAGE:1] ---\nDeep Learning Plant Disease Detection on Mobile Edge Devices.\n\n--- [PAGE:5] ---\nScope and Limitations: The model dataset was limited to 500 controlled greenhouse images of tomato leaves and requires adequate daytime lighting.",
            'pdf_text_indexed_at' => now(),
        ]);
    }

    public function test_gaps_action_separates_documented_limitations_from_ai_suggestions(): void
    {
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'What are the research gaps and limitations of this capstone?',
            'action' => 'gaps',
            'capstone_id' => $this->capstone->id,
            'mode' => 'smart',
        ]);

        $response->assertOk();
        $reply = $response->json('data.reply');

        // Must separate documented limitations from AI suggestions
        $this->assertStringContainsString('Documented Limitations', $reply);
        $this->assertStringContainsString('Suggested', $reply);
        // Must cite the limitation page from the document
        $this->assertStringContainsString('[PAGE:5]', $reply);
        $this->assertStringContainsString('greenhouse', $reply);
    }
}
