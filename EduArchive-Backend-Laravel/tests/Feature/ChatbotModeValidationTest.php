<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use Tests\SecurityTestCase;

class ChatbotModeValidationTest extends SecurityTestCase
{
    public function test_rejects_invalid_mode(): void
    {
        $user = $this->user('student');
        $this->asUser($user);

        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Hello',
            'mode' => 'invalid_mode',
        ]);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['mode']);
    }

    public function test_rejects_invalid_action(): void
    {
        $user = $this->user('student');
        $this->asUser($user);

        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Hello',
            'action' => 'destroy_database',
        ]);
        $response->assertStatus(422);
        $response->assertJsonValidationErrors(['action']);
    }

    public function test_pdf_only_mode_without_capstone_returns_helpful_guidance(): void
    {
        $user = $this->user('student');
        $this->asUser($user);

        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Who authored this?',
            'mode' => 'pdf_only',
            'capstone_id' => null,
        ]);
        $response->assertOk();
        $response->assertJsonPath('data.mode', 'smart');
        $this->assertStringContainsString('No capstone PDF is currently open', $response->json('data.reply'));
    }

    public function test_accepts_valid_modes(): void
    {
        $user = $this->user('student');
        $this->asUser($user);

        foreach (['smart', 'general'] as $validMode) {
            $response = $this->postJson('/api/v1/chatbot/message', [
                'message' => 'Hello assistant',
                'mode' => $validMode,
            ]);
            $response->assertOk();
            $response->assertJsonPath('data.mode', $validMode);
        }
    }
}
