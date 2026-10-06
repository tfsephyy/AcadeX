<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Services\Chatbot\ChatbotAnalyticsService;
use App\Services\Chatbot\ChatbotIntentService;
use App\Services\Chatbot\ChatbotPermissionService;
use App\Services\Chatbot\ChatbotQueryService;
use App\Services\Chatbot\ChatbotResponseService;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;

/**
 * ChatbotController
 *
 * Architecture: DATABASE FIRST → PERMISSION FIRST → RESPONSE SECOND
 *
 * ┌─────────────────────────────────────────────────┐
 * │  NO EXTERNAL AI CALLS. NO GROQ. NO OPENAI.      │
 * │                                                  │
 * │  Flow:                                           │
 * │  1. Authenticate user → get role (server-side)  │
 * │  2. PHP pattern-matching intent detection        │
 * │  3. Permission gate (deny before any DB query)   │
 * │  4. Role-scoped DB query                        │
 * │  5. PHP response formatter (ChatbotResponseSvc)  │
 * │  6. Return JSON — no external latency, ever.     │
 * └─────────────────────────────────────────────────┘
 */
class ChatbotController extends Controller
{
    use ApiResponses;

    private ChatbotIntentService    $intentSvc;
    private ChatbotPermissionService $permSvc;
    private ChatbotQueryService     $querySvc;
    private ChatbotAnalyticsService $analyticsSvc;
    private ChatbotResponseService  $responseSvc;

    public function __construct()
    {
        $this->intentSvc    = new ChatbotIntentService();
        $this->permSvc      = new ChatbotPermissionService();
        $this->querySvc     = new ChatbotQueryService();
        $this->analyticsSvc = new ChatbotAnalyticsService();
        $this->responseSvc  = new ChatbotResponseService();
    }

    // ── Entry point ────────────────────────────────────────────────────────────

    public function message(Request $request): JsonResponse
    {
        // ── 1. Validate ─────────────────────────────────────────────────────────
        $validated = $request->validate([
            'message'    => 'required|string|max:2000',
            'capstone_id' => 'nullable|integer|exists:capstones,id',
            'selected_adviser_id' => 'nullable|integer|exists:users,id',
        ]);

        // ── 2. Role from authenticated server-side session (never from message) ──
        $user = $request->user();
        $role = $this->resolveRole($user);
        $msg  = trim($validated['message']);

        // ── 3. Intent detection (pure PHP, no AI) ───────────────────────────────
        $intent  = $this->intentSvc->detect($msg);
        $filters = $this->intentSvc->extractFilters($msg);

        // ── 4. Permission gate — executed before any DB query ───────────────────
        if (!$this->permSvc->isIntentAllowed($intent, $role)) {
            return $this->buildResponse(
                $this->responseSvc->accessDenied(
                    $this->permSvc->getDeniedMessage($intent, $role)
                ),
                $intent
            );
        }

        // ── 5. Currently open capstone context (if user has one open) ────────────
        $openCapstone = null;
        if (!empty($validated['capstone_id'])) {
            $openCapstone = $this->querySvc->findById($role, (int) $validated['capstone_id']);
        }

        // ── 6. Handle intent → query DB → format response ───────────────────────
        try {
            $result = $this->handleIntent($intent, $msg, $role, $filters, $openCapstone, $user, $validated['selected_adviser_id'] ?? null);
        } catch (\Throwable $e) {
            Log::error('Chatbot DB error', [
                'role'   => $role,
                'intent' => $intent,
                'error'  => $e->getMessage(),
                'trace'  => $e->getTraceAsString(),
            ]);
            return $this->buildResponse($this->responseSvc->dbError(), $intent);
        }

        return $this->buildResponse($result, $intent);
    }

    // ── Intent dispatcher ──────────────────────────────────────────────────────

