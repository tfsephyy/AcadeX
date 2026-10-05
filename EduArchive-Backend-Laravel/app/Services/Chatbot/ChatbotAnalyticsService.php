<?php

namespace App\Services\Chatbot;

use App\Models\Capstone;
use App\Models\User;
use Illuminate\Support\Collection;
use Illuminate\Support\Facades\DB;

/**
 * ChatbotAnalyticsService
 *
 * Admin-only database-derived statistics and activity log queries.
 * Every method here is called ONLY after permission has been verified.
 * Nothing is hard-coded — all values come from live DB aggregations.
 */
class ChatbotAnalyticsService
{
    // ── Repository statistics ─────────────────────────────────────────────────

    /**
     * General repository overview counts.
     *
     * @return array<string, int>
     */
    public function repositoryStats(): array
    {
        return [
            'total_published'     => Capstone::where('publication_status', 'published')->where('is_archived', false)->count(),
            'total_all'           => Capstone::count(),
            'pending_approval'    => Capstone::where('status', 'pending')->count(),
            'total_archived'      => Capstone::where('is_archived', true)->count(),
            'uploads_this_year'   => Capstone::whereYear('created_at', now()->year)->count(),
            'uploads_this_month'  => Capstone::whereMonth('created_at', now()->month)
                                             ->whereYear('created_at', now()->year)->count(),
            'with_imrad'          => Capstone::where('publication_status', 'published')->whereNotNull('imrad_path')->count(),
            'without_imrad'       => Capstone::where('publication_status', 'published')->whereNull('imrad_path')->count(),
            'total_views'         => (int) Capstone::sum('view_count'),
            'total_downloads'     => (int) Capstone::sum('download_count'),
            'total_bookmarks'     => (int) Capstone::sum('bookmark_count'),
        ];
    }

    /**
     * User counts by role.
     *
     * @return array<string, int>
     */
    public function userStats(): array
    {
        // Support both string-role (single column) and relationship-based role
        $counts = User::selectRaw('COUNT(*) as total')->first();

        $byRole = DB::table('users')
            ->join('roles', 'users.role_id', '=', 'roles.id')
            ->selectRaw('roles.name as role, COUNT(*) as count')
            ->groupBy('roles.name')
            ->pluck('count', 'role')
            ->toArray();

        return [
            'total'    => (int) ($counts->total ?? 0),
            'admin'    => (int) ($byRole['admin']   ?? 0),
            'faculty'  => (int) ($byRole['faculty'] ?? 0),
            'student'  => (int) ($byRole['student'] ?? 0),
            'visitor'  => (int) ($byRole['visitor'] ?? 0),
        ];
    }

    // ── Trends ────────────────────────────────────────────────────────────────

    /**
     * Capstone upload count grouped by year (last N years).
     */
    public function uploadTrend(int $years = 6): Collection
    {
        return Capstone::selectRaw('YEAR(created_at) as year, COUNT(*) as total')
            ->whereYear('created_at', '>=', now()->year - $years + 1)
            ->groupBy('year')
            ->orderBy('year')
            ->get();
    }

    /**
     * Category distribution (count per category, published only).
     */
    public function categoryDistribution(): Collection
    {
        return Capstone::selectRaw('category, COUNT(*) as count')
            ->where('publication_status', 'published')
            ->where('is_archived', false)
            ->whereNotNull('category')
            ->groupBy('category')
            ->orderByDesc('count')
            ->get();
    }

    /**
     * Copyright status distribution.
     */
    public function copyrightDistribution(): Collection
    {
        return Capstone::selectRaw('COALESCE(copyright_status, "none") as status, COUNT(*) as count')
            ->groupBy('copyright_status')
            ->orderByDesc('count')
            ->get();
    }

    // ── Popularity ────────────────────────────────────────────────────────────

