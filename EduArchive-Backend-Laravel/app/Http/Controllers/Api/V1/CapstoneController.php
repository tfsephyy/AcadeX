<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Bookmark;
use App\Models\Capstone;
use App\Models\CapstoneResource;
use App\Models\Keyword;
use App\Models\Notification;
use App\Models\User;
use App\Services\PdfEncryptorService;
use App\Services\PdfExtractorService;
use App\Services\PdfTextService;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\Validator;

class CapstoneController extends Controller
{
    use ApiResponses;

    /**
     * List all capstones (admin can filter by status, defaults to all).
     * Faculty users only see their own uploaded capstones.
     */
    public function index(Request $request): JsonResponse
    {
        $query = Capstone::with(['keywords', 'uploader:id,name', 'approver:id,name', 'adviser:id,name']);

        // Faculty users only see their own uploaded capstones
        if ($request->user() && $request->user()->hasRole('faculty')) {
            $query->where('uploaded_by', $request->user()->id);
        }

        // Exclude archived capstones by default
        $query->where('is_archived', false);

        // Filter by status (if provided, otherwise show all)
        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        // Search by title or author
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%");
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

        // Filter by adviser
        if ($request->has('adviser_id') && $request->adviser_id) {
            $query->where('adviser_id', $request->adviser_id);
        }

        $query->orderByDesc('created_at');
        $capstones = $query->paginate($request->get('per_page', 15));

        return $this->successResponse($capstones, 'Capstones retrieved.');
    }

    /**
     * Browse all non-archived capstones — accessible to any authenticated user.
     * Same as admin index() but no role-based scoping so students/faculty
     * see the full library exactly like the admin panel.
     */
    public function browse(Request $request): JsonResponse
    {
        $query = Capstone::with(['keywords', 'uploader:id,name', 'approver:id,name', 'adviser:id,name'])
            ->where('is_archived', false);

        // Search by title, author, or keyword
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%")
                  ->orWhereHas('keywords', fn($kq) => $kq->where('name', 'like', "%{$search}%"));
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

        // Filter by adviser
        if ($request->has('adviser_id') && $request->adviser_id) {
            $query->where('adviser_id', $request->adviser_id);
        }

        $query->orderByDesc('created_at');
        $capstones = $query->paginate($request->get('per_page', 12));

        return $this->successResponse($capstones, 'Capstones retrieved.');
    }

    /**
     * Return distinct filter options for the public browse endpoint.
     * Scoped to non-archived capstones only.
     */
    public function browseFilterOptions(): JsonResponse
    {
        $base = Capstone::where('is_archived', false);

        $years = (clone $base)->whereNotNull('year')->distinct()->orderByDesc('year')->pluck('year');
        $programs = (clone $base)->whereNotNull('program')->where('program', '!=', '')->distinct()->orderBy('program')->pluck('program');
        $categories = (clone $base)->whereNotNull('category')->where('category', '!=', '')->distinct()->orderBy('category')->pluck('category');

        $adviserIds = (clone $base)->whereNotNull('adviser_id')->distinct()->pluck('adviser_id');
        $advisers = User::whereIn('id', $adviserIds)->orderBy('name')->get(['id', 'name']);

        return $this->successResponse([
            'years'      => $years,
            'programs'   => $programs,
            'categories' => $categories,
            'advisers'   => $advisers,
        ], 'Browse filter options retrieved.');
    }

    /**
     * Return distinct years, programs, and advisers for filter dropdowns.
     * Scoped to non-archived capstones visible to the current user.
     */
    public function filterOptions(Request $request): JsonResponse
    {
        $baseQuery = Capstone::where('is_archived', false);

        // Faculty users only see their own uploads
        if ($request->user() && $request->user()->hasRole('faculty')) {
            $baseQuery->where('uploaded_by', $request->user()->id);
        }

        $years = (clone $baseQuery)
            ->whereNotNull('year')
            ->distinct()
            ->orderByDesc('year')
            ->pluck('year');

        $programs = (clone $baseQuery)
            ->whereNotNull('program')
            ->where('program', '!=', '')
            ->distinct()
            ->orderBy('program')
            ->pluck('program');

        $categories = (clone $baseQuery)
            ->whereNotNull('category')
            ->where('category', '!=', '')
            ->distinct()
            ->orderBy('category')
            ->pluck('category');

        $adviserIds = (clone $baseQuery)
            ->whereNotNull('adviser_id')
            ->distinct()
            ->pluck('adviser_id');

        $advisers = User::whereIn('id', $adviserIds)
            ->orderBy('name')
            ->get(['id', 'name']);

        return $this->successResponse([
            'years'      => $years,
            'programs'   => $programs,
            'categories' => $categories,
            'advisers'   => $advisers,
        ], 'Filter options retrieved.');
    }