    private function handleIntent(
        string $intent,
        string $msg,
        string $role,
        array  $filters,
        ?Capstone $openCapstone,
        $user = null,
        ?int $selectedAdviserId = null
    ): array {
        // If a capstone is open and the user is asking about it specifically
        if ($openCapstone && $this->isAskingAboutOpenCapstone($intent, $msg)) {
            return $this->responseSvc->formatCapstoneDetails($openCapstone);
        }

        // If adviser was selected via faculty button, always route to student research handler
        if ($selectedAdviserId !== null) {
            return $this->handleStudentResearch($msg, $selectedAdviserId);
        }

        return match ($intent) {
            ChatbotIntentService::INTENT_ADMIN_STATS    => $this->handleAdminStats($msg),
            ChatbotIntentService::INTENT_ADMIN_TRENDS   => $this->handleAdminTrends(),
            ChatbotIntentService::INTENT_ADMIN_LOGS     => $this->handleAdminLogs($msg),
            ChatbotIntentService::INTENT_POPULAR        => $this->handlePopular($role, $filters),
            ChatbotIntentService::INTENT_CATEGORY_INFO  => $this->handleCategories($role),
            ChatbotIntentService::INTENT_DEFINITION     => $this->handleDefinition($msg, $role),
            ChatbotIntentService::INTENT_PROGRAM_STATS  => $this->handleProgramStats($msg, $role, $user),
            ChatbotIntentService::INTENT_STUDENT_RESEARCH => $this->handleStudentResearch($msg, $selectedAdviserId),
            ChatbotIntentService::INTENT_CAPSTONE_DETAILS => $openCapstone
                ? $this->responseSvc->formatCapstoneDetails($openCapstone)
                : $this->handleSearch($role, $msg, $filters),
            ChatbotIntentService::INTENT_UNKNOWN        => $this->handleUnknown($role),
            default => $this->handleSearch($role, $msg, $filters),
        };
    }

    // ── Intent handlers ────────────────────────────────────────────────────────

    /** General search / recommendation — used for SEARCH, RECOMMEND, UNKNOWN */
    private function handleSearch(string $role, string $msg, array $filters): array
    {
        $results = $this->querySvc->search($role, $msg, $filters);

        if ($results->isNotEmpty()) {
            // Extract a clean search query for the header (strip stop words for readability)
            $displayQuery = $this->extractDisplayQuery($msg);
            return $this->responseSvc->formatCapstoneResults($results, $displayQuery);
        }

        // No exact match — show recent capstones as a suggestion
        $recent = $this->querySvc->recent($role, 5);
        if ($recent->isNotEmpty()) {
            $reply  = "I couldn't find an exact match for your request, but here are some recent capstones:\n\n";
            $result = $this->responseSvc->formatCapstoneResults($recent);
            $result['reply'] = $reply . $result['reply'];
            return $result;
        }

        return ['reply' => $this->responseSvc->noResults($msg), 'suggested_capstones' => []];
    }

    /** Glossary / definition questions — no DB needed */
    private function handleDefinition(string $msg, string $role): array
    {
        return $this->responseSvc->formatDefinition($msg, $role);
    }

    /** Program and archive-level analytics — available to all authenticated roles */
    private function handleProgramStats(string $msg, string $role, $user = null): array
    {
        $data = $this->analyticsSvc->programStats($msg, $role, $user);
        return $this->responseSvc->formatProgramStats($data, $msg);
    }

    /** Popular capstones by view/download/bookmark count */
    private function handlePopular(string $role, array $filters): array
    {
        $metric   = $filters['metric'] ?? 'view_count';
        $thisYear = $filters['this_year'] ?? false;

        // If an explicit limit was set in filters (e.g. top 3, top most → 1), use it directly
        if (!empty($filters['limit']) && $filters['limit'] !== 10) {
            $limit = (int) $filters['limit'];
        } else {
            // Sensible defaults per metric
            $limit = match ($metric) {
                'download_count' => 5,
                'bookmark_count' => 5,
                default          => 3, // view_count default = top 3
            };
        }

        $results = $this->querySvc->popular($role, $metric, $limit, $thisYear);
        return $this->responseSvc->formatPopular($results, $metric);
    }

    /** Category list with counts */
    private function handleCategories(string $role): array
    {
        $cats = $this->querySvc->categories($role);
        return $this->responseSvc->formatCategories($cats);
    }

    /** Unknown/general question — build hints from real DB data so examples always work */
    private function handleUnknown(string $role): array
    {
        // Pull a few real categories and keywords from the DB so examples are always valid
        $hints = [];
        try {
            $hints['categories'] = $this->querySvc->categories($role)->keys()->take(3)->values()->toArray();
        } catch (\Throwable $e) { $hints['categories'] = []; }
        try {
            $hints['keywords'] = \Illuminate\Support\Facades\DB::table('keywords')
                ->join('capstone_keyword', 'keywords.id', '=', 'capstone_keyword.keyword_id')
                ->selectRaw('keywords.name, COUNT(*) as total')
                ->groupBy('keywords.name')->orderByDesc('total')
                ->limit(3)->pluck('name')->toArray();
        } catch (\Throwable $e) { $hints['keywords'] = []; }
        try {
            $hints['recent_year'] = \App\Models\Capstone::max('year') ?? now()->year;
        } catch (\Throwable $e) { $hints['recent_year'] = now()->year; }
        try {
            $hints['top_program'] = \App\Models\Capstone::selectRaw('program, COUNT(*) as total')
                ->whereNotNull('program')->groupBy('program')->orderByDesc('total')
                ->value('program') ?? 'BSIT';
        } catch (\Throwable $e) { $hints['top_program'] = 'BSIT'; }

        return $this->responseSvc->unknownRequest($role, $hints);
    }

