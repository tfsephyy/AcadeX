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
            'total_published'     => Capstone::where('is_published', true)->where('is_archived', false)->count(),
            'total_all'           => Capstone::count(),
            'pending_approval'    => Capstone::where('status', 'pending')->count(),
            'total_archived'      => Capstone::where('is_archived', true)->count(),
            'uploads_this_year'   => Capstone::whereYear('created_at', now()->year)->count(),
            'uploads_this_month'  => Capstone::whereMonth('created_at', now()->month)
                                             ->whereYear('created_at', now()->year)->count(),
            'with_imrad'          => Capstone::where('is_published', true)->whereNotNull('imrad_path')->count(),
            'without_imrad'       => Capstone::where('is_published', true)->whereNull('imrad_path')->count(),
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
            ->where('is_published', true)
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
        return Capstone::where('is_published', true)
            ->orderByDesc('view_count')
            ->limit($limit)
            ->get(['id', 'title', 'author', 'year', 'category', 'view_count']);
    }

    public function mostDownloaded(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return Capstone::where('is_published', true)
            ->orderByDesc('download_count')
            ->limit($limit)
            ->get(['id', 'title', 'author', 'year', 'category', 'download_count']);
    }

    public function mostBookmarked(int $limit = 10): \Illuminate\Database\Eloquent\Collection
    {
        return Capstone::where('is_published', true)
            ->orderByDesc('bookmark_count')
            ->limit($limit)
            ->get(['id', 'title', 'author', 'year', 'category', 'bookmark_count']);
    }

    // ── Activity logs ─────────────────────────────────────────────────────────

    /**
     * Recent login attempts (success + failed).
     */
    public function recentLogins(int $limit = 10): \Illuminate\Database\Eloquent\Collection
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
     */
    public function programStats(string $msg, string $role): array
    {
        $msg = strtolower($msg);
        $data = [];

        // Which year had the most submissions?
        if (str_contains($msg, 'which year') || str_contains($msg, 'year had the most')) {
            $data['year_counts'] = Capstone::selectRaw('year, COUNT(*) as total')
                ->groupBy('year')->orderByDesc('total')->limit(5)->get()->toArray();
        }

        // Which program has the most submissions?
        if (str_contains($msg, 'which program') || str_contains($msg, 'most capstone submission')) {
            $data['program_counts'] = Capstone::selectRaw('program, COUNT(*) as total')
                ->whereNotNull('program')->groupBy('program')->orderByDesc('total')->limit(8)->get()->toArray();
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
            $data['unviewed_count'] = Capstone::where('is_published', true)->where('view_count', 0)->count();
            $data['unviewed_examples'] = Capstone::where('is_published', true)->where('view_count', 0)
                ->limit(5)->get(['id', 'title', 'author', 'year', 'program'])->toArray();
        }

        // Capstones with no PDF
        if (str_contains($msg, 'no pdf')) {
            $data['no_pdf_count'] = Capstone::whereNull('pdf_path')->count();
        }

        // Capstones with no keywords
        if (str_contains($msg, 'no keyword')) {
            $data['no_keywords_count'] = Capstone::doesntHave('keywords')->where('is_published', true)->count();
        }

        // Users who never logged in
        if (str_contains($msg, 'never logged in')) {
            $data['never_logged_in'] = User::whereNull('last_active_at')->count();
        }

        // Most active users this month
        if (str_contains($msg, 'most active')) {
            $data['active_users'] = User::whereMonth('last_active_at', now()->month)
                ->whereYear('last_active_at', now()->year)
                ->orderByDesc('last_active_at')->limit(8)
                ->get(['id', 'name', 'last_active_at'])->toArray();
        }

        // Archived vs published
        if (str_contains($msg, 'archived vs') || str_contains($msg, 'archived and published')) {
            $data['archived_count']  = Capstone::where('is_archived', true)->count();
            $data['published_count'] = Capstone::where('is_published', true)->where('is_archived', false)->count();
        }

        // Duplicate / repeated titles
        if (str_contains($msg, 'appear more than once') || str_contains($msg, 'duplicate')) {
            $data['duplicate_titles'] = DB::table('capstones')
                ->selectRaw('title, COUNT(*) as total')
                ->groupBy('title')->havingRaw('COUNT(*) > 1')
                ->orderByDesc('total')->limit(10)->get()->toArray();
        }

        // Overdone topics in program
        if (str_contains($msg, 'overdone')) {
            $data['overdone_keywords'] = DB::table('keywords')
                ->join('capstone_keyword', 'keywords.id', '=', 'capstone_keyword.keyword_id')
                ->selectRaw('keywords.name, COUNT(*) as total')
                ->groupBy('keywords.name')->havingRaw('COUNT(*) > 3')
                ->orderByDesc('total')->limit(8)->get()->toArray();
        }

        // Total capstones in archive
        if (str_contains($msg, 'how many capstones') || str_contains($msg, 'total') || str_contains($msg, 'in total')) {
            $data['total_capstones'] = Capstone::count();
            $data['published_capstones'] = Capstone::where('is_published', true)->count();
        }

        return $data;
    }
}
