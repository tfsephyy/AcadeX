<?php

namespace App\Services\Chatbot;

use App\Models\Capstone;
use App\Services\NlpSearchService;
use Illuminate\Database\Eloquent\Collection;

/**
 * ChatbotQueryService
 *
 * Builds role-scoped Eloquent queries for capstone search/recommendations.
 * The base query is constructed based on the user's role BEFORE any filters
 * are applied — this guarantees restricted records never reach the AI.
 */
class ChatbotQueryService
{
    private NlpSearchService $nlp;

    public function __construct()
    {
        $this->nlp = new NlpSearchService();
    }

    // ── Base query (access-control layer) ─────────────────────────────────────

    /**
     * Build a base Capstone query filtered to what the role is allowed to see.
     *
     * - Admin / Faculty / Student → all published, non-archived capstones.
     * - Visitor → only capstones that are published OR copyrighted OR have IMRAD,
     *   matching the existing VisitorCapstoneController visibility rules.
     *
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function baseQuery(string $role)
    {
        $query = Capstone::with('keywords');

        if ($role === ChatbotPermissionService::ROLE_VISITOR) {
            $query->where('is_archived', false)
                  ->where(function ($q) {
                      $q->where('publication_status', 'published')
                        ->orWhere('copyright_status', 'copyrighted')
                        ->orWhereNotNull('imrad_path');
                  });
        } else {
            // Admin, Faculty, Student
            $query->where('publication_status', 'published')
                  ->where('is_archived', false);
        }

        return $query;
    }

    // ── Search / Recommend ────────────────────────────────────────────────────

    /**
     * Full-text keyword search with NLP expansion, year, and author filters.
     * Returns up to 10 results, ordered newest-first.
     */
    public function search(string $role, string $message, array $filters = []): Collection
    {
        $terms = $this->nlp->expandTerms($message);
        $query = $this->baseQuery($role);

        // Year filters
        if (!empty($filters['year']))      $query->where('year', $filters['year']);
        if (!empty($filters['year_from'])) $query->where('year', '>=', $filters['year_from']);
        if (!empty($filters['year_to']))   $query->where('year', '<=', $filters['year_to']);

        // Author filter
        if (!empty($filters['author'])) {
            $query->where('author', 'LIKE', '%' . $filters['author'] . '%');
        }

        // Keyword / term search
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
        }

        return $query->orderByDesc('year')
                     ->limit(10)
                     ->get(['id', 'title', 'author', 'year', 'program', 'category', 'abstract',
                            'copyright_status', 'imrad_path', 'view_count', 'download_count']);
    }

    /**
     * Return popular capstones ranked by a given metric.
     * Metric must be one of: view_count, download_count, bookmark_count.
     * $limit: how many results to return (default 10).
     * $thisYear: if true, restrict to capstones where the bookmark was created this year.
     *
     * NOTE: Queries ALL capstones regardless of publication_status / copyright_status /
     *       is_archived — so the results match the live counts shown on each capstone's
     *       analytics panel (which also reads directly from the capstones table).
     */
    public function popular(string $role, string $metric = 'view_count', int $limit = 10, bool $thisYear = false): Collection
    {
        $allowed = ['view_count', 'download_count', 'bookmark_count'];
        if (!in_array($metric, $allowed)) $metric = 'view_count';

        // Query ALL capstones — no publication/copyright filter — so the counts
        // are the same numbers the analytics panel shows on the capstone main page.
        $query = Capstone::query();

        if ($thisYear) {
            // For bookmarks "this year": join the bookmarks table and restrict by year
            if ($metric === 'bookmark_count') {
                $query->whereExists(function ($sub) {
                    $sub->from('bookmarks')
                        ->whereColumn('bookmarks.capstone_id', 'capstones.id')
                        ->whereYear('bookmarks.created_at', now()->year);
                });
            } else {
                $query->whereYear('created_at', now()->year);
            }
        }

        return $query->orderByDesc($metric)
                     ->where($metric, '>', 0)
                     ->limit($limit)
                     ->get(['id', 'title', 'author', 'year', 'program', 'category', $metric]);
    }

    /**
     * Return the most recently uploaded accessible capstones.
     */
    public function recent(string $role, int $limit = 5): Collection
    {
        return $this->baseQuery($role)
                    ->orderByDesc('created_at')
                    ->limit($limit)
                    ->get(['id', 'title', 'author', 'year', 'program', 'category']);
    }

    /**
     * Get category list with counts for the role's accessible capstones.
     */
    public function categories(string $role): \Illuminate\Support\Collection
    {
        return $this->baseQuery($role)
                    ->whereNotNull('category')
                    ->selectRaw('category, COUNT(*) as count')
                    ->groupBy('category')
                    ->orderByDesc('count')
                    ->pluck('count', 'category');
    }

    /**
     * Fetch a single capstone by ID, respecting role access rules.
     * Returns null if not found or not accessible to the role.
     */
    public function findById(string $role, int $id): ?Capstone
    {
        return $this->baseQuery($role)
                    ->with(['keywords'])
                    ->where('id', $id)
                    ->first();
    }
}
