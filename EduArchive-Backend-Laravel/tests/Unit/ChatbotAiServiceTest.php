<?php

namespace Tests\Unit;

use App\Models\Capstone;
use App\Services\Chatbot\ChatbotAiService;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Tests\TestCase;

class ChatbotAiServiceTest extends TestCase
{
    private function makeCapstone(int $id, string $title): Capstone
    {
        $c = new Capstone([
            'title'    => $title,
            'author'   => 'Juan Dela Cruz',
            'year'     => 2026,
            'program'  => 'BSIT',
            'category' => 'AI/ML',
            'abstract' => 'A study on ' . $title,
        ]);
        $c->id = $id;
        $c->setRelation('keywords', collect());
        return $c;
    }

    public function test_uses_groq_as_primary_when_configured_and_healthy(): void
    {
        config([
            'services.groq.key'     => 'gsk_test_primary_key',
            'services.groq.model'   => 'openai/gpt-oss-120b',
            'services.gemini.key'   => 'AIza_test_fallback_key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
        ]);

        Http::fake([
            'api.groq.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => 'Groq answered about **Smart Campus** [ID:10].']],
                ],
            ], 200),
            'generativelanguage.googleapis.com/*' => Http::response([], 500),
        ]);

        $cap = $this->makeCapstone(10, 'Smart Campus');
        $service = new ChatbotAiService();
        $result = $service->generateResponse(
            'Tell me about Smart Campus',
            [],
            null,
            new Collection([$cap]),
            'student'
        );

        self::assertNotNull($result);
        self::assertSame('groq', $result['provider']);
        self::assertStringContainsString('Groq answered about **Smart Campus**', $result['reply']);
        self::assertCount(1, $result['suggested_capstones']);
        self::assertSame(10, $result['suggested_capstones'][0]['id']);

        Http::assertSentCount(1);
    }

    public function test_falls_back_to_gemini_when_groq_returns_error(): void
    {
        config([
            'services.groq.key'     => 'gsk_test_primary_key',
            'services.groq.model'   => 'openai/gpt-oss-120b',
            'services.gemini.key'   => 'AIza_test_fallback_key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
        ]);

        Http::fake([
            'api.groq.com/*' => Http::response(['error' => ['message' => 'Rate limit exceeded']], 429),
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => 'Gemini fallback answered about **Crop Disease Detection** [ID:25].'],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $cap = $this->makeCapstone(25, 'Crop Disease Detection');
        $service = new ChatbotAiService();
        $result = $service->generateResponse(
            'Find agriculture capstones',
            [['role' => 'user', 'content' => 'Hi'], ['role' => 'assistant', 'content' => 'Hello!']],
            null,
            new Collection([$cap]),
            'student'
        );

        self::assertNotNull($result);
        self::assertSame('gemini', $result['provider']);
        self::assertStringContainsString('Gemini fallback answered', $result['reply']);
        self::assertCount(1, $result['suggested_capstones']);
        self::assertSame(25, $result['suggested_capstones'][0]['id']);

        Http::assertSentCount(2);
    }

    public function test_falls_back_to_gemini_when_groq_key_is_missing(): void
    {
        config([
            'services.groq.key'     => '',
            'services.gemini.key'   => 'AIza_test_fallback_key',
            'services.gemini.model' => 'gemini-3.5-flash-lite',
        ]);

        Http::fake([
            'generativelanguage.googleapis.com/*' => Http::response([
                'candidates' => [
                    [
                        'content' => [
                            'parts' => [
                                ['text' => 'Direct Gemini answer.'],
                            ],
                        ],
                    ],
                ],
            ], 200),
        ]);

        $service = new ChatbotAiService();
        $result = $service->generateResponse(
            'What is IMRAD?',
            [],
            null,
            new Collection(),
            'student'
        );

        self::assertNotNull($result);
        self::assertSame('gemini', $result['provider']);
        self::assertSame('Direct Gemini answer.', $result['reply']);
        Http::assertSentCount(1);
    }

    public function test_returns_null_when_both_groq_and_gemini_fail_or_are_unconfigured(): void
    {
        config([
            'services.groq.key'   => '',
            'services.gemini.key' => '',
        ]);

        Http::fake();

        $service = new ChatbotAiService();
        $result = $service->generateResponse('Hello', [], null, new Collection(), 'student');
        self::assertNull($result);
        Http::assertNothingSent();

        config([
            'services.groq.key'   => 'gsk_test_key',
            'services.gemini.key' => 'AIza_test_key',
        ]);

        Http::fake([
            'api.groq.com/*'                      => Http::response('Server Error', 500),
            'generativelanguage.googleapis.com/*' => Http::response('Service Unavailable', 503),
        ]);

        $resultBothFailed = $service->generateResponse('Hello', [], null, new Collection(), 'student');
        self::assertNull($resultBothFailed);
    }

    public function test_filters_suggested_capstone_ids_to_allowed_context_only(): void
    {
        config([
            'services.groq.key'   => 'gsk_test_primary_key',
            'services.gemini.key' => '',
        ]);

        Http::fake([
            'api.groq.com/*' => Http::response([
                'choices' => [
                    ['message' => ['content' => 'Allowed [ID:10] and hallucinated/unauthorized [ID:999].']],
                ],
            ], 200),
        ]);

        $allowedCap = $this->makeCapstone(10, 'Allowed Capstone');
        $service = new ChatbotAiService();
        $result = $service->generateResponse(
            'Show capstones',
            [],
            null,
            new Collection([$allowedCap]),
            'visitor'
        );

        self::assertNotNull($result);
        self::assertCount(1, $result['suggested_capstones']);
        self::assertSame(10, $result['suggested_capstones'][0]['id']);
    }
}
