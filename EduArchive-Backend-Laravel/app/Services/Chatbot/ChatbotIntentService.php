<?php

namespace App\Services\Chatbot;

/**
 * ChatbotIntentService
 *
 * Classifies user messages using PHP regex pattern matching only.
 * No external AI is used for intent detection — this keeps the system
 * deterministic, fast, and immune to prompt-injection attacks.
 */
class ChatbotIntentService
{
    // ── Intent constants ──────────────────────────────────────────────────────
    const INTENT_RECOMMEND        = 'recommend';
    const INTENT_SEARCH           = 'search';
    const INTENT_CAPSTONE_DETAILS = 'capstone_details';
    const INTENT_ADMIN_STATS      = 'admin_stats';
    const INTENT_ADMIN_TRENDS     = 'admin_trends';
    const INTENT_ADMIN_LOGS       = 'admin_logs';
    const INTENT_POPULAR          = 'popular';
    const INTENT_CATEGORY_INFO    = 'category_info';
    const INTENT_UNKNOWN          = 'unknown';

    // ── Pattern groups (checked in priority order) ─────────────────────────────

    private const ADMIN_LOGS_PATTERNS = [
        '/\bwho\s+(downloaded|uploaded|logged\s*in|viewed|accessed)\b/i',
        '/\b(activity\s+log|audit\s+log|recent\s+activity|recent\s+login)\b/i',
        '/\bdownloads?\s+this\s+(month|week|year)\b/i',
        '/\bhow\s+many\s+users?\s+(logged\s*in|downloaded)\b/i',
        '/\bshow\s+(me\s+)?(recent\s+)?logins?\b/i',
    ];

    private const ADMIN_TRENDS_PATTERNS = [
        '/\b(upload\s+trend|trend\s+per\s+year|by\s+year|growth|yearly\s+(upload|breakdown))\b/i',
        '/\blast\s+\d+\s+years?\b/i',
        '/\buploaded\s+(by|per)\s+year\b/i',
        '/\bcapstones?\s+per\s+year\b/i',
        '/\bshow\s+(upload|submission)\s+trend\b/i',
    ];

    private const ADMIN_STATS_PATTERNS = [
        '/\bhow\s+many\s+(capstone|user|student|faculty|visitor|upload|download|project|people|registered|are\s+registered)\b/i',
        '/\b(total\s+(capstone|user|student|faculty|upload|visitor))\b/i',
        '/\bnumber\s+of\s+(capstone|user|student|faculty|visitor|registered)\b/i',
        '/\b(statistic|stats?\b|overview|summary\s+report|dashboard|count)\b/i',
        '/\bhow\s+many\s+are\s+(registered|pending|archived|published|there)\b/i',
        '/\b(copyright\s+distribution|imrad\s+stat|copyright\s+stat|pending\s+approval)\b/i',
        '/\bshow\s+(me\s+)?(the\s+)?(repository|database|system)\s+(statistic|overview|count)/i',
        '/\b(user|student|faculty)\s+(count|statistic|overview)\b/i',
    ];

    private const POPULAR_PATTERNS = [
        '/\bmost\s+(viewed|downloaded|bookmarked|popular|accessed|read)\b/i',
        '/\b(top\s+\d*\s*capstone|trending|highly\s+(viewed|downloaded|bookmarked))\b/i',
        '/\bpopular\s+capstone\b/i',
    ];

    private const CAPSTONE_DETAILS_PATTERNS = [
        '/\b(tell\s+me\s+about|describe|details?\s+of|information\s+about|info\s+about)\b/i',
        '/\bwho\s+(are\s+)?(the\s+)?author(s)?\b/i',
        '/\bwhat\s+(is\s+)?(the\s+)?(abstract|methodology|findings?|conclusion|keywords?)\b/i',
        '/\bwhat\s+(does|is)\s+this\s+capstone\b/i',
    ];

    private const RECOMMEND_PATTERNS = [
        '/\b(recommend|suggest|give\s+me|i\s+need|looking\s+for|help\s+me\s+find|find\s+me|can\s+you\s+find)\b/i',
        '/\bcapstone\s+(idea|suggestion|recommendation)\b/i',
        '/\bi\s+(am|m)\s+looking\s+for\b/i',
        '/\bany\s+(good\s+)?capstone\b/i',
    ];

