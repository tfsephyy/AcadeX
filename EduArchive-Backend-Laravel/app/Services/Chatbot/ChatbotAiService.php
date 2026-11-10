<?php

namespace App\Services\Chatbot;

use App\Models\Capstone;
use App\Models\User;
use App\Services\CapstoneAccess;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

class ChatbotAiService
{
    private const GROQ_API_URL        = 'https://api.groq.com/openai/v1/chat/completions';
    private const DEFAULT_GROQ_MODEL  = 'openai/gpt-oss-120b';
    private const GEMINI_API_BASE     = 'https://generativelanguage.googleapis.com/v1beta/models';
    private const DEFAULT_GEMINI_MODEL = 'gemini-3.5-flash-lite';

    /**
     * Generate a chatbot response using Groq as primary and Google Gemini as fallback.
     * Returns null if neither provider is configured or if both fail.
     *
     * @param  string         $userMessage
     * @param  array          $conversationHistory
     * @param  Capstone|null  $openCapstone
     * @param  Collection     $searchResults
     * @param  string         $role
     * @param  User|null      $user
     * @param  string         $referenceContext
     * @return array{reply: string, suggested_capstones: array, provider: string}|null
     */
    public function generateResponse(
        string $userMessage,
        array $conversationHistory,
        ?Capstone $openCapstone,
        Collection $searchResults,
        string $role,
        ?User $user = null,
        string $referenceContext = '',
        string $mode = 'smart',
        ?string $action = null,
        ?Capstone $compareCapstone = null
    ): ?array {
        $groqKey   = $this->cleanKey(config('services.groq.key'));
        $geminiKey = $this->cleanKey(config('services.gemini.key'));

        if ($groqKey === null && $geminiKey === null) {
            return null;
        }

        $systemPrompt = $this->buildSystemPrompt(
            $openCapstone,
            $searchResults,
            $role,
            $user,
            $referenceContext,
            $userMessage,
            $mode ?? 'smart',
            $action,
            $compareCapstone
        );

        $reply    = null;
        $provider = null;

        // 1. Primary: Groq API
        if ($groqKey !== null) {
            $groqModel = trim((string) config('services.groq.model')) ?: self::DEFAULT_GROQ_MODEL;
            $reply     = $this->callGroq($groqKey, $groqModel, $systemPrompt, $conversationHistory, $userMessage);
            if ($reply !== null) {
                $provider = 'groq';
            } else {
                Log::warning('Chatbot Groq primary failed; falling back to Gemini.');
            }
        }

        // 2. Secondary / Fallback: Google Gemini API
        if ($reply === null && $geminiKey !== null) {
            $geminiModel = trim((string) config('services.gemini.model')) ?: self::DEFAULT_GEMINI_MODEL;
            $reply       = $this->callGemini($geminiKey, $geminiModel, $systemPrompt, $conversationHistory, $userMessage);
            if ($reply !== null) {
                $provider = 'gemini';
            } else {
                Log::warning('Chatbot Gemini fallback also failed; falling back to local deterministic response.');
            }
        }

        if ($reply === null || $provider === null) {
            return null;
        }

        $suggestedCapstones = $this->extractVerifiedSuggestions($reply, $openCapstone, $searchResults);

        return [
            'reply'               => $reply,
            'suggested_capstones' => $suggestedCapstones,
            'provider'            => $provider,
        ];
    }

