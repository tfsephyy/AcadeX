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
    const INTENT_DEFINITION       = 'definition';
    const INTENT_PROGRAM_STATS    = 'program_stats';
    const INTENT_STUDENT_RESEARCH = 'student_research';
    const INTENT_UNKNOWN          = 'unknown';

    // ── Pattern groups (checked in priority order) ─────────────────────────────

    private const DEFINITION_PATTERNS = [
        '/\bwhat\s+is\s+(an?\s+)?(imrad|abstract|capstone|thesis|adviser|keyword|publication\s+status|copyright\s+status|approval\s+status|pending|archived|published)\b/i',
        '/\bwhat\s+are\s+keywords?\b/i',
        '/\b(difference\s+between|meaning\s+of|define|definition\s+of|explain)\s+(imrad|abstract|capstone|thesis|archived|published|pending|approval|copyright|publication|keyword|adviser)\b/i',
        '/\bdifference\s+between\s+(a\s+)?capstone\s+and\s+(a\s+)?thesis\b/i',
        '/\bwhat\s+does\s+.{0,30}\s+(mean|stand\s+for)\b/i',
        '/\bwhat\s+format[s]?\s+are\s+accepted\b/i',
        '/\bwhat\s+is\s+the\s+(role|difference)\b/i',
        '/\bwhy\s+do\s+(they|keywords?)\s+matter\b/i',
    ];

    private const PROGRAM_STATS_PATTERNS = [
        '/\bwhich\s+program\s+has\s+the\s+most\b/i',
        '/\bwhich\s+program\s+produces\s+the\s+(fewest|most)\b/i',
        '/\bmost\s+popular\s+(research\s+)?topic\s+in\s+my\s+program\b/i',
        '/\bwhich\s+(year|program)\s+had\s+the\s+most\s+(capstones?|submission)\b/i',
        '/\bmost\s+frequently\s+used\s+keywords?\b/i',
        '/\bmost\s+prolific\s+(capstone\s+)?authors?\b/i',
        '/\barchived\s+vs\s+published\b/i',
        '/\b(never\s+been\s+viewed|no\s+pdf|no\s+keywords?|never\s+logged\s+in|most\s+active\s+users?|duplicate\s+title|appear\s+more\s+than\s+once)\b/i',
        // "who has uploaded the most capstones" — must be caught before it falls to search
        '/\bwho\s+(has\s+)?uploaded\s+the\s+most\s+capstones?\b/i',
        '/\bwho\s+(has\s+)?upload(ed)?\s+the\s+most\b/i',
        '/\btopics?\s+(that\s+have\s+been\s+)?overdone\b/i',
        // upload trend (catch before admin_trends to avoid conflict)
        '/\bupload\s+trend\s+over\s+the\s+last\b/i',
        // New admin chatbot questions
        '/\bhow\s+many\s+capstones?\s+are\s+in\s+the\s+archive\b/i',
        '/\bin\s+the\s+archive\s+in\s+total\b/i',
        '/\bno\s+imrad\s+attached\b/i',
        '/\bhow\s+many\s+capstones?\s+has?\s+no\s+imrad\b/i',
        '/\bhow\s+many\s+capstones?\s+are\s+published\b/i',
        '/\bhow\s+many\s+capstones?\s+are\s+copyrighted\b/i',
        // ── Faculty advisory questions ─────────────────────────────────────────
        // "most viewed title capstone among I advised"
        '/\bmost\s+viewed\s+(title\s+)?capstone\s+(among|that)\s+i\s+(have\s+)?advis(ed|e)\b/i',
        '/\bmost\s+viewed.*(?:i|my)\s+advis\b/i',
        // "overdone" in advisory context
        '/\boverdone\b/i',
        // "how many capstone have I advised"
        '/\bhow\s+many\s+capstones?\s+(have\s+)?i\s+(have\s+)?advis(ed)?\b/i',
        '/\bi\s+advis(ed)?\s+across\s+all\s+years\b/i',
        // "find capstones in my advisory that has been published"
        '/\bmy\s+advisory\b/i',
        '/\bi\s+(have\s+)?advis(ed)?\b/i',
        // "show all the capstone I have advised for the past 3 years"
        '/\bcapstones?\s+i\s+have\s+advis(ed)?\s+for\s+the\s+past\b/i',
        '/\badvis(ed)?\s+for\s+the\s+past\s+\d+\s+years?\b/i',
        '/\bpast\s+3\s+years\b/i',
    ];

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
        // "how many X" — covers singular AND plural forms
        '/\bhow\s+many\s+(capstones?|users?|students?|faculty|visitors?|uploads?|downloads?|projects?|people|registered|are\s+registered)\b/i',
        '/\b(total\s+(capstones?|users?|students?|faculty|uploads?|visitors?))\b/i',
        '/\bnumber\s+of\s+(capstones?|users?|students?|faculty|visitors?|registered)\b/i',
        // "show capstone statistics", "show stats", "overview"
        '/\b(statistics?|stats?\b|overview|summary\s+report|dashboard|count)\b/i',
        '/\b(show|get)\s+(capstone|repository|system)\s+(statistics?|stats?|overview)\b/i',
        '/\bhow\s+many\s+are\s+(registered|pending|archived|published|there)\b/i',
        // "users registered by role", "registered by role"
        '/\b(users?|students?|faculty)\s+(registered|count|statistic|overview)\b/i',
        '/\bregistered\s+by\s+role\b/i',
        '/\bhow\s+many\s+(capstones?|uploads?)\s+(were|this)\b/i',
        '/\b(copyright\s+distribution|imrad\s+stat|copyright\s+stat|pending\s+approval)\b/i',
        '/\bshow\s+(me\s+)?(the\s+)?(repository|database|system)\s+(statistic|overview|count)/i',
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

    private const STUDENT_RESEARCH_PATTERNS = [
        // "What capstones has my adviser supervised before?"
        '/\bwhat\s+capstones?\s+(has|have)\s+my\s+adviser\s+supervised\b/i',
        '/\bcapstones?\s+my\s+adviser\s+(has\s+)?supervised\b/i',
        '/\bmy\s+adviser\s+supervised\b/i',
        
        // "What is the most popular research topic?"
        '/\bmost\s+popular\s+(research\s+)?topic\b/i',
        '/\bwhat\s+is\s+the\s+most\s+popular\s+topic\b/i',
        
        // "How has the number of capstone submissions changed over the years?"
        '/\bcapstone\s+submission(s)?\s+(changed\s+)?over\s+the\s+years?\b/i',
        '/\bnumber\s+of\s+capstone\s+submission(s)?\s+(changed|per\s+year)\b/i',
        '/\bsubmission(s)?\s+changed\s+over\b/i',
        '/\bcapstone(s)?\s+per\s+year\b/i',
        
        // "Which advisers handle the most research projects?"
        '/\bwhich\s+adviser(s)?\s+handle(s)?\s+the\s+most\b/i',
        '/\badvisers?\s+(with\s+)?the\s+most\s+(research\s+)?projects?\b/i',
        '/\badvisers?\s+handle\s+the\s+most\b/i',
        
        // "What is the most referenced capstone?"
        '/\bmost\s+referenced\s+capstone\b/i',
        '/\bwhat\s+is\s+the\s+most\s+referenced\b/i',
        '/\bmost\s+referenced\b/i',
    ];

    // ── Public API ─────────────────────────────────────────────────────────────

    /**
     * Detect the primary intent. Order matters — specific patterns before generic.
     */
    public function detect(string $message): string
    {
        // Definition/glossary questions — answered without DB queries
        foreach (self::DEFINITION_PATTERNS    as $p) { if (preg_match($p, $message)) return self::INTENT_DEFINITION; }

        // ── Student research section — checked FIRST so "capstone submissions changed over the years"
        //    does NOT get caught by the generic ADMIN_TRENDS "capstones per year" pattern
        foreach (self::STUDENT_RESEARCH_PATTERNS as $p) { if (preg_match($p, $message)) return self::INTENT_STUDENT_RESEARCH; }

        // Admin intents must be checked next (most specific DB queries)
        foreach (self::ADMIN_LOGS_PATTERNS    as $p) { if (preg_match($p, $message)) return self::INTENT_ADMIN_LOGS; }
        foreach (self::ADMIN_TRENDS_PATTERNS  as $p) { if (preg_match($p, $message)) return self::INTENT_ADMIN_TRENDS; }

        // Program/archive analytics checked BEFORE admin_stats
        // so "archived vs published" and "who uploaded most" don't fall into generic admin_stats
        foreach (self::PROGRAM_STATS_PATTERNS as $p) { if (preg_match($p, $message)) return self::INTENT_PROGRAM_STATS; }

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
        $f = [
            'year'      => null,
            'year_from' => null,
            'year_to'   => null,
            'author'    => null,
            'metric'    => 'view_count',
            'limit'     => 10,        // default result count
            'this_year' => false,     // restrict to current year
        ];

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

        // Popularity metric — match root word AND inflected forms (downloaded, downloads, bookmarked, bookmarks)
        if (preg_match('/\bdownload(ed|s)?\b/i', $message))      $f['metric'] = 'download_count';
        elseif (preg_match('/\bbookmark(ed|s)?\b/i', $message))  $f['metric'] = 'bookmark_count';

        // Explicit numeric limit: "top 3", "top 5", "top 10"
        if (preg_match('/\btop\s+(\d+)\b/i', $message, $m)) {
            $f['limit'] = (int) $m[1];
        }
        // "top most" (no number) → single result
        elseif (preg_match('/\btop\s+most\b/i', $message)) {
            $f['limit'] = 1;
        }
        // "what is the most downloaded/bookmarked" (singular 'is', no number) → single result
        elseif (preg_match('/\bwhat\s+is\s+the\s+most\s+(downloaded|bookmarked)\b/i', $message)) {
            $f['limit'] = 1;
        }

        // "this year" / "this month" flag for bookmarks
        if (preg_match('/\bthis\s+(year|month)\b/i', $message)) {
            $f['this_year'] = true;
        }

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
