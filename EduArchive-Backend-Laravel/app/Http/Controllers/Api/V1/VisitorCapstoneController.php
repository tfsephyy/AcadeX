<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Services\NlpSearchService;
use App\Services\PdfEncryptorService;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * VisitorCapstoneController
 *
 * Visitor visibility rules:
 *   1. publication_status = 'published'       → full capstone PDF accessible
 *   2. copyright_status = 'copyrighted'       → full capstone PDF accessible
 *   3. has imrad_path but NOT (1) or (2)      → IMRAD-only (capstone PDF hidden)
 *   4. None of the above                      → not shown to visitor
 *
 * Visitors NEVER have download access.
 */
class VisitorCapstoneController extends Controller
{
    use ApiResponses;

    // ──────────────────────────────────────────────────────────────
    // Query Helpers
    // ──────────────────────────────────────────────────────────────

    /**
     * Base query: capstones visible to visitors.
     * Capstone must be published, copyrighted, or have an IMRAD.
     */
    private function visibleQuery()
    {
        return Capstone::with(['keywords', 'uploader:id,name', 'adviser:id,name'])
            ->where('is_archived', false)
            ->where(function ($q) {
                $q->where('publication_status', 'published')
                  ->orWhere('copyright_status', 'copyrighted')
                  ->orWhereNotNull('imrad_path');
            });
    }

    /**
     * Whether the visitor may see the capstone PDF for this record.
     */
    private function canSeeCapstonePdf(Capstone $capstone): bool
    {
        return $capstone->publication_status === 'published' || $capstone->copyright_status === 'copyrighted';
    }

    // ──────────────────────────────────────────────────────────────
    // List
    // ──────────────────────────────────────────────────────────────

    public function index(Request $request): JsonResponse
    {
        $query = $this->visibleQuery();

        // NLP-enhanced search (reuse existing service)
        if ($request->filled('search')) {
            $this->applyNlpSearch($query, $request->search);
        }

        if ($request->filled('year'))       $query->where('year', $request->year);
        if ($request->filled('program'))    $query->where('program', $request->program);
        if ($request->filled('category'))   $query->where('category', $request->category);
        if ($request->filled('adviser_id')) $query->where('adviser_id', $request->adviser_id);

        if ($request->filled('keyword')) {
            $query->whereHas('keywords', fn($q) =>
                $q->where('name', 'like', "%{$request->keyword}%")
            );
        }

        $sortBy  = $request->get('sort_by', 'created_at');
        $sortDir = $request->get('sort_dir', 'desc');
        $query->orderBy($sortBy, $sortDir);

        $capstones = $query->paginate($request->get('per_page', 12));

        // Annotate each record with what the visitor can see
        $capstones->getCollection()->transform(function ($c) {
            $c->visitor_can_see_pdf   = $this->canSeeCapstonePdf($c);
            $c->visitor_imrad_only    = !$this->canSeeCapstonePdf($c) && !empty($c->imrad_path);
            return $c;
        });

        return $this->successResponse($capstones, 'Visitor capstones retrieved.');
    }

    // ──────────────────────────────────────────────────────────────
    // Filter option helpers
    // ──────────────────────────────────────────────────────────────

    public function years(): JsonResponse
    {
        $years = $this->visibleQuery()->whereNotNull('year')->distinct()->orderByDesc('year')->pluck('year');
        return $this->successResponse($years, 'Years retrieved.');
    }

    public function programs(): JsonResponse
    {
        $programs = $this->visibleQuery()->whereNotNull('program')->where('program', '!=', '')->distinct()->orderBy('program')->pluck('program');
        return $this->successResponse($programs, 'Programs retrieved.');
    }

    public function categories(): JsonResponse
    {
        $cats = $this->visibleQuery()->whereNotNull('category')->where('category', '!=', '')->selectRaw('category as name, COUNT(*) as count')->groupBy('category')->orderBy('category')->get();
        return $this->successResponse($cats, 'Categories retrieved.');
    }

    public function advisers(): JsonResponse
    {
        $advisers = \App\Models\User::whereHas('advisedCapstones', function ($q) {
            $q->where('is_archived', false)->where(function ($inner) {
                $inner->where('publication_status', 'published')
                      ->orWhere('copyright_status', 'copyrighted')
                      ->orWhereNotNull('imrad_path');
            });
        })->select('id', 'name')->orderBy('name')->get();
        return $this->successResponse($advisers, 'Advisers retrieved.');
    }

    public function keywords(): JsonResponse
    {
        $kws = \App\Models\Keyword::orderBy('name')->pluck('name');
        return $this->successResponse($kws, 'Keywords retrieved.');
    }

