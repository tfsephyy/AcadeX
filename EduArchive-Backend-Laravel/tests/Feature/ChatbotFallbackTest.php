<?php

namespace Tests\Feature;

use Illuminate\Http\Client\Request as HttpClientRequest;
use Illuminate\Support\Facades\Http;
use Tests\SecurityTestCase;

class ChatbotFallbackTest extends SecurityTestCase
{
    public function test_chatbot_uses_groq_primary_and_returns_verified_suggestions(): void
    {
        $student = $this->user('student');
        $cap = $this->capstone($student, [
            'title'              => 'Automated Hydroponics Monitoring System',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'published',
        ]);

        config([
            'services.groq.key'     => 'gsk_test_primary_key',
            'services.groq.model'   => 'openai/gpt-oss-120b',
            'services.gemini.key'   => 'AIza_test_fallback_key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
        ]);

        Http::fake([
            'api.groq.com/*' => Http::response([
                'choices' => [
                    [
                        'message' => [
                            'content' => "Based on the archive, check out **Automated Hydroponics Monitoring System** [ID:{$cap->id}].",
                        ],
                    ],
                ],
            ], 200),
            'generativelanguage.googleapis.com/*' => Http::response([], 500),
        ]);

        $this->asUser($student);
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Find capstones about hydroponics',
        ])->assertOk();

        self::assertSame('groq', $response->json('data.provider'));
        self::assertStringContainsString('Automated Hydroponics Monitoring System', $response->json('data.reply'));
        self::assertSame($cap->id, $response->json('data.suggested_capstones.0.id'));
        Http::assertSentCount(1);
    }

    public function test_chatbot_falls_back_to_gemini_when_groq_fails(): void
    {
        $student = $this->user('student');
        $cap = $this->capstone($student, [
            'title'              => 'Solar Powered Water Purifier',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'published',
        ]);

        config([
            'services.groq.key'     => 'gsk_test_primary_key',
            'services.groq.model'   => 'openai/gpt-oss-120b',
            'services.gemini.key'   => 'AIza_test_fallback_key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
        ]);

        Http::fake([
            'api.groq.com/*' => Http::response(['error' => 'Service overloaded'], 503),
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => "Gemini found **Solar Powered Water Purifier** [ID:{$cap->id}]."],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $this->asUser($student);
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Find solar water capstones',
        ])->assertOk();

        self::assertSame('gemini', $response->json('data.provider'));
        self::assertStringContainsString('Solar Powered Water Purifier', $response->json('data.reply'));
        self::assertSame($cap->id, $response->json('data.suggested_capstones.0.id'));
        Http::assertSentCount(2);
    }

    public function test_chatbot_falls_back_to_local_php_response_when_both_ai_providers_fail(): void
    {
        $student = $this->user('student');

        config([
            'services.groq.key'   => 'gsk_test_primary_key',
            'services.gemini.key' => 'AIza_test_fallback_key',
        ]);

        Http::fake([
            'api.groq.com/*'                      => Http::response('Error', 500),
            'generativelanguage.googleapis.com/*' => Http::response('Error', 503),
        ]);

        $this->asUser($student);
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'What is IMRAD?',
        ])->assertOk();

        self::assertSame('local', $response->json('data.provider'));
        self::assertNotEmpty($response->json('data.reply'));
        self::assertStringContainsString('IMRAD', $response->json('data.reply'));
    }

    public function test_chatbot_enforces_permission_gate_before_calling_external_ai(): void
    {
        $student = $this->user('student');

        config([
            'services.groq.key'   => 'gsk_test_primary_key',
            'services.gemini.key' => 'AIza_test_fallback_key',
        ]);

        Http::fake();

        $this->asUser($student);
        $response = $this->postJson('/api/v1/chatbot/message', [
            'message' => 'Show recent login activity',
        ])->assertOk();

        self::assertStringContainsString('administrators', $response->json('data.reply'));
        Http::assertNothingSent();
    }

    public function test_visitor_imrad_only_capstone_does_not_leak_pdf_text_to_ai_prompt(): void
    {
        $owner = $this->user('student');
        $visitor = $this->user('visitor');

        $cap = $this->capstone($owner, [
            'title'              => 'IMRAD Only Research Project',
            'status'             => 'approved',
            'approval_status'    => 'approved',
            'publication_status' => 'unpublished',
            'copyright_status'   => null,
            'imrad_path'         => 'imrad/sample.enc',
            'pdf_text'           => 'SECRET_FULL_PDF_BODY_TEXT_DO_NOT_LEAK',
        ]);

        config([
            'services.groq.key'   => 'gsk_test_primary_key',
            'services.gemini.key' => '',
        ]);

        Http::fake([
            'api.groq.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => "Summary of **IMRAD Only Research Project** [ID:{$cap->id}]."]],
                ],
            ], 200),
        ]);

        $this->asUser($visitor);
        $this->postJson('/api/v1/chatbot/message', [
            'message'     => 'What is this capstone about?',
            'capstone_id' => $cap->id,
        ])->assertOk();

        Http::assertSent(function (HttpClientRequest $request) {
            return !str_contains($request->body(), 'SECRET_FULL_PDF_BODY_TEXT_DO_NOT_LEAK');
        });
    }
}
