<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Models\Bookmark;
use App\Models\Keyword;
use App\Models\User;
use App\Services\NlpSearchService;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class PublishedCapstoneController extends Controller
{
    use ApiResponses;

    /**
     * List all published capstones with search/filter.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Capstone::with(['keywords', 'uploader:id,name', 'adviser:id,name'])
            ->published()
            ->where('is_archived', false);

        // NLP-enhanced search
        if ($request->has('search') && $request->search) {
            $this->applyNlpSearch($query, $request->search);
        }

        // Filter by year
        if ($request->has('year') && $request->year) {
            $query->where('year', $request->year);
        }

        // Filter by program
        if ($request->has('program') && $request->program) {
            $query->where('program', $request->program);
        }

        // Filter by category
        if ($request->has('category') && $request->category) {
            $query->where('category', $request->category);
        }

        // Filter by keyword
        if ($request->has('keyword') && $request->keyword) {
            $query->whereHas('keywords', function ($q) use ($request) {
                $q->where('name', 'like', "%{$request->keyword}%");
            });
        }

        // Filter by adviser
        if ($request->has('adviser_id') && $request->adviser_id) {
            $query->where('adviser_id', $request->adviser_id);
        }

        // Sort
        $sortBy = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortBy, $sortDir);

        $capstones = $query->paginate($request->get('per_page', 12));

        // Add is_bookmarked flag for authenticated user
        $userId = $request->user()?->id;
        if ($userId) {
            $bookmarkedIds = Bookmark::where('user_id', $userId)
                ->whereIn('capstone_id', $capstones->pluck('id'))
                ->pluck('capstone_id')
                ->toArray();

            $capstones->getCollection()->transform(function ($capstone) use ($bookmarkedIds) {
                $capstone->is_bookmarked = in_array($capstone->id, $bookmarkedIds);
                return $capstone;
            });
        }

        return $this->successResponse($capstones, 'Published capstones retrieved.');
    }

    /**
     * Get distinct years for filter dropdown.
     */
    public function years(): JsonResponse
    {
        $years = Capstone::published()
            ->where('is_archived', false)
            ->whereNotNull('year')
            ->distinct()
            ->orderByDesc('year')
            ->pluck('year');

        return $this->successResponse($years, 'Years retrieved.');
    }

    /**
     * Get distinct programs for filter dropdown.
     */
    public function programs(): JsonResponse
    {
        $programs = Capstone::published()
            ->where('is_archived', false)
            ->whereNotNull('program')
            ->where('program', '!=', '')
            ->distinct()
            ->orderBy('program')
            ->pluck('program');

        return $this->successResponse($programs, 'Programs retrieved.');
    }

    /**
     * Get distinct advisers (id + name) for published capstones.
     */
    public function advisers(): JsonResponse
    {
        $adviserIds = Capstone::published()
            ->where('is_archived', false)
            ->whereNotNull('adviser_id')
            ->distinct()
            ->pluck('adviser_id');

        $advisers = User::whereIn('id', $adviserIds)
            ->orderBy('name')
            ->get(['id', 'name']);

        return $this->successResponse($advisers, 'Advisers retrieved.');
    }

    /**
     * Get all keywords for filter.
     */
    public function keywords(): JsonResponse
    {
        $keywords = \App\Models\Keyword::orderBy('name')->pluck('name');

        return $this->successResponse($keywords, 'Keywords retrieved.');
    }

    /**
     * Get distinct categories for combobox dropdown.
     */
    public function categories(): JsonResponse
    {
        $categories = Capstone::published()
            ->where('is_archived', false)
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->selectRaw('category as name, COUNT(*) as count')
            ->groupBy('category')
            ->orderBy('category')
            ->get();

        return $this->successResponse($categories, 'Categories retrieved.');
    }
    /**
     * Keyword autocomplete suggest — returns up to $limit keywords matching ?q=
     * Used by the SearchWithSuggestions frontend component.
     */
    public function suggest(Request $request): JsonResponse
    {
        $q     = trim($request->get('q', ''));
        $limit = min((int) $request->get('limit', 8), 20);

        if (strlen($q) < 1) {
            return $this->successResponse([], 'No query.');
        }

        // Also expand abbreviations so "ML" suggests "machine learning" keywords
        $nlp   = new NlpSearchService();
        $terms = $nlp->extractMeaningfulTerms($q);

        $keywords = Keyword::where(function ($kq) use ($q, $terms) {
            $kq->where('name', 'LIKE', "%{$q}%");
            foreach ($terms as $term) {
                $kq->orWhere('name', 'LIKE', "%{$term}%");
            }
        })
        ->orderByRaw('LENGTH(name) ASC')
        ->limit($limit)
        ->pluck('name');

        return $this->successResponse($keywords, 'Keyword suggestions retrieved.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // NLP Search Helper
    // ────────────────────────────────────────────────────────────────────────

    private function applyNlpSearch(
        \Illuminate\Database\Eloquent\Builder $query,
        string $rawSearch
    ): void {
        $nlp           = new NlpSearchService();
        $expandedTerms = $nlp->expandTerms($rawSearch);
        $fulltextQuery = $nlp->buildFulltextQuery($rawSearch);

        $query->where(function ($q) use ($rawSearch, $expandedTerms, $fulltextQuery) {
            // 1. FULLTEXT ranked search
            if (!empty($fulltextQuery)) {
                try {
                    $q->orWhereRaw(
                        'MATCH(title, author, abstract, category) AGAINST(? IN BOOLEAN MODE)',
                        [$fulltextQuery]
                    );
                } catch (\Throwable) {}
            }
            // 2. LIKE per expanded term
            foreach ($expandedTerms as $term) {
                $like = "%{$term}%";
                $q->orWhere('title',    'LIKE', $like)
                  ->orWhere('author',   'LIKE', $like)
                  ->orWhere('abstract', 'LIKE', $like)
                  ->orWhere('category', 'LIKE', $like);
            }
            // 3. Raw LIKE safety net
            $q->orWhere('title',  'LIKE', "%{$rawSearch}%")
              ->orWhere('author', 'LIKE', "%{$rawSearch}%");
            // 4. Keyword relation
            $q->orWhereHas('keywords', function ($kq) use ($expandedTerms, $rawSearch) {
                $kq->where(function ($inner) use ($expandedTerms, $rawSearch) {
                    foreach ($expandedTerms as $term) {
                        $inner->orWhere('name', 'LIKE', "%{$term}%");
                    }
                    $inner->orWhere('name', 'LIKE', "%{$rawSearch}%");
                });
            });
        });
    }
}