    /**
     * Show single capstone.
     */
    public function show(Request $request, Capstone $capstone): JsonResponse
    {
        $capstone->load(['keywords', 'uploader:id,name', 'approver:id,name', 'adviser:id,name', 'resources', 'referencedCapstones:id,title,author,year,program']);

        $data = $capstone->toArray();
        $data['is_bookmarked'] = $request->user()
            ? Bookmark::where('user_id', $request->user()->id)
                ->where('capstone_id', $capstone->id)
                ->exists()
            : false;

        return $this->successResponse($data, 'Capstone retrieved.');
    }

    /**
     * Upload and extract PDF data (encrypted at rest).
     */
    public function upload(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'pdf' => 'required|file|mimes:pdf|max:51200', // 50MB max
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $file = $request->file('pdf');

        // Extract text BEFORE encrypting (extractor needs the real file)
        $extractor = new PdfExtractorService();
        $extracted = $extractor->extract($file);

        // Encrypt and store
        $encryptor = new PdfEncryptorService();
        $path = $encryptor->encryptAndStore('capstones', $file);

        return $this->successResponse([
            'pdf_path'          => $path,
            'pdf_original_name' => $file->getClientOriginalName(),
            'extracted'         => $extracted,
        ], 'PDF uploaded and data extracted.');
    }

    /**
     * Upload a resource file (encrypted at rest).
     */
    public function uploadResource(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'file' => 'required|file|max:51200',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $file      = $request->file('file');
        $encryptor = new PdfEncryptorService();
        $path      = $encryptor->encryptAndStore('capstone_resources', $file);

        return $this->successResponse([
            'file_path'          => $path,
            'file_original_name' => $file->getClientOriginalName(),
        ], 'Resource file uploaded.');
    }

    /**
     * Store capstone with extracted/edited data and additional info.
     */
    public function store(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title'              => 'required|string|max:500|unique:capstones,title',
            'year'               => 'nullable|integer|min:2000|max:2099',
            'author'             => 'required|string|max:500',
            'program'            => 'nullable|string|in:BSIT,BSCpE',
            'category'           => 'nullable|string|max:100',
            'abstract'           => 'nullable|string',
            'pdf_path'           => 'required|string',
            'pdf_original_name'  => 'nullable|string',
            'keywords'           => 'nullable|array',
            'keywords.*'         => 'string|max:100',
            'publication_status' => 'nullable|in:published,unpublished,in_progress',
            'copyright_status'   => 'nullable|in:copyrighted,pending,unprotected',
            'imrad_path'         => 'nullable|string',
            'imrad_original_name' => 'nullable|string',
            'adviser_id'         => 'nullable|exists:users,id',
            'references'         => 'nullable|array',
            'references.*'       => 'integer|exists:capstones,id',
            'resources'          => 'nullable|array',
            'resources.*.name'             => 'required|string|max:255',
            'resources.*.file_path'        => 'required|string',
            'resources.*.file_original_name' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $publicationStatus = $request->input('publication_status', 'published');
        // When an admin/faculty uploads a capstone it always gets status=approved,
        // so is_published must always be true so students can find it.
        $isPublished = true;

        $capstone = Capstone::create([
            'title'              => $request->title,
            'year'               => $request->year,
            'author'             => $request->author,
            'program'            => $request->program,
            'category'           => $request->category,
            'abstract'           => $request->abstract,
            'pdf_path'           => $request->pdf_path,
            'pdf_original_name'  => $request->pdf_original_name,
            'uploaded_by'        => $request->user()->id,
            'status'             => 'approved',
            'is_published'       => $isPublished,
            'publication_status' => $publicationStatus,
            'copyright_status'   => $request->copyright_status,
            'imrad_path'         => $request->imrad_path,
            'imrad_original_name' => $request->imrad_original_name,
            'adviser_id'         => $request->adviser_id,
        ]);

        // Attach keywords
        if ($request->has('keywords') && is_array($request->keywords)) {
            $keywordIds = [];
            foreach ($request->keywords as $name) {
                $keyword = Keyword::firstOrCreate(['name' => strtolower(trim($name))]);
                $keywordIds[] = $keyword->id;
            }
            $capstone->keywords()->sync($keywordIds);
        }

        // Attach referenced capstones
        if ($request->has('references') && is_array($request->references)) {
            $refs = array_filter($request->references, fn($id) => $id !== $capstone->id);
            $capstone->referencedCapstones()->sync($refs);
        }

        // Save resource attachments
        if ($request->has('resources') && is_array($request->resources)) {
            foreach ($request->resources as $resource) {
                CapstoneResource::create([
                    'capstone_id'        => $capstone->id,
                    'name'               => $resource['name'],
                    'file_path'          => $resource['file_path'],
                    'file_original_name' => $resource['file_original_name'] ?? null,
                ]);
            }
        }

        // ── Extract full PDF text and store in DB for chatbot ──────────────
        // Done after creation so a failure never blocks the upload.
        try {
            $pdfTextService = new PdfTextService();
            $pdfText = $pdfTextService->extractFromEncryptedPath($capstone->pdf_path);
            if (!empty($pdfText)) {
                $capstone->update(['pdf_text' => $pdfText]);
            }
        } catch (\Throwable $e) {
            \Log::warning('PDF text extraction failed for capstone ' . $capstone->id . ': ' . $e->getMessage());
        }

        AuditLog::log('upload_capstone', $request->user()->id, Capstone::class, $capstone->id);

        // Create notifications for all admins about new capstone upload
        $admins = User::whereHas('role', function ($query) {
            $query->where('name', 'admin');
        })->get();

        foreach ($admins as $admin) {
            Notification::create([
                'admin_id'            => $admin->id,
                'type'                => 'capstone_uploaded',
                'title'               => 'New Capstone Uploaded',
                'message'             => "Capstone '{$capstone->title}' uploaded by {$request->user()->name}",
                'related_user_id'     => $request->user()->id,
                'related_capstone_id' => $capstone->id,
                'is_read'             => false,
            ]);
        }

        $capstone->load(['keywords', 'resources', 'referencedCapstones', 'adviser:id,name']);
        return $this->successResponse($capstone, 'Capstone saved successfully.', 201);
    }