    public function mostViewed(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return Capstone::where('publication_status', 'published')
            ->orderByDesc('view_count')
            ->limit($limit)
            ->get(['id', 'title', 'author', 'year', 'category', 'view_count']);
    }

    public function mostDownloaded(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return Capstone::where('publication_status', 'published')
            ->orderByDesc('download_count')
            ->limit($limit)
            ->get(['id', 'title', 'author', 'year', 'category', 'download_count']);
    }

    public function mostBookmarked(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return Capstone::where('publication_status', 'published')
            ->orderByDesc('bookmark_count')
            ->limit($limit)
            ->get(['id', 'title', 'author', 'year', 'category', 'bookmark_count']);
    }

    // ── Activity logs ─────────────────────────────────────────────────────────

    /**
     * Recent login attempts (success + failed).
     */
    public function recentLogins(int $limit = 7): \Illuminate\Database\Eloquent\Collection
    {
        // LoginAudit may not have a relationship, so we join manually if needed
        return \App\Models\LoginAudit::orderByDesc('attempted_at')
            ->limit($limit)
            ->get(['id', 'email', 'status', 'ip_address', 'attempted_at']);
    }

    /**
     * Recent audit-log actions.
     */
    public function recentActivity(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return \App\Models\AuditLog::with(['user:id,name'])
            ->orderByDesc('created_at')
            ->limit($limit)
            ->get(['id', 'user_id', 'action', 'description', 'created_at']);
    }

    /**
     * Download stats derived from the audit log.
     *
     * @return array<string, int>
     */
    public function downloadStats(): array
    {
        $base = \App\Models\AuditLog::where('action', 'LIKE', '%download%');

        return [
            'total'       => (int) (clone $base)->count(),
            'this_month'  => (int) (clone $base)->whereMonth('created_at', now()->month)
                                                ->whereYear('created_at', now()->year)->count(),
            'this_year'   => (int) (clone $base)->whereYear('created_at', now()->year)->count(),
        ];
    }

    // ── Program / Archive Stats (all roles) ───────────────────────────────────

