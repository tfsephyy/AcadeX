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
}