    /** Admin repository statistics */
    private function handleAdminStats(string $msg): array
    {
        $sub   = $this->intentSvc->detectAdminSubContext($msg);
        $stats = $this->analyticsSvc->repositoryStats();

        $userStats      = null;
        $categories     = null;
        $downloadStats  = null;
        $copyrightStats = null;

        // Detect if the user is ONLY asking about registered users by role
        $userOnly = (bool) preg_match('/\b(registered\s+by\s+role|users?\s+registered|how\s+many\s+users?\s+are\s+registered|registered\s+users?\s+by\s+role)\b/i', $msg);

        if ($sub['wants_users'] || $userOnly) {
            try { $userStats = $this->analyticsSvc->userStats(); } catch (\Throwable $e) {}
        }
        if ($sub['wants_categories']) {
            $categories = $this->analyticsSvc->categoryDistribution();
        }
        if ($sub['wants_downloads']) {
            try { $downloadStats = $this->analyticsSvc->downloadStats(); } catch (\Throwable $e) {}
        }
        if ($sub['wants_copyright']) {
            $copyrightStats = $this->analyticsSvc->copyrightDistribution();
        }

        // If no specific sub-context detected, show the full overview
        if (!array_filter($sub) && !$userOnly) {
            try { $userStats = $this->analyticsSvc->userStats(); } catch (\Throwable $e) {}
            $categories = $this->analyticsSvc->categoryDistribution();
        }

        return $this->responseSvc->formatAdminStats($stats, $userStats, $categories, $downloadStats, $copyrightStats, $userOnly);
    }

    /** Admin upload trend by year */
    private function handleAdminTrends(): array
    {
        $trend = $this->analyticsSvc->uploadTrend(5);
        return $this->responseSvc->formatTrend($trend);
    }

    /** Student research section questions */
    private function handleStudentResearch(string $msg, ?int $selectedAdviserId): array
    {
        $msg = strtolower($msg);

        // 1. "What capstones has my adviser supervised before?"
        //    Also handles follow-up: "Show capstones advised by {name}" (sent when faculty button clicked)
        $isAdviserQuery =
            preg_match('/\badviser\s+supervised\b/i', $msg) ||
            preg_match('/\bmy\s+adviser\b/i', $msg) ||
            preg_match('/\bshow\s+capstones\s+advised\s+by\b/i', $msg) ||
            preg_match('/\bcapstones?\s+advised\s+by\b/i', $msg);

        if ($isAdviserQuery || $selectedAdviserId) {
            // If adviser is already selected via button, skip the faculty list step
            if ($selectedAdviserId) {
                $adviser = \App\Models\User::find($selectedAdviserId);
                if (!$adviser) {
                    return ['reply' => "The selected adviser could not be found.", 'suggested_capstones' => []];
                }
                $capstones = $this->analyticsSvc->getCapstonesByAdviser($selectedAdviserId);
                return $this->responseSvc->formatAdviserCapstones($capstones, $adviser->name);
            }

            // No adviser selected yet — show the faculty selection list
            $faculty = $this->analyticsSvc->getAllFaculty();
            return $this->responseSvc->formatFacultySelection($faculty);
        }


        // 2. "What is the most popular research topic?"
        if (str_contains($msg, 'most popular topic') || str_contains($msg, 'popular research topic')) {
            $topicData = $this->analyticsSvc->getMostPopularTopic();
            return $this->responseSvc->formatMostPopularTopic($topicData);
        }

        // 3. "How has the number of capstone submissions changed over the years?"
        if (str_contains($msg, 'submission') && (str_contains($msg, 'over the years') || str_contains($msg, 'per year') || str_contains($msg, 'changed'))) {
            $submissions = $this->analyticsSvc->getSubmissionsPerYear();
            return $this->responseSvc->formatSubmissionsPerYear($submissions);
        }

        // 4. "Which advisers handle the most research projects?"
        if (str_contains($msg, 'advisers') && str_contains($msg, 'handle') && str_contains($msg, 'most')) {
            $advisers = $this->analyticsSvc->getTopAdvisers(1);
            return $this->responseSvc->formatTopAdvisers($advisers);
        }

        // 5. "What is the most referenced capstone?"
        if (str_contains($msg, 'most referenced')) {
            $data = $this->analyticsSvc->getMostReferencedCapstone();
            return $this->responseSvc->formatMostReferencedCapstone($data);
        }

        // Fallback if no specific question matched
        return ['reply' => "I couldn't understand that question. Please try asking about adviser supervision, popular topics, submission trends, top advisers, or most referenced capstones.", 'suggested_capstones' => []];
    }