    /**
     * Flexible program-level and archive-level analytics.
     * Detects sub-context from the message and returns relevant data.
     *
     * @param  string      $msg
     * @param  string      $role
     * @param  mixed|null  $user  The authenticated User model (passed from controller)
     */
    public function programStats(string $msg, string $role, $user = null): array
    {
        $msg = strtolower($msg);
        $data = [];

        // ── Faculty advisory queries (scoped to adviser_id = faculty user ID) ──

        $isFacultyAdvisory = $role === 'faculty' && $user !== null && (
            str_contains($msg, 'advisory') ||
            str_contains($msg, 'i advised') ||
            str_contains($msg, 'i have advised') ||
            str_contains($msg, 'i advis') ||
            str_contains($msg, 'i advised') ||
            preg_match('/most\s+viewed.*advis/i', $msg) ||
            preg_match('/advis.*past\s+\d+\s+years?/i', $msg) ||
            preg_match('/past\s+3\s+years/i', $msg)
        );

        if ($isFacultyAdvisory) {
            $adviserId = $user->id;

            // 1. Most viewed capstone among advised
            if (preg_match('/most\s+viewed/i', $msg)) {
                $cap = \App\Models\Capstone::where('adviser_id', $adviserId)
                    ->orderByDesc('view_count')
                    ->first(['id', 'title', 'view_count']);
                $data['advisory_most_viewed'] = $cap ? $cap->toArray() : null;
            }

            // 2. Overdone topics (categories with repeated capstones)
            if (str_contains($msg, 'overdone')) {
                $data['advisory_overdone'] = \App\Models\Capstone::where('adviser_id', $adviserId)
                    ->whereNotNull('category')
                    ->selectRaw('category, COUNT(*) as total')
                    ->groupBy('category')
                    ->havingRaw('COUNT(*) > 1')
                    ->orderByDesc('total')
                    ->get()
                    ->toArray();
            }

            // 3. Total count of advised capstones across all years
            if (preg_match('/how\s+many/i', $msg) || str_contains($msg, 'across all years')) {
                $data['advisory_total_count'] = \App\Models\Capstone::where('adviser_id', $adviserId)->count();
            }

            // 4. Published capstones in advisory
            if (str_contains($msg, 'published')) {
                $published = \App\Models\Capstone::where('adviser_id', $adviserId)
                    ->where('publication_status', 'published')
                    ->get(['id', 'title'])
                    ->toArray();
                $data['advisory_published_count'] = count($published);
                $data['advisory_published_list']  = $published;
            }

            // 5. Copyrighted capstones in advisory
            if (str_contains($msg, 'copyrighted') || str_contains($msg, 'copyright')) {
                $copyrighted = \App\Models\Capstone::where('adviser_id', $adviserId)
                    ->where('copyright_status', 'copyrighted')
                    ->get(['id', 'title'])
                    ->toArray();
                $data['advisory_copyrighted_count'] = count($copyrighted);
                $data['advisory_copyrighted_list']  = $copyrighted;
            }

            // 6. Past 3 years capstones
            if (preg_match('/past\s+(\d+)\s+years?/i', $msg, $ym)) {
                $yearsBack = (int) $ym[1];
            } else {
                $yearsBack = 3;
            }
            if (str_contains($msg, 'past') || str_contains($msg, 'past 3') || preg_match('/past\s+\d+\s+years?/i', $msg)) {
                $currentYear = (int) date('Y');
                $fromYear = $currentYear - ($yearsBack - 1);
                $data['advisory_past_years_list'] = \App\Models\Capstone::where('adviser_id', $adviserId)
                    ->whereBetween('year', [$fromYear, $currentYear])
                    ->orderByDesc('year')
                    ->get(['id', 'title', 'year'])
                    ->toArray();
                $data['advisory_past_years_from'] = $fromYear;
                $data['advisory_past_years_to']   = $currentYear;
            }

            // Return early — only advisory data applies
            return $data;
        }

        // ── Which year had the most submissions? (only triggered when year is specifically asked) ──
        $asksYear    = str_contains($msg, 'which year') || str_contains($msg, 'year had the most');
        $asksProgram = str_contains($msg, 'which program');

        if ($asksYear && !$asksProgram) {
            // Return only the top 1 year (the question asks "which year", singular)
            $data['year_counts'] = Capstone::selectRaw('year, COUNT(*) as total')
                ->groupBy('year')->orderByDesc('total')->limit(1)->get()->toArray();
        }

        // Which program has the most submissions? (only triggered when program is specifically asked)
        if ($asksProgram && !$asksYear) {
            // Return only the top 1 program (the question asks "which program", singular)
            $data['program_counts'] = Capstone::selectRaw('program, COUNT(*) as total')
                ->whereNotNull('program')->groupBy('program')->orderByDesc('total')->limit(1)->get()->toArray();
        }

        // Fewest capstones per year by program
        if (str_contains($msg, 'fewest')) {
            $data['program_counts'] = Capstone::selectRaw('program, COUNT(*) as total')
                ->whereNotNull('program')->groupBy('program')->orderBy('total')->limit(8)->get()->toArray();
        }

        // Most frequently used keywords
        if (str_contains($msg, 'keyword')) {
            $data['top_keywords'] = DB::table('keywords')
                ->join('capstone_keyword', 'keywords.id', '=', 'capstone_keyword.keyword_id')
                ->selectRaw('keywords.name, COUNT(*) as total')
                ->groupBy('keywords.name')->orderByDesc('total')->limit(10)->get()->toArray();
        }

        // Most prolific authors
        if (str_contains($msg, 'prolific') || str_contains($msg, 'most capstone author')) {
            $data['top_authors'] = Capstone::selectRaw('author, COUNT(*) as total')
                ->whereNotNull('author')->groupBy('author')->orderByDesc('total')->limit(8)->get()->toArray();
        }

        // Who uploaded the most
        if (str_contains($msg, 'uploaded the most') || str_contains($msg, 'upload the most')) {
            $data['top_uploaders'] = DB::table('capstones')
                ->join('users', 'capstones.uploaded_by', '=', 'users.id')
                ->selectRaw('users.name, COUNT(*) as total')
                ->groupBy('users.id', 'users.name')->orderByDesc('total')->limit(8)->get()->toArray();
        }

        // Capstones with no views since publishing
        if (str_contains($msg, 'never been viewed') || str_contains($msg, 'never viewed')) {
            $data['unviewed_count'] = Capstone::where('publication_status', 'published')->where('view_count', 0)->count();
            $data['unviewed_examples'] = Capstone::where('publication_status', 'published')->where('view_count', 0)
                ->limit(5)->get(['id', 'title', 'author', 'year', 'program'])->toArray();
        }

        // Capstones with no PDF
        if (str_contains($msg, 'no pdf')) {
            $data['no_pdf_count'] = Capstone::whereNull('pdf_path')->count();
        }

        // Capstones with no keywords
        if (str_contains($msg, 'no keyword')) {
            $data['no_keywords_count'] = Capstone::doesntHave('keywords')->where('publication_status', 'published')->count();
        }

        // Users who never logged in — return full list, not just count
        if (str_contains($msg, 'never logged in')) {
            $neverLoggedIn = User::whereNull('last_active_at')
                ->get(['id', 'name', 'email'])->toArray();
            $data['never_logged_in_count'] = count($neverLoggedIn);
            $data['never_logged_in_list']  = $neverLoggedIn;
        }

        // Most active users this month — max 3, exclude admins
        if (str_contains($msg, 'most active')) {
            // Always set key so formatProgramStats can show "no activity" message
            $data['active_users'] = User::whereMonth('last_active_at', now()->month)
                ->whereYear('last_active_at', now()->year)
                ->whereHas('role', fn($q) => $q->where('name', '!=', 'admin'))
                ->orderByDesc('last_active_at')->limit(3)
                ->get(['id', 'name', 'last_active_at'])->toArray();
        }

        // Archived vs published
        if (str_contains($msg, 'archived vs') || str_contains($msg, 'archived and published')) {
            $data['archived_count']  = Capstone::where('is_archived', true)->count();
            $data['published_count'] = Capstone::where('publication_status', 'published')->where('is_archived', false)->count();
        }

        // Duplicate / repeated titles
        if (str_contains($msg, 'appear more than once') || str_contains($msg, 'duplicate')) {
            // Always set key so formatProgramStats can show "no duplicates" message
            $data['duplicate_titles'] = DB::table('capstones')
                ->selectRaw('title, COUNT(*) as total')
                ->groupBy('title')->havingRaw('COUNT(*) > 1')
                ->orderByDesc('total')->limit(10)->get()->toArray();
        }

        // Overdone topics in program (global — non-advisory context)
        if (str_contains($msg, 'overdone')) {
            $data['overdone_keywords'] = DB::table('keywords')
                ->join('capstone_keyword', 'keywords.id', '=', 'capstone_keyword.keyword_id')
                ->selectRaw('keywords.name, COUNT(*) as total')
                ->groupBy('keywords.name')->havingRaw('COUNT(*) > 3')
                ->orderByDesc('total')->limit(8)->get()->toArray();
        }

        // Total capstones in archive (is_archived = true)
        if (str_contains($msg, 'in the archive in total') || str_contains($msg, 'archive in total')
            || preg_match('/how many capstones are in the archive/i', $msg)) {
            $data['archived_total_count'] = Capstone::where('is_archived', true)->count();
        }

        // Capstones with no IMRAD attached
        if (str_contains($msg, 'no imrad') || str_contains($msg, 'imrad attached') || preg_match('/imrad/i', $msg)) {
            $noImrad = Capstone::whereNull('imrad_path')->get(['id', 'title'])->toArray();
            $data['no_imrad_count'] = count($noImrad);
            $data['no_imrad_list']  = $noImrad;
        }

        // Capstones with publication_status = 'published'
        if (preg_match('/how many capstones? are published|how many.*published/i', $msg)
            || str_contains($msg, 'are published')) {
            $published = Capstone::where('publication_status', 'published')->get(['id', 'title'])->toArray();
            $data['publication_published_count'] = count($published);
            $data['publication_published_list']  = $published;
        }

        // Capstones with copyright_status = 'copyrighted'
        if (preg_match('/how many capstones? are copyrighted|copyrighted/i', $msg)) {
            $copyrighted = Capstone::where('copyright_status', 'copyrighted')->get(['id', 'title'])->toArray();
            $data['copyrighted_count'] = count($copyrighted);
            $data['copyrighted_list']  = $copyrighted;
        }

        return $data;
    }

