<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Http;

class ChatbotController extends Controller
{
    use ApiResponses;

    private const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
    private const GROQ_MODEL   = 'llama-3.3-70b-versatile';

    /**
     * Words stripped before building DB keyword search.
     * These are too generic to be useful search terms.
     */
    private const STOP_WORDS = [
        'what','which','find','show','me','about','the','a','an','is','are','was','were',
        'do','does','can','could','would','should','have','has','had','this','that','these',
        'those','for','with','from','to','in','on','at','by','of','and','or','but','not',
        'any','all','some','tell','how','why','when','where','who','give','list','please',
        'thank','hello','hi','hey','using','used','use','look','looking','their','there',
        'here','my','your','our','its','it','they','them','also','get','want','need','help',
        'make','know','see','just','more','than','then','been','will','very','other','into',
        'such','most','after','before','between','under','over','again','further','once',
        // capstone-specific stop words (too generic for meaningful DB search)
        'capstone','capstones','research','study','studies','project','projects','thesis',
        'work','author','authors','title','year','program','category','information',
        'details','topic','topics','related','similar','tell','explain','describe',
        'open','current','this','selected','opened',
    ];

    public function message(Request $request): JsonResponse
    {
        $validated = $request->validate([
            'message'                        => 'required|string|max:2000',
            'capstone_id'                    => 'nullable|integer|exists:capstones,id',
            'conversation_history'           => 'nullable|array|max:20',
            'conversation_history.*.role'    => 'required|string|in:user,assistant',
            'conversation_history.*.content' => 'required|string|max:4000',
        ]);

        $apiKey = config('services.groq.key');
        if (empty($apiKey) || $apiKey === 'your_groq_api_key_here') {
            return $this->errorResponse('Chatbot is not configured. Please contact the administrator.', 503);
        }

        $userMessage   = $validated['message'];
        $hasOpenCapstone = !empty($validated['capstone_id']);
        $contextParts  = [];

        // ══════════════════════════════════════════════════════════════════
        // BLOCK 1 — Currently open capstone (always from DB)
        // This is available regardless of search results.
        // If the user is asking about the open capstone (authors, content,
        // abstract, methodology etc.) the AI answers from this block.
        // ══════════════════════════════════════════════════════════════════
        $openCapstone = null;
        if ($hasOpenCapstone) {
            $openCapstone = Capstone::with(['keywords', 'referencedCapstones:id,title,author,year,program'])
                ->where('is_published', true)
                ->find($validated['capstone_id']);
        }

        if ($openCapstone) {
            $keywords = $openCapstone->keywords->pluck('name')->join(', ');
            $refs     = $openCapstone->referencedCapstones->isNotEmpty()
                ? $openCapstone->referencedCapstones
                    ->map(fn($r) => "  • [ID:{$r->id}] {$r->title} ({$r->year}) by {$r->author}")
                    ->join("\n")
                : '  None listed.';

            $docText = !empty(trim($openCapstone->pdf_text ?? ''))
                ? trim($openCapstone->pdf_text)
                : '(Full document text not yet indexed. Please re-upload the PDF to enable full-text answers.)';

            $contextParts[] = <<<CAPSTONE
════════════════════════════════════════════════
 CURRENTLY OPEN CAPSTONE (from database)
════════════════════════════════════════════════
ID       : {$openCapstone->id}
Title    : {$openCapstone->title}
Author(s): {$openCapstone->author}
Year     : {$openCapstone->year}
Program  : {$openCapstone->program}
Category : {$openCapstone->category}
Keywords : {$keywords}

Abstract:
{$openCapstone->abstract}

Referenced Capstones:
{$refs}

Full Document Text (stored in database from uploaded PDF):
────────────────────────────────────────────────
{$docText}
════════════════════════════════════════════════
CAPSTONE;
        }

        // ══════════════════════════════════════════════════════════════════
        // BLOCK 2 — PHP-driven database search for archive queries
        // PHP does the searching — AI only receives the real results.
        // If searching for capstones related to the open one, we use its
        // keywords and category as search terms automatically.
        // ══════════════════════════════════════════════════════════════════
        $searchResults = $this->searchDatabase($userMessage, $openCapstone);

        if ($searchResults->isNotEmpty()) {
            $count      = $searchResults->count();
            $resultText = $searchResults->map(function ($c) {
                $kw       = $c->keywords->pluck('name')->join(', ');
                $abstract = mb_substr($c->abstract ?? '', 0, 450);
                return implode("\n", [
                    "  ---",
                    "  ID      : {$c->id}",
                    "  Title   : {$c->title}",
                    "  Author  : {$c->author}",
                    "  Year    : {$c->year}",
                    "  Program : {$c->program}",
                    "  Category: {$c->category}",
                    "  Keywords: {$kw}",
                    "  Abstract: {$abstract}",
                ]);
            })->join("\n");

            $contextParts[] = <<<LIB
════════════════════════════════════════════════
 ARCHIVE SEARCH RESULTS — {$count} real record(s) from database
 (PHP searched the database using keywords from your question)
════════════════════════════════════════════════
{$resultText}
════════════════════════════════════════════════
LIB;
        } else {
            // Fallback: give the AI the most recent capstones so it always
            // has real data when the user asks general questions.
            $recent = Capstone::with('keywords')
                ->where('is_published', true)
                ->where('is_archived', false)
                ->when($openCapstone, fn($q) => $q->where('id', '!=', $openCapstone->id))
                ->orderByDesc('year')
                ->limit(20)
                ->get(['id', 'title', 'author', 'year', 'program', 'category', 'abstract']);

            $recentText = $recent->map(function ($c) {
                $kw = $c->keywords->pluck('name')->join(', ');
                $ab = mb_substr($c->abstract ?? '', 0, 300);
                return "  [ID:{$c->id}] \"{$c->title}\" | {$c->author} | {$c->year} | {$c->program} | Keywords: {$kw} | Abstract: {$ab}";
            })->join("\n");

            $contextParts[] = <<<LIB
════════════════════════════════════════════════
 ARCHIVE — RECENT CAPSTONES (no specific keyword match found; showing latest)
════════════════════════════════════════════════
{$recentText}
════════════════════════════════════════════════
LIB;
            // Use these for ID verification later
            $searchResults = $recent;
        }

        // ══════════════════════════════════════════════════════════════════
        // BLOCK 3 — System prompt + Groq API call
        // ══════════════════════════════════════════════════════════════════
        $dbData = implode("\n\n", $contextParts);

        $hasOpenCapstoneContext = $openCapstone !== null;
        $openCapstoneNote = $hasOpenCapstoneContext
            ? "The user currently has a capstone open — answer questions about it using the CURRENTLY OPEN CAPSTONE data (authors, abstract, methodology, findings, conclusions, keywords, references, full document text — all from the database)."
            : "No capstone is currently open. Help the user find capstones from the archive using the search results.";

        $systemPrompt = <<<SYSTEM
You are EduBot, an AI assistant for EduArchive — Mindanao State University's capstone research archive.

YOUR JOB:
{$openCapstoneNote}

RULES YOU MUST FOLLOW:
1. ALL capstone data you use comes EXCLUSIVELY from the database records provided below.
2. Only reference capstones whose exact ID and title appear in the data below.
3. When citing a capstone, always include its ID like [ID:5].
4. NEVER invent capstone titles, authors, findings, or any details not present below.
5. If the user asks about the CURRENTLY OPEN CAPSTONE (authors, content, methodology, results, etc.) — answer directly from its data. Do NOT say "no capstones found."
6. If asked to find related or similar capstones, use only the archive search results below.
7. Use markdown formatting (bold, bullets) for clarity.
8. Be concise, accurate, and student-friendly.

--- DATABASE RECORDS ---

{$dbData}

--- END OF DATABASE RECORDS ---
SYSTEM;

        $messages = [['role' => 'system', 'content' => $systemPrompt]];
        foreach (($validated['conversation_history'] ?? []) as $turn) {
            $messages[] = ['role' => $turn['role'], 'content' => $turn['content']];
        }
        $messages[] = ['role' => 'user', 'content' => $userMessage];

        $response = Http::withToken($apiKey)
            ->timeout(40)
            ->post(self::GROQ_API_URL, [
                'model'       => self::GROQ_MODEL,
                'messages'    => $messages,
                'temperature' => 0.15,
                'max_tokens'  => 1400,
                'top_p'       => 0.85,
            ]);

        if ($response->failed()) {
            \Log::error('Groq API error', ['status' => $response->status(), 'body' => $response->body()]);
            return $this->errorResponse('AI service is temporarily unavailable. Please try again later.', 503);
        }

        $data  = $response->json();
        $reply = $data['choices'][0]['message']['content'] ?? null;

        if (empty($reply)) {
            return $this->errorResponse('No response from AI. Please try rephrasing your question.', 500);
        }

        // ── Build suggestion cards — only from verified DB IDs ─────────────
        preg_match_all('/\[ID:(\d+)\]/', $reply, $matches);
        $mentionedIds = array_unique(array_map('intval', $matches[1] ?? []));

        $allowedIds = $searchResults->pluck('id')->toArray();
        if ($openCapstone) {
            $allowedIds[] = $openCapstone->id;
            foreach ($openCapstone->referencedCapstones as $ref) {
                $allowedIds[] = $ref->id;
            }
        }
        $verifiedIds = array_intersect($mentionedIds, $allowedIds);

        $suggestedCapstones = [];
        if (!empty($verifiedIds)) {
            $suggestedCapstones = Capstone::whereIn('id', $verifiedIds)
                ->where('is_published', true)
                ->get(['id', 'title', 'author', 'year', 'program'])
                ->toArray();
        }

        return $this->successResponse([
            'reply'               => $reply,
            'suggested_capstones' => $suggestedCapstones,
        ], 'Chatbot response generated.');
    }