    /** Admin activity / audit logs */
    private function handleAdminLogs(string $msg): array
    {
        $wantsLogin    = (bool) preg_match('/\b(login|logged\s*in)\b/i', $msg);
        $wantsDownload = (bool) preg_match('/\bdownload\b/i', $msg);
        $wantsMost     = (bool) preg_match('/\bmost\b/i', $msg);

        $data = [];

        if ($wantsDownload || ($wantsMost && !$wantsLogin)) {
            $top = $this->analyticsSvc->mostDownloaded(10);
            $data['top_downloads'] = $top->map(fn($c) => [
                'id'             => $c->id,
                'title'          => $c->title,
                'author'         => $c->author,
                'year'           => $c->year,
                'download_count' => $c->download_count,
            ])->toArray();
        }

        if ($wantsLogin) {
            // Always set the key so formatLogs knows it was requested
            $data['logins'] = [];
            try {
                $logins = $this->analyticsSvc->recentLogins(7);
                $data['logins'] = $logins->map(fn($l) => [
                    'email'        => $l->email,
                    'status'       => $l->status,
                    'ip_address'   => $l->ip_address,
                    'attempted_at' => (string) $l->attempted_at,
                ])->toArray();
            } catch (\Throwable $e) {}
        }

        if (!$wantsLogin && !$wantsDownload) {
            // Default: recent general activity
            try {
                $activity = $this->analyticsSvc->recentActivity(10);
                $data['activity'] = $activity->map(fn($a) => [
                    'user'        => $a->user?->name ?? 'System',
                    'action'      => $a->action ?? '',
                    'description' => $a->description ?? '',
                    'created_at'  => (string) $a->created_at,
                ])->toArray();
            } catch (\Throwable $e) {}

            // Also show top downloads for context
            $top = $this->analyticsSvc->mostDownloaded(5);
            $data['top_downloads'] = $top->map(fn($c) => [
                'id'             => $c->id,
                'title'          => $c->title,
                'author'         => $c->author,
                'year'           => $c->year,
                'download_count' => $c->download_count,
            ])->toArray();
        }

        return $this->responseSvc->formatLogs($data);
    }

    // ── Helpers ────────────────────────────────────────────────────────────────

    /**
     * Resolve the user's role from the Sanctum-authenticated User model.
     * NEVER trusts anything from the request body — role is always server-side.
     */
    private function resolveRole($user): string
    {
        if (!$user) return ChatbotPermissionService::ROLE_VISITOR;

        if (isset($user->role) && is_object($user->role) && isset($user->role->name)) {
            return strtolower($user->role->name);
        }
        if (isset($user->role) && is_string($user->role)) {
            return strtolower($user->role);
        }

        return ChatbotPermissionService::ROLE_VISITOR;
    }

    /**
     * Check whether the user appears to be asking about the currently open capstone.
     */
    private function isAskingAboutOpenCapstone(string $intent, string $msg): bool
    {
        if ($intent === ChatbotIntentService::INTENT_CAPSTONE_DETAILS) return true;

        $patterns = [
            '/\b(this|current|open|the\s+current)\s+(capstone|project|thesis|paper)\b/i',
            '/\bwhat\s+is\s+(it|this)\b/i',
            '/\bwho\s+(are|wrote|made|authored)\s+(it|this)\b/i',
            '/\b(about|more\s+about|regarding)\s+(it|this)\b/i',
            '/\bsummariz(e|ing)\s+(it|this)\b/i',
        ];
        foreach ($patterns as $p) {
            if (preg_match($p, $msg)) return true;
        }

        return false;
    }

    /**
     * Extract a short display query string from a natural language message.
     * Used for the "I found X results matching '...'" header.
     */
    private function extractDisplayQuery(string $msg): string
    {
        // Remove common filler phrases
        $clean = preg_replace(
            '/\b(recommend|suggest|find|show|give\s+me|i\s+need|looking\s+for|help\s+me\s+find|any|capstone[s]?|project[s]?|related\s+to|about|using|with)\b/i',
            '',
            $msg
        );
        $clean = preg_replace('/\s+/', ' ', trim($clean));

        return mb_strlen($clean) >= 3 ? $clean : $msg;
    }

    /**
     * Build the final JSON response in the standard AcadeX API format.
     */
    private function buildResponse(array $data, string $intent): JsonResponse
    {
        $payload = [
            'reply'               => $data['reply']               ?? '',
            'suggested_capstones' => $data['suggested_capstones'] ?? [],
            'intent'              => $intent,
        ];

        // Pass faculty_list through when present (adviser selection flow)
        if (!empty($data['faculty_list'])) {
            $payload['faculty_list'] = $data['faculty_list'];
        }

        return $this->successResponse($payload, 'Chatbot response generated.');
    }
}