    // ── Student Research Stats ────────────────────────────────────────────────

    /**
     * Get list of all faculty members (for adviser selection).
     *
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getAllFaculty(): \Illuminate\Database\Eloquent\Collection
    {
        return User::whereHas('role', fn($q) => $q->where('name', 'faculty'))
            ->orderBy('name')
            ->get(['id', 'name']);
    }

    /**
     * Get capstones supervised by a specific adviser.
     *
     * @param int $adviserId
     * @return \Illuminate\Database\Eloquent\Collection
     */
    public function getCapstonesByAdviser(int $adviserId): \Illuminate\Database\Eloquent\Collection
    {
        return Capstone::where('adviser_id', $adviserId)
            ->orderByDesc('year')
            ->get(['id', 'title', 'author', 'year', 'program', 'category']);
    }

    /**
     * Get the most popular research topic (category with most capstones).
     *
     * @return array{category: string, count: int}|null
     */
    public function getMostPopularTopic(): ?array
    {
        $result = Capstone::whereNotNull('category')
            ->selectRaw('category, COUNT(*) as count')
            ->groupBy('category')
            ->orderByDesc('count')
            ->first();

        return $result ? ['category' => $result->category, 'count' => $result->count] : null;
    }

    /**
     * Get capstone submission counts per year (all available years).
     *
     * @return Collection
     */
    public function getSubmissionsPerYear(): Collection
    {
        return Capstone::selectRaw('year, COUNT(*) as total')
            ->whereNotNull('year')
            ->groupBy('year')
            ->orderBy('year')
            ->get();
    }

    /**
     * Get advisers who handle the most research projects.
     *
     * @param int $limit
     * @return Collection
     */
    public function getTopAdvisers(int $limit = 10): Collection
    {
        return DB::table('capstones')
            ->join('users', 'capstones.adviser_id', '=', 'users.id')
            ->selectRaw('users.id, users.name, COUNT(*) as total')
            ->whereNotNull('capstones.adviser_id')
            ->groupBy('users.id', 'users.name')
            ->orderByDesc('total')
            ->limit($limit)
            ->get();
    }

    /**
     * Get the most referenced capstone.
     *
     * @return array{capstone: array, count: int}|null
     */
    public function getMostReferencedCapstone(): ?array
    {
        $result = DB::table('capstone_references')
            ->select('referenced_capstone_id', DB::raw('COUNT(*) as reference_count'))
            ->groupBy('referenced_capstone_id')
            ->orderByDesc('reference_count')
            ->first();

        if (!$result) {
            return null;
        }

        $capstone = Capstone::find($result->referenced_capstone_id, ['id', 'title', 'author', 'year', 'program']);

        if (!$capstone) {
            return null;
        }

        return [
            'capstone' => $capstone->toArray(),
            'count' => $result->reference_count,
        ];
    }
}