    public function suggest(Request $request): JsonResponse
    {
        $q     = trim($request->get('q', ''));
        $limit = min((int) $request->get('limit', 8), 20);
        if (strlen($q) < 1) return $this->successResponse([], 'No query.');

        $nlp   = new NlpSearchService();
        $terms = $nlp->extractMeaningfulTerms($q);

        $keywords = \App\Models\Keyword::where(function ($kq) use ($q, $terms) {
            $kq->where('name', 'LIKE', "%{$q}%");
            foreach ($terms as $term) {
                $kq->orWhere('name', 'LIKE', "%{$term}%");
            }
        })->orderByRaw('LENGTH(name) ASC')->limit($limit)->pluck('name');

        return $this->successResponse($keywords, 'Suggestions retrieved.');
    }

    // ──────────────────────────────────────────────────────────────
    // Show single
    // ──────────────────────────────────────────────────────────────

    public function show(Request $request, Capstone $capstone): JsonResponse
    {
        // Enforce visibility: capstone must be in the visitor-visible set
        $visible = $capstone->is_archived === false && (
            $capstone->publication_status === 'published' ||
            $capstone->copyright_status === 'copyrighted' ||
            !empty($capstone->imrad_path)
        );

        if (!$visible) {
            return $this->errorResponse('Capstone not found.', 404);
        }

        $capstone->load(['keywords', 'uploader:id,name', 'adviser:id,name', 'resources', 'referencedCapstones:id,title,author,year,program']);

        $data = $capstone->toArray();
        $data['visitor_can_see_pdf'] = $this->canSeeCapstonePdf($capstone);
        $data['visitor_imrad_only']  = !$this->canSeeCapstonePdf($capstone) && !empty($capstone->imrad_path);

        return $this->successResponse($data, 'Capstone retrieved.');
    }

    // ──────────────────────────────────────────────────────────────
    // PDF serving — NO download endpoint for visitors
    // ──────────────────────────────────────────────────────────────

    /**
     * Serve the capstone PDF — only if visitor is permitted.
     */
    public function servePdf(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        if (!$this->canSeeCapstonePdf($capstone)) {
            return $this->errorResponse('You do not have permission to view this file.', 403);
        }

        if (!$capstone->pdf_path || !Storage::disk('local')->exists($capstone->pdf_path)) {
            return $this->errorResponse('PDF file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $rawBytes  = $encryptor->decryptFromDisk($capstone->pdf_path);

        if ($rawBytes === null) {
            return $this->errorResponse('PDF could not be decrypted.', 500);
        }

        return response()->stream(
            fn() => print($rawBytes),
            200,
            [
                'Content-Type'           => 'application/pdf',
                'Content-Disposition'    => 'inline',
                'Content-Length'         => strlen($rawBytes),
                'Cache-Control'          => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                 => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }

    /**
     * Serve the IMRAD PDF — available whenever imrad_path is set.
     */
    public function serveImrad(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        if (!$capstone->imrad_path || !Storage::disk('local')->exists($capstone->imrad_path)) {
            return $this->errorResponse('IMRAD file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $rawBytes  = $encryptor->decryptFromDisk($capstone->imrad_path);

        if ($rawBytes === null) {
            return $this->errorResponse('IMRAD file could not be decrypted.', 500);
        }

        return response()->stream(
            fn() => print($rawBytes),
            200,
            [
                'Content-Type'           => 'application/pdf',
                'Content-Disposition'    => 'inline',
                'Content-Length'         => strlen($rawBytes),
                'Cache-Control'          => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                 => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ]
        );
    }

    // ──────────────────────────────────────────────────────────────
    // NLP search helper (same as PublishedCapstoneController)
    // ──────────────────────────────────────────────────────────────

    private function applyNlpSearch(\Illuminate\Database\Eloquent\Builder $query, string $rawSearch): void
    {
        $nlp           = new NlpSearchService();
        $expandedTerms = $nlp->expandTerms($rawSearch);
        $fulltextQuery = $nlp->buildFulltextQuery($rawSearch);

        $query->where(function ($q) use ($rawSearch, $expandedTerms, $fulltextQuery) {
            if (!empty($fulltextQuery)) {
                try {
                    $q->orWhereRaw('MATCH(title, author, abstract, category) AGAINST(? IN BOOLEAN MODE)', [$fulltextQuery]);
                } catch (\Throwable) {}
            }
            foreach ($expandedTerms as $term) {
                $like = "%{$term}%";
                $q->orWhere('title', 'LIKE', $like)
                  ->orWhere('author', 'LIKE', $like)
                  ->orWhere('abstract', 'LIKE', $like)
                  ->orWhere('category', 'LIKE', $like);
            }
            $q->orWhere('title',  'LIKE', "%{$rawSearch}%")
              ->orWhere('author', 'LIKE', "%{$rawSearch}%");
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