    /**
     * Return a list of faculty users (for adviser picker).
     */
    public function getFacultyList(Request $request): JsonResponse
    {
        $faculty = User::whereHas('role', function ($q) {
                $q->where('name', 'faculty');
            })
            ->where('is_approved', true)
            ->where('is_archived', false)
            ->orderBy('name')
            ->get(['id', 'name']);

        if ($request->has('search') && $request->search) {
            $search = strtolower($request->search);
            $faculty = $faculty->filter(fn($u) => str_contains(strtolower($u->name), $search))->values();
        }

        return $this->successResponse($faculty, 'Faculty list retrieved.');
    }

    /**
     * Approve a capstone.
     */
    public function approve(Request $request, Capstone $capstone): JsonResponse
    {
        if ($capstone->status === 'approved') {
            return $this->errorResponse('Capstone is already approved.', 400);
        }

        $oldStatus = $capstone->status;

        $capstone->update([
            'status'       => 'approved',
            'is_published' => true,
            'is_archived'  => false,
            'approved_by'  => $request->user()->id,
            'approved_at'  => now(),
        ]);

        AuditLog::log(
            'approve_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['status' => $oldStatus],
            ['status' => 'approved']
        );

        return $this->successResponse($capstone, 'Capstone approved and published.');
    }

    /**
     * Reject a capstone (move to archive).
     */
    public function reject(Request $request, Capstone $capstone): JsonResponse
    {
        if ($capstone->status === 'rejected') {
            return $this->errorResponse('Capstone is already rejected.', 400);
        }

        $oldStatus = $capstone->status;

        $capstone->update([
            'status'       => 'rejected',
            'is_published' => false,
            'is_archived'  => true,
        ]);

        AuditLog::log(
            'reject_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['status' => $oldStatus],
            ['status' => 'rejected']
        );

        return $this->successResponse($capstone, 'Capstone rejected and archived.');
    }

    /**
     * Archive a capstone (move to archive folder).
     */
    public function archive(Request $request, Capstone $capstone): JsonResponse
    {
        if ($capstone->is_archived) {
            return $this->errorResponse('Capstone is already archived.', 400);
        }

        $capstone->update([
            'is_archived'  => true,
            'is_published' => false,
        ]);

        AuditLog::log('archive_capstone', $request->user()->id, Capstone::class, $capstone->id);

        return $this->successResponse($capstone, 'Capstone archived.');
    }