    private function callGroq(
        string $apiKey,
        string $model,
        string $systemPrompt,
        array $conversationHistory,
        string $userMessage
    ): ?string {
        $messages = [['role' => 'system', 'content' => $systemPrompt]];

        foreach ($conversationHistory as $turn) {
            if (!isset($turn['role'], $turn['content'])) {
                continue;
            }
            $turnRole = $turn['role'] === 'assistant' ? 'assistant' : 'user';
            $messages[] = [
                'role'    => $turnRole,
                'content' => (string) $turn['content'],
            ];
        }

        $messages[] = ['role' => 'user', 'content' => $userMessage];

        try {
            $response = Http::withToken($apiKey)
                ->timeout(25)
                ->post(self::GROQ_API_URL, [
                    'model'       => $model,
                    'messages'    => $messages,
                    'temperature' => 0.2,
                    'max_tokens'  => 1400,
                ]);

            if ($response->failed()) {
                Log::warning('Groq API HTTP error', [
                    'status' => $response->status(),
                    'model'  => $model,
                ]);
                return null;
            }

            $content = trim((string) ($response->json('choices.0.message.content') ?? ''));
            return $content !== '' ? $content : null;
        } catch (\Throwable $e) {
            Log::warning('Groq API exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function callGemini(
        string $apiKey,
        string $model,
        string $systemPrompt,
        array $conversationHistory,
        string $userMessage
    ): ?string {
        $contents = [];

        foreach ($conversationHistory as $turn) {
            if (!isset($turn['role'], $turn['content'])) {
                continue;
            }
            $geminiRole = $turn['role'] === 'assistant' ? 'model' : 'user';
            $contents[] = [
                'role'  => $geminiRole,
                'parts' => [['text' => (string) $turn['content']]],
            ];
        }

        $contents[] = [
            'role'  => 'user',
            'parts' => [['text' => $userMessage]],
        ];

        $modelPath = str_starts_with($model, 'models/') ? substr($model, 7) : $model;
        $url = self::GEMINI_API_BASE . '/' . rawurlencode($modelPath) . ':generateContent?key=' . urlencode($apiKey);

        try {
            $response = Http::timeout(25)->post($url, [
                'systemInstruction' => [
                    'parts' => [['text' => $systemPrompt]],
                ],
                'contents' => $contents,
                'generationConfig' => [
                    'temperature'     => 0.2,
                    'maxOutputTokens' => 1400,
                ],
            ]);

            if ($response->failed()) {
                Log::warning('Gemini API HTTP error', [
                    'status' => $response->status(),
                    'model'  => $modelPath,
                ]);
                return null;
            }

            $parts = $response->json('candidates.0.content.parts') ?? [];
            $textChunks = [];
            foreach ($parts as $part) {
                if (isset($part['text']) && is_string($part['text'])) {
                    $textChunks[] = $part['text'];
                }
            }

            $content = trim(implode("\n", $textChunks));
            return $content !== '' ? $content : null;
        } catch (\Throwable $e) {
            Log::warning('Gemini API exception', ['error' => $e->getMessage()]);
            return null;
        }
    }

    private function buildSystemPrompt(
        ?Capstone $openCapstone,
        Collection $searchResults,
        string $role,
        ?User $user,
        string $referenceContext,
        string $userMessage = '',
        string $mode = 'smart',
        ?string $action = null,
        ?Capstone $compareCapstone = null
    ): string {
        $blocks = [];

        if ($openCapstone) {
            $keywords = $openCapstone->relationLoaded('keywords')
                ? $openCapstone->keywords->pluck('name')->join(', ')
                : '';

            $canReadFullText = $this->canIncludeDocumentText($role, $user, $openCapstone);
            $docText = '';
            if ($canReadFullText && !empty(trim($openCapstone->pdf_text ?? ''))) {
                $retriever = app(PdfPassageRetriever::class);
                $docText = $retriever->retrieveContext($openCapstone->pdf_text, $userMessage, 7500);
            }

            $openBlock = [
                "CURRENTLY OPEN CAPSTONE:",
                "ID: {$openCapstone->id}",
                "Title: {$openCapstone->title} [ID:{$openCapstone->id}]",
                "Author(s): {$openCapstone->author}",
                "Year: {$openCapstone->year}",
                "Program: " . ($openCapstone->program ?? 'N/A'),
                "Category: " . ($openCapstone->category ?? 'N/A'),
                "Keywords: " . ($keywords ?: 'None'),
                "Abstract:\n" . ($openCapstone->abstract ?? 'No abstract available.'),
            ];

            if ($docText !== '') {
                $openBlock[] = "Extracted Document Excerpt:\n" . $docText;
            }

            $blocks[] = implode("\n", $openBlock);
        }

        if ($searchResults->isNotEmpty()) {
            $rows = [];
            foreach ($searchResults as $c) {
                $kw = ($c instanceof Capstone && $c->relationLoaded('keywords'))
                    ? $c->keywords->pluck('name')->join(', ')
                    : '';
                $abstract = mb_substr(trim((string) ($c->abstract ?? '')), 0, 400);
                $rows[] = implode("\n", array_filter([
                    "- [ID:{$c->id}] \"{$c->title}\" ({$c->year}) by {$c->author}",
                    "  Program: " . ($c->program ?? 'N/A') . " | Category: " . ($c->category ?? 'N/A'),
                    $kw !== '' ? "  Keywords: {$kw}" : null,
                    $abstract !== '' ? "  Abstract: {$abstract}" : null,
                ]));
            }
            $blocks[] = "MATCHING ARCHIVE CAPSTONES:\n" . implode("\n\n", $rows);
        }

        if (trim($referenceContext) !== '') {
            $blocks[] = "VERIFIED REPOSITORY DATA / ANALYTICS:\n" . trim($referenceContext);
        }

        $contextData = !empty($blocks)
            ? implode("\n\n════════════════════════════════════════\n\n", $blocks)
            : 'No specific capstone records matched this query.';

        $modeRules = match ($mode) {
            'pdf_only' => <<<RULES
ACTIVE MODE: PDF ONLY MODE.
You must answer SOLELY using the CURRENTLY OPEN CAPSTONE document excerpt below.
1. ONLY include facts, findings, and statements explicitly supported by the document excerpt below.
2. For EVERY statement or fact derived from the document, include the exact page citation in the format [PAGE:n] (e.g. [PAGE:2]).
3. NEVER invent page numbers or citations.
4. If the requested information is not mentioned in the document excerpt below, you MUST explicitly state: "This information is not mentioned in the document."
5. DO NOT use general AI knowledge to fill missing information. DO NOT cite or mix other capstones.
RULES,
            'general' => <<<RULES
ACTIVE MODE: GENERAL AI MODE.
1. Act as a comprehensive academic, programming, and technical research assistant.
2. Answer questions about technology, algorithms, research methodology, and programming directly and helpfully.
3. You are not restricted to repository capstone records.
RULES,
            default => <<<RULES
ACTIVE MODE: SMART MODE (Context-Aware Academic Assistant).
1. If the user asks about the currently open capstone, its methodology, authors, abstract, or findings, answer directly from that open capstone's record and cite page numbers using [PAGE:n].
2. If the user asks general programming, technology, or research concept questions (e.g. "What is React?"), provide a clear, helpful explanation.
3. When combining document facts with general explanations, clearly distinguish them (e.g., prefix with "**From the Document [PAGE:n]:**" vs "**Technical Explanation:**").
RULES,
        };

        if ($action === 'summary') {
            $modeRules .= "\n\n" . <<<SUMMARY_RULES
ACTION INSTRUCTION: ACADEMIC SUMMARY.
Provide a clear, structured summary with these exact headings:
- **Objectives:** Key problem and research goals.
- **Methodology:** Research design, procedures, architecture, or hardware/software stack.
- **Technologies Used:** Programming languages, frameworks, libraries, hardware, or tools.
- **Major Findings & Results:** Key evaluation metrics, outcomes, or conclusions.
- **Document Limitations:** Documented constraints or scope.
Only include information supported by the document and cite pages [PAGE:n] where applicable.
SUMMARY_RULES;
        }

        if ($action === 'gaps') {
            $modeRules .= "\n\n" . <<<GAPS_RULES
ACTION INSTRUCTION: RESEARCH GAPS & IMPROVEMENTS.
You must strictly separate:
1. **Documented Limitations (from PDF [PAGE:n]):** Documented boundaries, constraints, or sample limits found in the text.
2. **AI-Suggested Future Directions:** Potential research improvements or extensions suggested by the AI.
NEVER present speculative improvements as confirmed weaknesses of the paper.
GAPS_RULES;
        }

        return <<<PROMPT
You are AcaBot (EduBot), the intelligent academic research assistant for AcadeX (Mindanao State University's Capstone Research Archive).
Current user role: {$role}.

{$modeRules}

STRICT GENERAL RULES:
1. Rely ONLY on the verified database records and repository data provided below when citing capstones, authors, statistics, or counts.
2. NEVER invent or hallucinate capstone titles, authors, IDs, or statistics that are not present in the context below.
3. Whenever you mention a capstone from the database records below, include its tag in the exact format [ID:123] (or [LINK:123] when linking a title) so the interface can display clickable capstone cards.
4. Format responses clearly using concise Markdown (bold headings, bullet points). Keep answers helpful, accurate, and academic.

--- VERIFIED DATABASE CONTEXT ---
{$contextData}
--- END OF CONTEXT ---
PROMPT;
    }

    private function canIncludeDocumentText(string $role, ?User $user, Capstone $capstone): bool
    {
        if ($role === ChatbotPermissionService::ROLE_VISITOR) {
            return app(CapstoneAccess::class)->visitorCanViewDocument($capstone);
        }
        if ($user !== null) {
            return app(CapstoneAccess::class)->view($user, $capstone);
        }
        return true;
    }

    private function extractVerifiedSuggestions(
        string $reply,
        ?Capstone $openCapstone,
        Collection $searchResults
    ): array {
        $allowedMap = [];

        if ($openCapstone && $openCapstone->id) {
            $allowedMap[(int) $openCapstone->id] = $this->formatSuggestionCard($openCapstone);
            if ($openCapstone->relationLoaded('referencedCapstones')) {
                foreach ($openCapstone->referencedCapstones as $ref) {
                    if ($ref instanceof Capstone && $ref->id) {
                        $allowedMap[(int) $ref->id] = $this->formatSuggestionCard($ref);
                    }
                }
            }
        }

        foreach ($searchResults as $cap) {
            if ($cap instanceof Capstone && $cap->id) {
                $allowedMap[(int) $cap->id] = $this->formatSuggestionCard($cap);
            }
        }

        if (empty($allowedMap)) {
            return [];
        }

        preg_match_all('/\[(?:ID|LINK):(\d+)\]/', $reply, $matches);
        $mentionedIds = array_unique(array_map('intval', $matches[1] ?? []));

        $suggestions = [];
        foreach ($mentionedIds as $id) {
            if (isset($allowedMap[$id])) {
                $suggestions[] = $allowedMap[$id];
            }
        }

        return $suggestions;
    }

    private function formatSuggestionCard(Capstone $capstone): array
    {
        return [
            'id'      => (int) $capstone->id,
            'title'   => (string) $capstone->title,
            'author'  => (string) $capstone->author,
            'year'    => $capstone->year,
            'program' => (string) ($capstone->program ?? ''),
        ];
    }

    private function cleanKey(mixed $key): ?string
    {
        if (!is_string($key)) {
            return null;
        }
        $trimmed = trim($key);
        if ($trimmed === '' || in_array($trimmed, ['your_groq_api_key_here', 'your_gemini_api_key_here'], true) || str_starts_with($trimmed, '<')) {
            return null;
        }
        return $trimmed;
    }
}
