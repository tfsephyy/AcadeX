<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Models\Bookmark;
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
        $query = Capstone::with(['keywords', 'uploader:id,name'])
            ->published()
            ->where('is_archived', false);

        // Search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%")
                  ->orWhere('abstract', 'like', "%{$search}%")
                  ->orWhereHas('keywords', function ($kq) use ($search) {
                      $kq->where('name', 'like', "%{$search}%");
                  });
            });
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
            ->whereNotNull('program')
            ->distinct()
            ->pluck('program');

        return $this->successResponse($programs, 'Programs retrieved.');
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
        $categories = Capstone::whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        return $this->successResponse($categories, 'Categories retrieved.');
    }
}