    /**
     * List archived capstones.
     */
    public function archived(Request $request): JsonResponse
    {
        $query = Capstone::with(['keywords', 'uploader:id,name'])
            ->archived()
            ->orderByDesc('updated_at');

        // Faculty users only see their own archived capstones
        if ($request->user() && $request->user()->hasRole('faculty')) {
            $query->where('uploaded_by', $request->user()->id);
        }

        // Search by title or author
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%");
            });
        }

        // Filter by program
        if ($request->has('program') && $request->program) {
            $query->where('program', $request->program);
        }

        // Filter by category
        if ($request->has('category') && $request->category) {
            $query->where('category', $request->category);
        }

        $capstones = $query->paginate($request->get('per_page', 15));

        return $this->successResponse($capstones, 'Archived capstones retrieved.');
    }

    /**
     * Unarchive a capstone (move back to pending).
     */
    public function unarchive(Request $request, Capstone $capstone): JsonResponse
    {
        if (!$capstone->is_archived) {
            return $this->errorResponse('Capstone is not archived.', 400);
        }

        $capstone->update([
            'status'       => 'approved',
            'is_archived'  => false,
            'is_published' => true,
        ]);

        AuditLog::log('unarchive_capstone', $request->user()->id, Capstone::class, $capstone->id);

        return $this->successResponse($capstone, 'Capstone unarchived.');
    }

    /**
     * Unpublish a capstone (move approved back to pending).
     */
    public function unpublish(Request $request, Capstone $capstone): JsonResponse
    {
        if ($capstone->status !== 'approved') {
            return $this->errorResponse('Only approved capstones can be unpublished.', 400);
        }

        $oldStatus = $capstone->status;

        $capstone->update([
            'status'       => 'pending',
            'is_published' => false,
            'approved_by'  => null,
            'approved_at'  => null,
        ]);

        AuditLog::log(
            'unpublish_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['status' => $oldStatus],
            ['status' => 'pending']
        );

        return $this->successResponse($capstone, 'Capstone unpublished and moved to pending.');
    }

    /**
     * List all bookmarked capstones (admin view).
     */
    public function adminBookmarks(Request $request): JsonResponse
    {
        $query = Capstone::with(['keywords', 'uploader:id,name', 'approver:id,name'])
            ->whereHas('bookmarks')
            ->withCount('bookmarks');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%");
            });
        }

        $capstones = $query->orderByDesc('bookmark_count')
            ->paginate($request->get('per_page', 12));

        return $this->successResponse($capstones, 'Bookmarked capstones retrieved.');
    }

    /**
     * List current user's bookmarked capstones.
     */
    public function userBookmarks(Request $request): JsonResponse
    {
        $user = $request->user();
        $query = Capstone::with(['keywords', 'uploader:id,name', 'approver:id,name'])
            ->whereHas('bookmarks', function ($q) use ($user) {
                $q->where('user_id', $user->id);
            })
            ->withCount('bookmarks');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%");
            });
        }

        $capstones = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 12));

        return $this->successResponse($capstones, 'User bookmarked capstones retrieved.');
    }

    /**
     * Permanently delete a capstone.
     */
    public function destroy(Request $request, Capstone $capstone): JsonResponse
    {
        // Delete PDF file
        if ($capstone->pdf_path && Storage::disk('local')->exists($capstone->pdf_path)) {
            Storage::disk('local')->delete($capstone->pdf_path);
        }

        // Delete resource files
        foreach ($capstone->resources as $resource) {
            if ($resource->file_path && Storage::disk('local')->exists($resource->file_path)) {
                Storage::disk('local')->delete($resource->file_path);
            }
        }

        AuditLog::log(
            'delete_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['title' => $capstone->title]
        );

        // Create notifications for all admins about capstone deletion
        $admins = User::whereHas('role', function ($query) {
            $query->where('name', 'admin');
        })->get();

        foreach ($admins as $admin) {
            Notification::create([
                'admin_id'            => $admin->id,
                'type'                => 'capstone_deleted',
                'title'               => 'Capstone Deleted',
                'message'             => "Capstone '{$capstone->title}' deleted by {$request->user()->name}",
                'related_user_id'     => $request->user()->id,
                'related_capstone_id' => $capstone->id,
                'is_read'             => false,
            ]);
        }

        $capstone->keywords()->detach();
        $capstone->delete();

        return $this->successResponse(null, 'Capstone permanently deleted.');
    }

    /**
     * Record a view for a capstone.
     * Authenticated users: strictly one view per user (enforced by unique key).
     * Guests: one view per IP per 30 min.
     */
    public function recordView(Request $request, Capstone $capstone): JsonResponse
    {
        $userId = $request->user()?->id;
        $ip     = $request->ip();

        if ($userId) {
            // firstOrCreate respects the unique(user_id, capstone_id) constraint
            [$view, $created] = [
                \App\Models\CapstoneView::firstOrCreate(
                    ['user_id' => $userId, 'capstone_id' => $capstone->id],
                    ['ip_address' => $ip]
                ),
                false,
            ];
            $created = $view->wasRecentlyCreated;
        } else {
            // Guest: prevent repeat views within 30 min by IP
            $created = !$capstone->views()
                ->whereNull('user_id')
                ->where('ip_address', $ip)
                ->where('created_at', '>', now()->subMinutes(30))
                ->exists();

            if ($created) {
                $capstone->views()->create(['ip_address' => $ip]);
            }
        }

        if ($created) {
            $capstone->increment('view_count');
        }

        return $this->successResponse(['view_count' => $capstone->fresh()->view_count], 'View recorded.');
    }

    /**
     * Issue a short-lived signed token for PDF access.
     * Bound to the authenticated user + capstone.
     */
    public function getPdfToken(Request $request, Capstone $capstone): JsonResponse
    {
        $user = $request->user();

        // Non-admins and non-faculty can only access published capstones
        if (!$user->hasRole('admin') && !$user->hasRole('faculty')) {
            if (!$capstone->is_published) {
                return $this->errorResponse('Capstone not available.', 403);
            }
        }

        $encryptor = new PdfEncryptorService();
        $token = $encryptor->generateToken($capstone->id, $user->id, 30); // 30-min TTL

        return $this->successResponse(['token' => $token, 'expires_in' => 1800], 'PDF token issued.');
    }

    /**
     * Download a capstone PDF (authenticated + authorization checks).
     */
    public function download(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        $user = $request->user();

        // Non-admins can only download published capstones
        if (!$user->hasRole('admin') && !$capstone->is_published) {
            return $this->errorResponse('You are not authorized to download this capstone.', 403);
        }

        if (!$capstone->pdf_path || !Storage::disk('local')->exists($capstone->pdf_path)) {
            return $this->errorResponse('PDF file not found.', 404);
        }

        // Decrypt in memory
        $encryptor = new PdfEncryptorService();
        $rawBytes  = $encryptor->decryptFromDisk($capstone->pdf_path);

        if ($rawBytes === null) {
            return $this->errorResponse('PDF could not be decrypted.', 500);
        }

        // Record download
        $capstone->downloads()->create([
            'user_id'    => $user->id,
            'ip_address' => $request->ip(),
        ]);
        $capstone->increment('download_count');

        AuditLog::log(
            'download_capstone',
            $user->id,
            Capstone::class,
            $capstone->id,
            null,
            ['title' => $capstone->title]
        );

        $filename = $capstone->pdf_original_name ?? $capstone->title . '.pdf';
        $size     = strlen($rawBytes);

        return response()->stream(
            function () use ($rawBytes) { echo $rawBytes; },
            200,
            [
                'Content-Type'              => 'application/pdf',
                'Content-Disposition'       => 'attachment; filename="' . addslashes($filename) . '"',
                'Content-Length'            => $size,
                'Cache-Control'             => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                    => 'no-cache',
                'X-Content-Type-Options'    => 'nosniff',
            ]
        );
    }

    /**
     * Serve PDF for viewing (in-memory decryption, no file written to disk).
     */
    public function servePdf(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        $user = $request->user();

        // Non-admins can only view published capstones
        if (!$user->hasRole('admin') && !$capstone->is_published) {
            return $this->errorResponse('Capstone not available.', 403);
        }

        if (!$capstone->pdf_path || !Storage::disk('local')->exists($capstone->pdf_path)) {
            return $this->errorResponse('PDF file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $rawBytes  = $encryptor->decryptFromDisk($capstone->pdf_path);

        if ($rawBytes === null) {
            return $this->errorResponse('PDF could not be decrypted.', 500);
        }

        $size = strlen($rawBytes);

        return response()->stream(
            function () use ($rawBytes) { echo $rawBytes; },
            200,
            [
                'Content-Type'              => 'application/pdf',
                'Content-Disposition'       => 'inline',
                'Content-Length'            => $size,
                'Cache-Control'             => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                    => 'no-cache',
                'X-Content-Type-Options'    => 'nosniff',
            ]
        );
    }

    /**
     * Toggle bookmark.
     */
    public function toggleBookmark(Request $request, Capstone $capstone): JsonResponse
    {
        $user = $request->user();
        $existing = $capstone->bookmarks()->where('user_id', $user->id)->first();

        if ($existing instanceof Bookmark) {
            $existing->delete();
            $capstone->decrement('bookmark_count');
            return $this->successResponse(['bookmarked' => false, 'bookmark_count' => $capstone->fresh()->bookmark_count], 'Bookmark removed.');
        }

        $capstone->bookmarks()->create(['user_id' => $user->id]);
        $capstone->increment('bookmark_count');
        return $this->successResponse(['bookmarked' => true, 'bookmark_count' => $capstone->fresh()->bookmark_count], 'Bookmark added.');
    }

    /**
     * Update capstone details.
     */
    public function update(Request $request, Capstone $capstone): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'title'    => 'sometimes|string|max:500',
            'year'     => 'nullable|integer|min:2000|max:2099',
            'author'   => 'sometimes|string|max:500',
            'program'  => 'nullable|string|in:BSIT,BSCpE',
            'abstract' => 'nullable|string',
            'title'               => 'sometimes|string|max:500',
            'year'                => 'nullable|integer|min:2000|max:2099',
            'author'              => 'sometimes|string|max:500',
            'program'             => 'nullable|string|in:BSIT,BSCpE',
            'category'            => 'nullable|string|max:100',
            'abstract'            => 'nullable|string',
            'keywords'            => 'nullable|array',
            'keywords.*'          => 'string|max:100',
            'publication_status'  => 'nullable|in:published,unpublished,in_progress',
            'copyright_status'    => 'nullable|in:copyrighted,pending,unprotected',
            'imrad_path'          => 'nullable|string',
            'imrad_original_name' => 'nullable|string',
            'adviser_id'          => 'nullable|exists:users,id',
            'references'          => 'nullable|array',
            'references.*'        => 'integer|exists:capstones,id',
            'resources'           => 'nullable|array',
            'resources.*.name'             => 'required|string|max:255',
            'resources.*.file_path'        => 'required|string',
            'resources.*.file_original_name' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $oldValues = $capstone->only(['title', 'year', 'author', 'program', 'category', 'abstract', 'publication_status', 'copyright_status', 'adviser_id']);

        $updateData = $request->only([
            'title', 'year', 'author', 'program', 'category', 'abstract',
            'publication_status', 'copyright_status', 'imrad_path', 'imrad_original_name', 'adviser_id',
        ]);

        if ($request->has('publication_status')) {
            $updateData['is_published'] = $request->publication_status === 'published';
        }

        $capstone->update($updateData);

        $newValues = $capstone->only(['title', 'year', 'author', 'program', 'category', 'abstract', 'publication_status', 'copyright_status', 'adviser_id']);

        AuditLog::log(
            'update_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            $oldValues,
            $newValues
        );

        if ($request->has('keywords')) {
            $keywordIds = [];
            foreach ($request->keywords as $name) {
                $keyword = Keyword::firstOrCreate(['name' => strtolower(trim($name))]);
                $keywordIds[] = $keyword->id;
            }
            $capstone->keywords()->sync($keywordIds);
        }

        if ($request->has('references')) {
            $capstone->references()->sync($request->references);
        }

        if ($request->has('resources')) {
            $capstone->resources()->delete();
            foreach ($request->resources as $res) {
                $capstone->resources()->create([
                    'name'               => $res['name'],
                    'file_path'          => $res['file_path'],
                    'file_original_name' => $res['file_original_name'] ?? null,
                ]);
            }
        }

        // Create notifications for all admins about capstone edit
        $admins = User::whereHas('role', function ($query) {
            $query->where('name', 'admin');
        })->get();

        foreach ($admins as $admin) {
            Notification::create([
                'admin_id'            => $admin->id,
                'type'                => 'capstone_edited',
                'title'               => 'Capstone Edited',
                'message'             => "Capstone '{$capstone->title}' edited by {$request->user()->name}",
                'related_user_id'     => $request->user()->id,
                'related_capstone_id' => $capstone->id,
                'is_read'             => false,
            ]);
        }

        $capstone->load('keywords', 'references', 'resources', 'adviser');
        return $this->successResponse($capstone, 'Capstone updated.');
    }
}