    /**
     * Search the database for relevant capstones using terms from the user message.
     * Also uses the open capstone's keywords/category for "related" queries.
     * PHP does the searching — AI only receives real records.
     */
    private function searchDatabase(string $message, ?Capstone $openCapstone = null): \Illuminate\Database\Eloquent\Collection
    {
        $terms = $this->extractTerms($message);

        // If user asks about "related" or "similar" to the open capstone,
        // add that capstone's keywords as search terms automatically
        $isRelatedQuery = preg_match('/relat|similar|like this|same topic|same category/i', $message);
        if ($isRelatedQuery && $openCapstone) {
            $kwTerms = $openCapstone->keywords->pluck('name')
                ->map(fn($k) => strtolower(trim($k)))
                ->filter(fn($k) => strlen($k) > 2)
                ->toArray();
            $terms = array_unique(array_merge($terms, $kwTerms));

            if (!empty($openCapstone->category)) {
                $terms[] = strtolower($openCapstone->category);
            }
        }

        $query = Capstone::with('keywords')
            ->where('is_published', true)
            ->where('is_archived', false);

        if ($openCapstone) {
            $query->where('id', '!=', $openCapstone->id);
        }

        if (!empty($terms)) {
            $query->where(function ($q) use ($terms) {
                foreach ($terms as $term) {
                    $like = "%{$term}%";
                    $q->orWhere('title',    'LIKE', $like)
                      ->orWhere('abstract', 'LIKE', $like)
                      ->orWhere('author',   'LIKE', $like)
                      ->orWhere('program',  'LIKE', $like)
                      ->orWhere('category', 'LIKE', $like);
                }
                $q->orWhereHas('keywords', function ($kq) use ($terms) {
                    $kq->where(function ($inner) use ($terms) {
                        foreach ($terms as $term) {
                            $inner->orWhere('name', 'LIKE', "%{$term}%");
                        }
                    });
                });
            });

            return $query->orderByDesc('year')->limit(15)->get(['id','title','author','year','program','category','abstract']);
        }

        // No meaningful terms → return empty so fallback kicks in
        return collect();
    }

    /**
     * Strip stop words and return only meaningful search terms.
     */
    private function extractTerms(string $message): array
    {
        $clean = preg_replace('/[^a-zA-Z0-9\s]/', ' ', mb_strtolower($message));
        $words = preg_split('/\s+/', trim($clean), -1, PREG_SPLIT_NO_EMPTY);

        return array_values(array_unique(
            array_filter($words, fn($w) => strlen($w) > 2 && !in_array($w, self::STOP_WORDS))
        ));
    }
}