    private const CATEGORY_INFO_PATTERNS = [
        '/\b(what\s+categor|list\s+categor|available\s+categor|show\s+(me\s+)?categor|all\s+categor)\b/i',
    ];

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Detect the primary intent. Order matters — specific patterns before generic.
     */
    public function detect(string $message): string
    {
        // Admin intents must be checked first (most specific)
        foreach (self::ADMIN_LOGS_PATTERNS    as $p) { if (preg_match($p, $message)) return self::INTENT_ADMIN_LOGS; }
        foreach (self::ADMIN_TRENDS_PATTERNS  as $p) { if (preg_match($p, $message)) return self::INTENT_ADMIN_TRENDS; }
        foreach (self::ADMIN_STATS_PATTERNS   as $p) { if (preg_match($p, $message)) return self::INTENT_ADMIN_STATS; }
        
        // Capstone-specific intents
        foreach (self::POPULAR_PATTERNS       as $p) { if (preg_match($p, $message)) return self::INTENT_POPULAR; }
        foreach (self::CAPSTONE_DETAILS_PATTERNS as $p) { if (preg_match($p, $message)) return self::INTENT_CAPSTONE_DETAILS; }
        foreach (self::CATEGORY_INFO_PATTERNS as $p) { if (preg_match($p, $message)) return self::INTENT_CATEGORY_INFO; }
        foreach (self::RECOMMEND_PATTERNS     as $p) { if (preg_match($p, $message)) return self::INTENT_RECOMMEND; }

        // Default to SEARCH only if message contains capstone-related keywords
        if ($this->seemsLikeCapstoneSearch($message)) {
            return self::INTENT_SEARCH;
        }

        // If no clear intent and no capstone keywords, treat as general question
        return self::INTENT_UNKNOWN;
    }

    /**
     * Check if the message seems to be asking about capstones specifically.
     */
    private function seemsLikeCapstoneSearch(string $message): bool
    {
        $capstoneKeywords = [
            'capstone', 'thesis', 'research', 'project', 'paper', 'study',
            'iot', 'ai', 'ml', 'dl', 'nlp', 'cv', 'ar', 'vr', 'web', 'mobile', 'system', 'application',
            'healthcare', 'agriculture', 'education', 'business', 'tourism', 'inventory',
            'database', 'security', 'network', 'software', 'hardware', 'embedded',
            'android', 'laravel', 'react', 'python', 'java', 'javascript',
            'title', 'author', 'abstract', 'year', 'category', 'keyword',
            'recommendation', 'suggest', 'find', 'search', 'show', 'list'
        ];

        $lower = strtolower($message);
        foreach ($capstoneKeywords as $kw) {
            if (stripos($lower, $kw) !== false) {
                return true;
            }
        }

        return false;
    }

    /**
     * Extract structured search filters from the user message.
     *
     * @return array{year:?int, year_from:?int, year_to:?int, author:?string, metric:string}
     */
    public function extractFilters(string $message): array
    {
        $f = ['year' => null, 'year_from' => null, 'year_to' => null, 'author' => null, 'metric' => 'view_count'];

        // Year range: "2024 to 2026" or "2024-2026"
        if (preg_match('/(?:from\s+)?(\d{4})\s*(?:to|-)\s*(\d{4})/i', $message, $m)) {
            $f['year_from'] = (int) $m[1];
            $f['year_to']   = (int) $m[2];
        } elseif (preg_match('/\b(?:from|since|after|starting)\s+(\d{4})/i', $message, $m)) {
            $f['year_from'] = (int) $m[1];
        } elseif (preg_match('/(\d{4})\s+onwards/i', $message, $m)) {
            $f['year_from'] = (int) $m[1];
        } elseif (preg_match('/\b(20\d{2})\b/', $message, $m)) {
            $f['year'] = (int) $m[1];
        }

        // Author: "by Juan Dela Cruz", "authored by Maria Santos"
        if (preg_match('/\b(?:by|authored\s+by)\s+([A-Za-z][A-Za-z\s]{2,40}?)(?=\s*(?:,|\.|$|\b(?:and|capstone|project)\b))/i', $message, $m)) {
            $f['author'] = trim($m[1]);
        }

        // Popularity metric
        if (preg_match('/\bdownload\b/i', $message))      $f['metric'] = 'download_count';
        elseif (preg_match('/\bbookmark\b/i', $message))  $f['metric'] = 'bookmark_count';

        return $f;
    }

    /**
     * For admin stat messages, detect which specific sub-topics are needed.
     * Lets the controller fetch only the relevant data — no over-fetching.
     *
     * @return array<string, bool>
     */
    public function detectAdminSubContext(string $message): array
    {
        return [
            'wants_users'      => (bool) preg_match('/\b(user|student|faculty|visitor|registered|account|member)\b/i', $message),
            'wants_downloads'  => (bool) preg_match('/\bdownload\b/i', $message),
            'wants_categories' => (bool) preg_match('/\bcategor\b/i', $message),
            'wants_copyright'  => (bool) preg_match('/\bcopyright\b/i', $message),
            'wants_imrad'      => (bool) preg_match('/\bimrad\b/i', $message),
            'wants_pending'    => (bool) preg_match('/\b(pending|approval)\b/i', $message),
            'wants_login_logs' => (bool) preg_match('/\b(login|logged\s*in)\b/i', $message),
            'wants_uploads'    => (bool) preg_match('/\bupload\b/i', $message),
        ];
    }
}
