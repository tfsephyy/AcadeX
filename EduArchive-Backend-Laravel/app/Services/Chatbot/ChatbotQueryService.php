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
     * - Admin → all capstones.
     * - Faculty / Student → approved non-archived library capstones (plus own uploads/reviews).
     * - Visitor → non-archived approved capstones that meet a visitor tier (published, copyrighted, or IMRAD).
     *
     * @return \Illuminate\Database\Eloquent\Builder
     */
    public function baseQuery(string $role, ?\App\Models\User $user = null)
    {
        $query = Capstone::with('keywords');

        if ($role === 'admin' || ($user && $user->hasRole('admin'))) {
            return $query;
        }

        $query->where('is_archived', false);

        if ($role === 'visitor') {
            $query->where('approval_status', 'approved')
                  ->where(function ($tier) {
                      $tier->where('publication_status', 'published')
                           ->orWhere('copyright_status', 'copyrighted')
                           ->orWhereNotNull('imrad_path');
                  });
            return $query;
        }

        // Student and Faculty: approved library capstones, plus own uploads/reviews if user provided
        $query->where(function ($allowed) use ($user) {
            $allowed->where('approval_status', 'approved');
            if ($user) {
                $allowed->orWhere('uploaded_by', $user->id);
                if ($user->hasRole('faculty')) {
                    $allowed->orWhere('adviser_id', $user->id);
                }
            }
        });

        return $query;
    }

    // ── Search / Recommend ────────────────────────────────────────────────────

    /**
     * Full-text keyword search with NLP expansion, year, and author filters.
     * Returns up to 10 results, ordered newest-first.
     */
    public function search(string $role, string $message, array $filters = [], ?\App\Models\User $user = null): Collection
    {
        $terms = $this->nlp->expandTerms($message);
        $query = $this->baseQuery($role, $user);

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
    public function popular(string $role, string $metric = 'view_count', int $limit = 10, bool $thisYear = false, ?\App\Models\User $user = null): Collection
    {
        $allowed = ['view_count', 'download_count', 'bookmark_count'];
        if (!in_array($metric, $allowed)) $metric = 'view_count';

        $query = $this->baseQuery($role, $user);

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
    public function recent(string $role, int $limit = 5, ?\App\Models\User $user = null): Collection
    {
        return $this->baseQuery($role, $user)
                    ->orderByDesc('created_at')
                    ->limit($limit)
                    ->get(['id', 'title', 'author', 'year', 'program', 'category']);
    }

    /**
     * Get category list with counts for the role's accessible capstones.
     */
    public function categories(string $role, ?\App\Models\User $user = null): \Illuminate\Support\Collection
    {
        return $this->baseQuery($role, $user)
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
    public function findById(string $role, int $id, ?\App\Models\User $user = null): ?Capstone
    {
        return $this->baseQuery($role, $user)
                    ->with(['keywords'])
                    ->where('id', $id)
                    ->first();
    }

    /**
     * Finds related capstones based on shared category, program, or keywords.
     */
    public function findSimilar(string $role, Capstone $capstone, int $limit = 4, ?\App\Models\User $user = null): Collection
    {
        $query = $this->baseQuery($role, $user)
            ->where('id', '!=', $capstone->id);

        $query->where(function ($q) use ($capstone) {
            $hasCondition = false;
            if (!empty($capstone->category)) {
                $q->orWhere('category', $capstone->category);
                $hasCondition = true;
            }
            if (!empty($capstone->program)) {
                $q->orWhere('program', $capstone->program);
                $hasCondition = true;
            }
            if (!$hasCondition) {
                $q->whereNotNull('id');
            }
        });

        return $query->orderByDesc('year')
                     ->orderByDesc('created_at')
                     ->limit($limit)
                     ->get(['id', 'title', 'author', 'year', 'program', 'category', 'abstract']);
    }
}
