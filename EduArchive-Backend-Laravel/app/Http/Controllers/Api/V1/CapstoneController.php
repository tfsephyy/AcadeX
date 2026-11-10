<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Jobs\ExtractPdfTextJob;
use App\Jobs\ExtractUploadMetadataJob;
use App\Jobs\SendAdviserSubmissionEmailJob;
use App\Models\AuditLog;
use App\Models\Bookmark;
use App\Models\Capstone;
use App\Models\CapstoneResource;
use App\Models\CitationEvent;
use App\Models\DocumentUpload;
use App\Models\Keyword;
use App\Models\Notification;
use App\Models\UploadTransfer;
use App\Models\User;
use App\Services\CitationService;
use App\Services\KeywordInput;
use App\Services\NlpSearchService;
use App\Services\PdfEncryptorService;
use App\Services\PdfExtractorService;
use App\Services\UploadLimits;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\DB;
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
        $user = $request->user();

        // Faculty and students only see their own uploaded capstones
        if ($user && ($user->hasRole('faculty') || $user->hasRole('student'))) {
            $query->where('uploaded_by', $user->id);
        }

        // Exclude archived capstones by default
        $query->where('is_archived', false);

        // Hide pending capstones from library views:
        // - Admin sees the library (all approved/rejected non-archived), pending ones go to the Approval page only
        // - Faculty sees their own uploads — faculty uploads are auto-approved, but exclude any pending for safety
        // - Students see their own uploads INCLUDING pending (so they can track submission status)
        if ($user && !$user->hasRole('student')) {
            $query->where('approval_status', '!=', 'pending');
        }

        // Filter by status (if provided, otherwise show all)
        if ($request->has('status') && $request->status) {
            $query->where('status', $request->status);
        }

        // NLP-enhanced search: synonym/abbreviation expansion + FULLTEXT ranking
        if ($request->has('search') && $request->search) {
            $this->applyNlpSearch($query, $request->search, ['title', 'author', 'abstract', 'category']);
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
        $adviserParam = $request->input('adviser_id') ?? $request->input('adviser_name') ?? $request->input('adviser');
        if ($adviserParam !== null && $adviserParam !== '') {
            app(\App\Services\AdviserMatching::class)->applyFilter($query, $adviserParam);
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
        $assignedOnly = $request->boolean('assigned')
            && $request->user()
            && $request->user()->hasRole('faculty');

        $query = Capstone::with(['keywords', 'uploader:id,name', 'approver:id,name', 'adviser:id,name'])
            ->where('is_archived', false);

        if ($assignedOnly) {
            // Adviser-assigned view includes pending submissions so the adviser
            // can find and review them. Access is still enforced by the model's
            // request scope and this explicit adviser filter.
            $query->where('adviser_id', $request->user()->id);
        } else {
            $query->where('approval_status', 'approved');
        }

        // NLP-enhanced search: synonym/abbreviation expansion + FULLTEXT + keyword table
        if ($request->has('search') && $request->search) {
            $this->applyNlpSearch($query, $request->search, ['title', 'author', 'abstract', 'category'], includeKeywords: true);
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
        $adviserParam = $request->input('adviser_id') ?? $request->input('adviser_name') ?? $request->input('adviser');
        if ($adviserParam !== null && $adviserParam !== '') {
            app(\App\Services\AdviserMatching::class)->applyFilter($query, $adviserParam);
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
        $base = Capstone::where('is_archived', false)
                        ->where('approval_status', 'approved');

        $years = (clone $base)->whereNotNull('year')->distinct()->orderByDesc('year')->pluck('year');
        $programs = (clone $base)->whereNotNull('program')->where('program', '!=', '')->distinct()->orderBy('program')->pluck('program');
        $categories = (clone $base)->whereNotNull('category')->where('category', '!=', '')->selectRaw('category as name, COUNT(*) as count')->groupBy('category')->orderBy('category')->get();

        $advisers = app(\App\Services\AdviserMatching::class)->extractOptions($base);

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
            ->selectRaw('category as name, COUNT(*) as count')
            ->groupBy('category')
            ->orderBy('category')
            ->get();

        $advisers = app(\App\Services\AdviserMatching::class)->extractOptions($baseQuery);

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
        $this->authorize('view', $capstone);
        $capstone->load(['keywords', 'uploader:id,name', 'approver:id,name', 'adviser:id,name', 'resources', 'referencedCapstones:id,title,author,year,program']);

        $data = $capstone->toArray();
        $data['is_bookmarked'] = $request->user()
            ? Bookmark::where('user_id', $request->user()->id)
                ->where('capstone_id', $capstone->id)
                ->exists()
            : false;
        $data['reference_count'] = $capstone->referenceTotal();
        $data['citation_generations'] = $data['reference_count'];

        return $this->successResponse($data, 'Capstone retrieved.');
    }

    /** Formatting is read-only. Only a successful clipboard copy records an event. */
    public function citation(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('interact', $capstone);
        $validator = Validator::make($request->all(), [
            'format' => 'required|in:apa,mla',
            'action' => 'nullable|in:generate,copy,download',
            'event_key' => 'required_if:action,copy|nullable|uuid',
        ]);
        if ($validator->fails()) return $this->validationFailure($validator);
        $format = $validator->validated()['format'];
        if ($request->input('action') === 'copy') {
            $event = CitationEvent::firstOrCreate([
                'user_id' => $request->user()->id,
                'event_key' => $request->input('event_key'),
            ], [
                'capstone_id' => $capstone->id, 'format' => $format, 'action' => 'copy',
                'ip_hash' => hash_hmac('sha256', (string) $request->ip(), (string) config('app.key')),
            ]);
            if ((int) $event->capstone_id !== (int) $capstone->id || $event->format !== $format) {
                return $this->errorResponse('This copy event belongs to another citation.', 409);
            }
        }
        $service = app(CitationService::class);
        $total = $capstone->referenceTotal();
        return $this->successResponse([
            'format' => $format, 'label' => $service->label($format),
            'citation' => $service->format($capstone, $format),
            'reference_count' => $total, 'citation_count' => $total, 'citation_generations' => $total,
        ], 'Citation ready.');
    }

    /**
     * Upload and extract PDF data (encrypted at rest).
     *
     * Accepts an optional  skip_extraction=1  flag.
     * When set, the file is stored immediately and empty extracted fields are
     * returned — the user fills them manually in Step 2 (ReviewExtractedDataPage).
     */
    public function upload(Request $request): JsonResponse
    {
        $limits = app(UploadLimits::class);
        if (!$limits->hasSafeUploadMemory()) {
            return $this->errorResponse('Uploads are temporarily unavailable because the server memory limit is below the safe application baseline.', 503);
        }

        $validator = Validator::make($request->all(), [
            // No hard-coded application size limit: the server ceilings in
            // PHP/Apache are reported below when they are the limiting layer.
            'pdf' => 'required|file|mimes:pdf',
        ], $this->uploadValidationMessages('pdf'));

        $this->addUploadLimitError($validator, 'pdf');

        if ($validator->fails()) {
            return $this->validationFailure($validator);
        }

        $file           = $request->file('pdf');
        if ($file && $limits->effectiveMaxBytes() > 0 && $file->getSize() > $limits->effectiveMaxBytes()) {
            return $this->errorResponse('The upload exceeds the maximum allowed size of '.$limits->humanBytes($limits->effectiveMaxBytes()).'.', 413);
        }

        $skipExtraction = $request->boolean('skip_extraction', false);
        $this->prepareUploadEnvironment($file);

        // Persist securely first. The response can return as soon as the bytes
        // are encrypted and owned; extraction/OCR runs behind a queued job.
        $encryptor = new PdfEncryptorService();
        $path = $encryptor->encryptAndStore('capstones', $file);
        $status = $skipExtraction
            ? \App\Models\DocumentUpload::STATUS_SKIPPED
            : \App\Models\DocumentUpload::STATUS_QUEUED;
        $reference = app(\App\Services\DocumentUploads::class)->stage(
            $request->user(), 'pdf', $path, $status, $file->getClientOriginalName()
        );
        $uploadId = substr($reference, 7);

        if (!$skipExtraction) {
            \App\Jobs\ExtractUploadMetadataJob::dispatch($uploadId)->afterCommit();
        }

        $upload = \App\Models\DocumentUpload::find($uploadId);
        $payload = $this->uploadPayload($upload, $reference);

        return $this->successResponse($payload + [
            'pdf_original_name' => $file->getClientOriginalName(),
        ], $skipExtraction
            ? 'PDF uploaded. Review or enter the document details.'
            : 'PDF uploaded. Document processing has started.');
    }

    /**
     * Poll a staged upload's processing state. Only the owner can read it.
     */
    public function uploadStatus(Request $request, string $upload): JsonResponse
    {
        $record = \App\Models\DocumentUpload::whereKey($upload)
            ->where('user_id', $request->user()->id)
            ->first();
        if (!$record) return $this->errorResponse('Upload reference not found.', 404);

        return $this->successResponse($this->uploadPayload($record, $record->reference()));
    }

    /**
     * Retry a failed extraction without re-uploading the PDF.
     */
    public function retryUpload(Request $request, string $upload): JsonResponse
    {
        $record = \App\Models\DocumentUpload::whereKey($upload)
            ->where('user_id', $request->user()->id)
            ->first();
        if (!$record) return $this->errorResponse('Upload reference not found.', 404);
        if ($record->purpose !== 'pdf') return $this->errorResponse('Only PDF uploads can be reprocessed.', 422);
        if ($record->capstone_id !== null) return $this->errorResponse('This upload has already been submitted.', 409);
        if (in_array($record->processing_status, [
            \App\Models\DocumentUpload::STATUS_QUEUED,
            \App\Models\DocumentUpload::STATUS_PROCESSING,
        ], true)) {
            return $this->errorResponse('This upload is already being processed.', 409);
        }
        if (!Storage::disk('local')->exists($record->path)) {
            return $this->errorResponse('The stored file is no longer available. Upload the PDF again.', 410);
        }

        $claimed = \App\Models\DocumentUpload::whereKey($record->id)
            ->whereIn('processing_status', [\App\Models\DocumentUpload::STATUS_FAILED, \App\Models\DocumentUpload::STATUS_COMPLETED, \App\Models\DocumentUpload::STATUS_SKIPPED])
            ->whereNull('capstone_id')->update([
            'processing_status' => \App\Models\DocumentUpload::STATUS_QUEUED,
            'processing_error' => null,
            'processing_started_at' => null,
            'processing_completed_at' => null,
            'extraction_result' => null,
        ]);
        if (!$claimed) return $this->errorResponse('This upload is already being processed or submitted.', 409);
        \App\Jobs\ExtractUploadMetadataJob::dispatch($record->id);

        return $this->successResponse(
            $this->uploadPayload($record->refresh(), $record->reference()),
            'Document processing was queued again.'
        );
    }

    /**
     * Discard an unsubmitted staged upload, freeing its quota reservation.
     */
    public function discardUpload(Request $request, string $upload): JsonResponse
    {
        $record = DocumentUpload::whereKey($upload)
            ->where('user_id', $request->user()->id)
            ->first();

        if (!$record) return $this->errorResponse('Upload reference not found.', 404);
        if ($record->capstone_id !== null) return $this->errorResponse('This upload has already been submitted.', 409);
        if ($record->processing_status === DocumentUpload::STATUS_PROCESSING
            && $record->processing_started_at
            && $record->processing_started_at->isAfter(now()->subMinutes(15))) {
            return $this->errorResponse('This upload is currently being processed.', 409);
        }

        $deletedPath = null;

        DB::transaction(function () use ($request, $upload, &$deletedPath) {
            // Lock order: User first, then DocumentUpload / UploadTransfer.
            User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
            $target = DocumentUpload::whereKey($upload)
                ->where('user_id', $request->user()->id)
                ->lockForUpdate()
                ->first();

            if (!$target) abort(404, 'Upload reference not found.');
            if ($target->capstone_id !== null) abort(409, 'This upload has already been submitted.');
            if ($target->processing_status === DocumentUpload::STATUS_PROCESSING
                && $target->processing_started_at
                && $target->processing_started_at->isAfter(now()->subMinutes(15))) {
                abort(409, 'This upload is currently being processed.');
            }
            if (app(\App\Services\DocumentUploads::class)->isPathReferenced($target->path)) {
                abort(409, 'This upload file is referenced by a capstone or resource and cannot be discarded.');
            }

            // Find and collect chunk files from any related transfers before cascading delete.
            $transfers = UploadTransfer::where('upload_id', $target->id)->lockForUpdate()->get();
            $deletedChunkFiles = [];
            foreach ($transfers as $transfer) {
                if (!empty($transfer->chunks)) {
                    $deletedChunkFiles = array_merge($deletedChunkFiles, array_column($transfer->chunks, 'path'));
                }
            }

            // Remove chunk files before deleting the upload and cascading transfer rows.
            $disk = Storage::disk('local');
            $existingChunkFiles = array_values(array_filter($deletedChunkFiles, fn ($path) => $disk->exists($path)));
            if ($existingChunkFiles && !$disk->delete($existingChunkFiles)) {
                throw new \RuntimeException('Unable to remove staged upload transfer chunks.');
            }

            if (!$target->delete()) {
                throw new \RuntimeException('Unable to remove staged upload record.');
            }
            $deletedPath = $target->path;
        });

        // Delete files after the transaction commits
        $disk = Storage::disk('local');
        if ($deletedPath && $disk->exists($deletedPath) && !$disk->delete($deletedPath)) {
            \Illuminate\Support\Facades\Log::warning("CapstoneController: Could not remove discarded upload file [{$upload}].", [
                'upload_id' => $upload,
            ]);
        }

        return $this->successResponse(null, 'Upload discarded successfully.');
    }

    /** Stable shape used by the upload response and the polling endpoint. */
    private function uploadPayload(?\App\Models\DocumentUpload $record, string $reference): array
    {
        if (!$record) {
            return [
                'upload_id' => null, 'pdf_path' => $reference,
                'processing_status' => 'failed', 'extraction_status' => 'failed',
                'extracted' => PdfExtractorService::emptyMetadata(),
                'extraction_scope' => 'unavailable', 'processing_error' => 'Upload record unavailable.',
                'retryable' => false, 'notes' => [],
            ];
        }

        $metadata = $record->extractedMetadata();
        $hasMetadata = (bool) array_filter(array_diff_key($metadata, ['program' => true]));
        $processing = $record->processing_status;
        $extractionStatus = match (true) {
            $processing === \App\Models\DocumentUpload::STATUS_SKIPPED => 'skipped',
            $processing === \App\Models\DocumentUpload::STATUS_FAILED => 'failed',
            in_array($processing, [
                \App\Models\DocumentUpload::STATUS_QUEUED,
                \App\Models\DocumentUpload::STATUS_PROCESSING,
            ], true) => $processing,
            $hasMetadata => 'complete',
            default => 'unavailable',
        };

        return [
            'upload_id' => $record->id,
            'pdf_path' => $reference,
            'pdf_original_name' => $record->original_name,
            'capstone_id' => $record->capstone_id,
            'processing_status' => $processing,
            'extraction_status' => $extractionStatus,
            'extracted' => $metadata,
            'extraction_scope' => $record->extractionScope(),
            'processing_error' => $record->processing_error,
            'retryable' => $record->capstone_id === null
                && in_array($processing, [
                    \App\Models\DocumentUpload::STATUS_FAILED,
                    \App\Models\DocumentUpload::STATUS_COMPLETED,
                ], true) && !$hasMetadata,
            'notes' => $record->extraction_result['notes'] ?? [],
            'expires_at' => $record->expires_at?->toIso8601String(),
        ];
    }


    /**
     * Upload a resource file (encrypted at rest).
     */
    public function uploadResource(Request $request): JsonResponse
    {
        $limits = app(UploadLimits::class);
        if (!$limits->hasSafeUploadMemory()) {
            return $this->errorResponse('Uploads are temporarily unavailable because the server memory limit is below the safe application baseline.', 503);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file',
        ], $this->uploadValidationMessages('file'));

        $this->addUploadLimitError($validator, 'file');

        if ($validator->fails()) {
            return $this->validationFailure($validator);
        }

        $file      = $request->file('file');
        if ($file && $limits->effectiveMaxBytes() > 0 && $file->getSize() > $limits->effectiveMaxBytes()) {
            return $this->errorResponse('The upload exceeds the maximum allowed size of '.$limits->humanBytes($limits->effectiveMaxBytes()).'.', 413);
        }

        $this->prepareUploadEnvironment($file);
        $encryptor = new PdfEncryptorService();
        $path      = $encryptor->encryptAndStore('capstone_resources', $file);
        $reference = app(\App\Services\DocumentUploads::class)->stage($request->user(), 'resource', $path);

        return $this->successResponse([
            'file_path'          => $reference,
            'file_original_name' => $file->getClientOriginalName(),
        ], 'Resource file uploaded.');
    }

    /**
     * Upload an IMRAD file (encrypted at rest).
     */
    public function uploadImrad(Request $request): JsonResponse
    {
        $limits = app(UploadLimits::class);
        if (!$limits->hasSafeUploadMemory()) {
            return $this->errorResponse('Uploads are temporarily unavailable because the server memory limit is below the safe application baseline.', 503);
        }

        $validator = Validator::make($request->all(), [
            'file' => 'required|file|mimes:pdf',
        ], $this->uploadValidationMessages('file'));

        $this->addUploadLimitError($validator, 'file');

        if ($validator->fails()) {
            return $this->validationFailure($validator);
        }

        $file      = $request->file('file');
        if ($file && $limits->effectiveMaxBytes() > 0 && $file->getSize() > $limits->effectiveMaxBytes()) {
            return $this->errorResponse('The upload exceeds the maximum allowed size of '.$limits->humanBytes($limits->effectiveMaxBytes()).'.', 413);
        }

        $this->prepareUploadEnvironment($file);
        $encryptor = new PdfEncryptorService();
        $path      = $encryptor->encryptAndStore('capstone_imrad', $file);
        $reference = app(\App\Services\DocumentUploads::class)->stage($request->user(), 'imrad', $path);

        return $this->successResponse([
            'file_path'          => $reference,
            'file_original_name' => $file->getClientOriginalName(),
        ], 'IMRAD file uploaded.');
    }

    /**
     * Check whether a capstone title already exists.
     * Returns { exists: true/false } so the frontend can block
     * step progression before files are uploaded.
     */
    public function checkTitle(Request $request): JsonResponse
    {
        $request->validate(['title' => 'required|string|max:255']);

        $exists = Capstone::whereRaw('LOWER(title) = ?', [mb_strtolower(trim($request->title))])->exists();

        return $this->successResponse(['exists' => $exists], $exists ? 'Title already exists.' : 'Title is available.');
    }

    /**
     * Store capstone with extracted/edited data and additional info.
     */
    public function store(Request $request): JsonResponse
    {
        return DB::transaction(function () use ($request) {
            $reference = $request->input('pdf_path');
            if (is_string($reference) && str_starts_with($reference, 'upload:')) {
                // Serialize submission on the durable upload reference. A replay
                // returns the original record without sending more jobs or notices.
                User::whereKey($request->user()->id)->lockForUpdate()->firstOrFail();
                $upload = \App\Models\DocumentUpload::whereKey(substr($reference, 7))
                    ->where('user_id', $request->user()->id)->where('purpose', 'pdf')->lockForUpdate()->first();
                if ($upload?->capstone_id) {
                    $existing = Capstone::whereKey($upload->capstone_id)->firstOrFail();
                    if ($existing->title !== $request->input('title') || $existing->author !== $request->input('author')) {
                        throw \Illuminate\Validation\ValidationException::withMessages(['documents' => 'This upload has already been submitted.']);
                    }
                    return $this->successResponse($existing->load(['keywords', 'resources', 'referencedCapstones', 'adviser:id,name']), 'Capstone already saved.');
                }
            }
            return $this->storeNew($request);
        });
    }

    public function uploadAdvisers(): JsonResponse
    {
        return $this->successResponse(app(\App\Services\AdviserMatching::class)->eligible()
            ->orderBy('name')->orderBy('id')->get(['id', 'name', 'username', 'faculty_program']), 'Available Faculty advisers.');
    }

    private function storeNew(Request $request): JsonResponse
    {
        $request->merge(['program' => 'BSIT']);
        // Accept either a comma-separated string or an array from the client.
        if ($request->exists('keywords')) {
            $request->merge(['keywords' => KeywordInput::normalize($request->input('keywords'))]);
        }

        $validator = Validator::make($request->all(), [
            'title'              => 'required|string|max:255|unique:capstones,title',
            'year'               => 'nullable|integer|min:2000|max:2099',
            'author'             => 'required|string|max:255',
            'author_details'     => 'nullable|array',
            'author_details.*.name'    => 'required|string|max:255',
            'author_details.*.email'   => 'nullable|string|max:255',
            'author_details.*.contact' => 'nullable|string|max:50',
            'program'            => 'nullable|string|in:BSIT,BSCpE',
            'category'           => 'nullable|string|max:100',
            'abstract'           => 'nullable|string',
            'pdf_path'           => 'required|string',
            'pdf_original_name'  => 'nullable|string',
            'keywords'           => 'nullable|array|max:'.KeywordInput::MAX_KEYWORDS,
            'keywords.*'         => 'string|max:100',
            'publication_status' => 'required|in:published,unpublished,in_progress',
            'copyright_status'   => 'required|in:copyrighted,pending,unprotected',
            'imrad_path'         => 'nullable|string',
            'imrad_original_name' => 'nullable|string',
            'adviser_id'         => 'nullable|exists:users,id',
            'adviser_name'       => 'nullable|string|max:255',
            'references'         => 'nullable|array',
            'references.*'       => 'integer|exists:capstones,id',
            'resources'          => 'nullable|array',
            'resources.*.name'             => 'required|string|max:255',
            'resources.*.file_path'        => 'required|string',
            'resources.*.file_original_name' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationFailure($validator);
        }

        // Determine approval status based on user role:
        // - Admin/Faculty: Auto-approved (approval_status='approved')
        //   publication_status is set from request (admin/faculty control it)
        // - Student: Requires approval (approval_status='pending')
        //   publication_status records the student's choice behind the approval gate
        // NOTE: approval_status and publication_status are SEPARATE concerns:
        //   approval_status = review gate (pending/approved/rejected)
        //   publication_status = external publication flag; it controls the
        //   visitor full-document tier, not platform-library visibility
        $user = $request->user();
        $isStudent = $user->hasRole('student');

        $status = $isStudent ? 'pending' : 'approved';
        $approvalStatus = $isStudent ? 'pending' : 'approved';
        // Explicit publication choices never bypass the approval gate.
        $publicationStatus = $request->input('publication_status');

        $capstone = DB::transaction(function () use ($request, $user, $status, $approvalStatus, $publicationStatus) {
        $uploads = app(\App\Services\DocumentUploads::class);
        $resources = $request->input('resources', []);
        foreach ($resources as &$resource) {
            $resource['file_path'] = $uploads->resolve($request->user(), $resource['file_path'], 'resource', null);
        }
        unset($resource);
        $imradPath = $request->imrad_path ? $uploads->resolve($request->user(), $request->imrad_path, 'imrad', null) : null;
        foreach ($request->input('references', []) as $id) {
            if (!Capstone::find($id)) abort(403, 'Referenced capstone unavailable.');
        }
        $adviser = app(\App\Services\AdviserMatching::class)->resolve($request->input('adviser_name'), $request->input('adviser_id'));
        $pdfPath = $uploads->resolve($user, $request->pdf_path, 'pdf');
        $paths = array_merge([$pdfPath, $imradPath], array_column($resources, 'file_path'));
        if (count(array_filter($paths)) !== count(array_unique(array_filter($paths)))) {
            throw \Illuminate\Validation\ValidationException::withMessages(['documents' => 'Duplicate upload references.']);
        }
        $capstone = Capstone::create([
            'title'              => $request->title,
            'year'               => $request->year,
            'author'             => $request->author,
            'author_details'     => $request->input('author_details'),
            'program'            => 'BSIT',
            'category'           => $request->category,
            'abstract'           => $request->abstract,
            'pdf_path'           => $pdfPath,
            'pdf_original_name'  => $request->pdf_original_name,
            'uploaded_by'        => $user->id,
            'status'             => $status,
            'approval_status'    => $approvalStatus,
            'publication_status' => $publicationStatus,
            'copyright_status'   => $request->copyright_status,
            'imrad_path'         => $imradPath,
            'imrad_original_name' => $request->imrad_original_name,
            'adviser_id'         => $adviser['adviser_id'],
            'adviser_name'       => $adviser['adviser_name'],
        ]);

        // Normalize keyword input on the server as well as in the UI: split
        // comma-separated values, trim, ignore empties and dedupe case-insensitively.
        $keywordNames = $this->normalizeKeywords($request->input('keywords', []));
        if (!empty($keywordNames)) {
            $keywordIds = [];
            foreach ($keywordNames as $name) {
                $keyword = Keyword::withoutGlobalScope('request_access')->firstOrCreate(['name' => $name]);
                $keywordIds[] = $keyword->id;
            }
            $capstone->keywords()->sync($keywordIds);
        }

        // Attach referenced capstones
        if ($request->has('references') && is_array($request->references)) {
            $refs = array_filter(array_unique(array_map('intval', $request->references)), fn($id) => $id !== (int) $capstone->id);
            $capstone->referencedCapstones()->sync($refs);
        }

        // Save resource attachments
        if ($request->has('resources') && is_array($request->resources)) {
            foreach ($resources as $resource) {
                CapstoneResource::create([
                    'capstone_id'        => $capstone->id,
                    'name'               => $resource['name'],
                    'file_path'          => $resource['file_path'],
                    'file_original_name' => $resource['file_original_name'] ?? null,
                ]);
            }
        }

        $uploads->claim($capstone, $paths);
        return $capstone;
        });

        // Whole-document text extraction is intentionally queued. The upload
        // response never waits for OCR/full-text parsing.
        ExtractPdfTextJob::dispatch($capstone->id)->afterCommit();

        AuditLog::log('upload_capstone', $user->id, Capstone::class, $capstone->id);
        $this->notifyCapstoneSubmitted($capstone, $user, $isStudent);

        $capstone->load(['keywords', 'resources', 'referencedCapstones', 'adviser:id,name']);
        return $this->successResponse($capstone, 'Capstone saved successfully.', 201);
    }

    /**
     * Create deduplicated in-app notifications for admins and the adviser.
     * Adviser email is dispatched through a separate queued job.
     */
    private function notifyCapstoneSubmitted(Capstone $capstone, User $uploader, bool $isStudent): void
    {
        $recipients = User::whereHas('role', fn ($query) => $query->where('name', 'admin'))
            ->get()
            ->keyBy('id');

        if ($capstone->adviser_id) {
            $adviser = User::find($capstone->adviser_id);
            if ($adviser) $recipients->put($adviser->id, $adviser);
        }

        $submittedAt = optional($capstone->created_at)->format('F j, Y') ?: now()->format('F j, Y');

        foreach ($recipients as $recipient) {
            if ((int) $recipient->id === (int) $uploader->id) continue;

            $isAdviser = $capstone->adviser_id && (int) $recipient->id === (int) $capstone->adviser_id;
            $notification = Notification::firstOrCreate(
                ['dedupe_key' => "capstone_submitted:{$capstone->id}:{$recipient->id}"],
                [
                    'admin_id' => $recipient->id,
                    'type' => $isAdviser ? 'capstone_pending_approval' : ($isStudent ? 'capstone_pending_approval' : 'capstone_uploaded'),
                    'title' => $isAdviser ? 'New Capstone Awaiting Your Review' : ($isStudent ? 'New Capstone Awaiting Approval' : 'New Capstone Uploaded'),
                    'message' => $isAdviser
                        ? "{$uploader->name} submitted '{$capstone->title}' on {$submittedAt}; you are listed as adviser."
                        : ($isStudent
                            ? "Student {$uploader->name} uploaded capstone '{$capstone->title}' for approval on {$submittedAt}"
                            : "Capstone '{$capstone->title}' uploaded by {$uploader->name} on {$submittedAt}"),
                    'related_user_id' => $uploader->id,
                    'related_capstone_id' => $capstone->id,
                    'is_read' => false,
                ]
            );

            if ($isAdviser && !$notification->email_sent_at && $recipient->email) {
                SendAdviserSubmissionEmailJob::dispatch($notification->id);
            }
        }
    }

    /** @return string[] */
    private function normalizeKeywords(mixed $raw): array
    {
        return KeywordInput::normalize($raw) ?? [];
    }

    /**
     * Approve a capstone.
     */
    /**
     * Get pending capstones for approval (Admin sees all, Faculty sees only where they are adviser)
     */
    public function getPendingCapstones(Request $request): JsonResponse
    {
        $query = Capstone::with([
            'keywords',
            'uploader:id,name,email,role_id',
            'uploader.role:id,name',
            'uploader.studentProfile:user_id,program,year',
            'adviser:id,name'
        ])->where('approval_status', 'pending');

        // Faculty can only see capstones where they are the adviser
        if ($request->user()->hasRole('faculty')) {
            $query->where('adviser_id', $request->user()->id);
        }
        // Admin sees all pending capstones

        // Search
        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%")
                  ->orWhere('year', 'like', "%{$search}%")
                  ->orWhereHas('uploader', function ($uq) use ($search) {
                      $uq->where('name', 'like', "%{$search}%");
                  });
            });
        }

        // Filter by year
        if ($request->has('year') && $request->year) {
            $query->where('year', $request->year);
        }

        // Filter by program
        if ($request->has('program') && $request->program) {
            $query->whereHas('uploader.studentProfile', function ($q) use ($request) {
                $q->where('program', $request->program);
            });
        }

        // Filter by adviser (admin only)
        if ($request->user()->hasRole('admin')) {
            $adviserParam = $request->input('adviser_id') ?? $request->input('adviser_name') ?? $request->input('adviser');
            if ($adviserParam !== null && $adviserParam !== '') {
                app(\App\Services\AdviserMatching::class)->applyFilter($query, $adviserParam);
            }
        }

        $query->orderByDesc('created_at');
        $capstones = $query->paginate($request->get('per_page', 15));

        // Format response to match frontend expectations
        $capstones->getCollection()->transform(function ($capstone) {
            $uploader = $capstone->uploader;
            $isStudent = $uploader && $uploader->hasRole('student');
            
            return [
                'id' => $capstone->id,
                'title' => $capstone->title,
                'year' => $capstone->year,
                'author' => $capstone->author,
                'abstract' => $capstone->abstract,
                'approval_status' => $capstone->approval_status,
                'created_at' => $capstone->created_at,
                'pdf_available' => $capstone->pdf_available,
                'student' => [
                    'id' => $uploader->id ?? null,
                    'name' => $uploader->name ?? 'Unknown',
                    'email' => $uploader->email ?? null,
                    'program' => $isStudent && $uploader->studentProfile ? $uploader->studentProfile->program : 'N/A',
                    'year' => $isStudent && $uploader->studentProfile ? $uploader->studentProfile->year : 'N/A',
                ],
                'adviser' => [
                    'id' => $capstone->adviser?->id,
                    'name' => $capstone->adviser_name ?: ($capstone->adviser?->name ?? 'Not Assigned'),
                ],
            ];
        });

        return $this->successResponse($capstones, 'Pending capstones retrieved.');
    }

    public function approve(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('review', $capstone);
        if ($capstone->status === 'approved' || $capstone->approval_status === 'approved') {
            return $this->errorResponse('Capstone is already approved.', 400);
        }

        // Faculty can only approve capstones where they are the adviser
        if ($request->user()->hasRole('faculty') && $capstone->adviser_id !== $request->user()->id) {
            return $this->errorResponse('You can only approve capstones where you are the adviser.', 403);
        }

        $oldStatus = $capstone->status;

        // Only update the approval gate — publication_status is a SEPARATE admin decision.
        // Approving a capstone means the submission has been reviewed and accepted,
        // NOT that it is immediately published to the library.
        $capstone->update([
            'status'          => 'approved',
            'approval_status' => 'approved',
            'is_archived'     => false,
            'approved_by'     => $request->user()->id,
            'approved_at'     => now(),
        ]);

        AuditLog::log(
            'approve_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['status' => $oldStatus],
            ['status' => 'approved']
        );

        // Notify the student whose capstone was approved
        if ($capstone->uploaded_by) {
            Notification::create([
                'admin_id'            => $capstone->uploaded_by,
                'type'                => 'capstone_approved',
                'title'               => 'Capstone Approved',
                'message'             => "Your capstone '{$capstone->title}' has been approved by {$request->user()->name}",
                'related_user_id'     => $request->user()->id,
                'related_capstone_id' => $capstone->id,
                'is_read'             => false,
            ]);
        }

        return $this->successResponse($capstone, 'Capstone approved successfully.');
    }

    /**
     * Reject a capstone (move to archive).
     */
    public function reject(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('review', $capstone);
        if ($capstone->status === 'rejected' || $capstone->approval_status === 'rejected') {
            return $this->errorResponse('Capstone is already rejected.', 400);
        }

        // Faculty can only reject capstones where they are the adviser
        if ($request->user()->hasRole('faculty') && $capstone->adviser_id !== $request->user()->id) {
            return $this->errorResponse('You can only reject capstones where you are the adviser.', 403);
        }

        $oldStatus = $capstone->status;
        $rejectionReason = $request->input('rejection_reason');

        // Only update the approval gate — publication_status is a SEPARATE admin decision.
        // Rejected capstones are archived (hidden from all views) but publication_status is untouched.
        $capstone->update([
            'status'           => 'rejected',
            'approval_status'  => 'rejected',
            'rejection_reason' => $rejectionReason,
            'is_archived'      => true,  // Auto-archive rejected capstones
            'approved_by'      => $request->user()->id,
            'approved_at'      => now(),
        ]);

        AuditLog::log(
            'reject_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['status' => $oldStatus],
            ['status' => 'rejected']
        );

        // Notify the student whose capstone was rejected
        if ($capstone->uploaded_by) {
            Notification::create([
                'admin_id'            => $capstone->uploaded_by,
                'type'                => 'capstone_rejected',
                'title'               => 'Capstone Rejected',
                'message'             => "Your capstone '{$capstone->title}' has been rejected" . ($rejectionReason ? ": {$rejectionReason}" : '.'),
                'related_user_id'     => $request->user()->id,
                'related_capstone_id' => $capstone->id,
                'is_read'             => false,
            ]);
        }

        return $this->successResponse($capstone, 'Capstone rejected and archived.');
    }

    /**
     * Archive a capstone (move to archive folder).
     */
    public function archive(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('update', $capstone);
        // Students can only archive their own capstones
        if ($request->user()->hasRole('student') && $capstone->uploaded_by !== $request->user()->id) {
            return $this->errorResponse('You can only archive your own capstones.', 403);
        }

        if ($capstone->is_archived) {
            return $this->errorResponse('Capstone is already archived.', 400);
        }

        $capstone->update([
            'is_archived'        => true,
            'publication_status' => 'unpublished',
        ]);

        AuditLog::log('archive_capstone', $request->user()->id, Capstone::class, $capstone->id);

        return $this->successResponse($capstone, 'Capstone archived.');
    }

    /**
     * List archived capstones.
     */
    public function archived(Request $request): JsonResponse
    {
        $query = Capstone::withoutGlobalScope('request_access')->with(['keywords', 'uploader:id,name'])
            ->archived()
            ->orderByDesc('updated_at');

        // Faculty and student users only see their own archived capstones
        if ($request->user() && ($request->user()->hasRole('faculty') || $request->user()->hasRole('student'))) {
            $query->where('uploaded_by', $request->user()->id);
        }

        // NLP-enhanced search
        if ($request->has('search') && $request->search) {
            $this->applyNlpSearch($query, $request->search, ['title', 'author', 'abstract', 'category']);
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
        $this->authorize('restore', $capstone);
        // Students can only restore their own capstones
        if ($request->user()->hasRole('student') && $capstone->uploaded_by !== $request->user()->id) {
            return $this->errorResponse('You can only restore your own capstones.', 403);
        }

        if (!$capstone->is_archived) {
            return $this->errorResponse('Capstone is not archived.', 400);
        }

        // Restoration must never grant approval. A rejected submission goes back
        // through review as pending; any restored record also leaves the external
        // publication gate closed until an administrator deliberately publishes it.
        $wasRejected = $capstone->status === 'rejected' || $capstone->approval_status === 'rejected';
        $capstone->update([
            'status'             => $wasRejected ? 'pending' : $capstone->status,
            'approval_status'    => $wasRejected ? 'pending' : $capstone->approval_status,
            'is_archived'        => false,
            'publication_status' => 'unpublished',
            'rejection_reason'   => null,
            'approved_by'        => $wasRejected ? null : $capstone->approved_by,
            'approved_at'        => $wasRejected ? null : $capstone->approved_at,
        ]);

        AuditLog::log('unarchive_capstone', $request->user()->id, Capstone::class, $capstone->id);

        return $this->successResponse($capstone, 'Capstone unarchived.');
    }

    /**
     * Publish an approved capstone (set publication_status = 'published').
     * This is SEPARATE from approval — the admin explicitly decides when to publish.
     * Requires: approval_status = 'approved'.
     */
    public function publish(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('update', $capstone);

        if ($capstone->is_archived) {
            return $this->errorResponse('Restore the capstone before publishing it.', 400);
        }

        if ($capstone->approval_status !== 'approved') {
            return $this->errorResponse('Only approved capstones can be published.', 400);
        }

        if ($capstone->publication_status === 'published') {
            return $this->errorResponse('Capstone is already published.', 400);
        }

        $oldStatus = $capstone->publication_status;

        $capstone->update([
            'publication_status' => 'published',
        ]);

        AuditLog::log(
            'publish_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['publication_status' => $oldStatus],
            ['publication_status' => 'published']
        );

        return $this->successResponse($capstone, 'Capstone published successfully.');
    }

    /**
     * Unpublish a capstone (set publication_status = 'unpublished').
     * Does NOT affect approval_status — the capstone remains approved.
     */
    public function unpublish(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('update', $capstone);

        if ($capstone->publication_status !== 'published') {
            return $this->errorResponse('Capstone is not currently published.', 400);
        }

        $oldStatus = $capstone->publication_status;

        // Only change the publication gate — approval_status is SEPARATE and unchanged.
        $capstone->update([
            'publication_status' => 'unpublished',
        ]);

        AuditLog::log(
            'unpublish_capstone',
            $request->user()->id,
            Capstone::class,
            $capstone->id,
            ['publication_status' => $oldStatus],
            ['publication_status' => 'unpublished']
        );

        return $this->successResponse($capstone, 'Capstone unpublished.');
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
            $this->applyNlpSearch($query, $request->search, ['title', 'author', 'abstract', 'category']);
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
            $this->applyNlpSearch($query, $request->search, ['title', 'author', 'abstract', 'category']);
        }

        $capstones = $query->orderByDesc('created_at')
            ->paginate($request->get('per_page', 12));

        if ($user->hasRole('visitor')) {
            $access = app(\App\Services\CapstoneAccess::class);
            $capstones->getCollection()->transform(function ($c) use ($access) {
                $canSeePdf = $access->visitorCanViewDocument($c);
                $c->visitor_can_see_pdf = $canSeePdf;
                $c->visitor_imrad_only  = !$canSeePdf && !empty($c->imrad_path);
                return $c;
            });
        }

        return $this->successResponse($capstones, 'User bookmarked capstones retrieved.');
    }

    /**
     * Permanently delete a capstone.
     */
    public function destroy(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('delete', $capstone);
        // Students can only delete their own capstones
        if ($request->user()->hasRole('student') && $capstone->uploaded_by !== $request->user()->id) {
            return $this->errorResponse('You can only delete your own capstones.', 403);
        }

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
        $this->authorize('interact', $capstone);
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
        $this->authorize('view', $capstone);
        $user = $request->user();

        $encryptor = new PdfEncryptorService();
        $token = $encryptor->generateToken($capstone->id, $user->id, 30); // 30-min TTL

        return $this->successResponse(['token' => $token, 'expires_in' => 1800], 'PDF token issued.');
    }

    /**
     * Download a capstone PDF (authenticated + authorization checks).
     */
    public function download(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        $this->authorize('download', $capstone);
        $user = $request->user();

        // Students are not permitted to download capstone PDFs.
        if ($user->hasRole('student')) {
            return $this->errorResponse('Students are not authorised to download capstone files.', 403);
        }

        if (!$capstone->pdf_path || !Storage::disk('local')->exists($capstone->pdf_path)) {
            return $this->errorResponse('PDF file not found.', 404);
        }

        // Verify authentication before recording or returning any document bytes
        $encryptor = new PdfEncryptorService();
        $document = $encryptor->openVerifiedDocument($capstone->pdf_path);

        if ($document === null) {
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


        return $document->response([
                'Content-Type'              => 'application/pdf',
                'Content-Disposition'       => 'attachment; filename="' . addslashes($filename) . '"',
                'Cache-Control'             => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                    => 'no-cache',
                'X-Content-Type-Options'    => 'nosniff',
            ]);
    }

    /**
     * Serve PDF from an authenticated stream without plaintext disk storage.
     */
    public function servePdf(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\Response
    {
        $this->authorize('view', $capstone);
        $user = $request->user();

        // All authenticated users can view any capstone PDF.
        // (Route is already protected by auth:sanctum middleware.)

        if (!$capstone->pdf_path || !Storage::disk('local')->exists($capstone->pdf_path)) {
            return $this->errorResponse('PDF file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $document = app(\App\Services\PdfPreviewService::class)->openForViewing($capstone->pdf_path);

        if ($document === null) {
            return $this->errorResponse('PDF could not be decrypted.', 500);
        }


        $headers = [
                'Content-Type'              => 'application/pdf',
                'Content-Disposition'       => 'inline',
                'Cache-Control'             => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                    => 'no-cache',
                'X-Content-Type-Options'    => 'nosniff',
            ];

        return $document instanceof \App\Services\ChunkedEncryptedFile
            ? $document->response($request, $headers)
            : $document->response($headers);
    }

    /**
     * Serve IMRAD PDF from an authenticated stream; no raw file is exposed.
     * Available to all authenticated users (same auth as servePdf).
     */
    public function serveImrad(Request $request, Capstone $capstone): \Symfony\Component\HttpFoundation\Response
    {
        $this->authorize('view', $capstone);
        if (!$capstone->imrad_path || !Storage::disk('local')->exists($capstone->imrad_path)) {
            return $this->errorResponse('IMRAD file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $document = $encryptor->openForViewing($capstone->imrad_path);

        if ($document === null) {
            return $this->errorResponse('IMRAD file could not be decrypted.', 500);
        }


        $headers = [
                'Content-Type'           => 'application/pdf',
                'Content-Disposition'    => 'inline',
                'Cache-Control'          => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                 => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ];

        return $document instanceof \App\Services\ChunkedEncryptedFile
            ? $document->response($request, $headers)
            : $document->response($headers);
    }

    /**
     * Serve an additional resource file inline (for viewing in a new tab).
     * Available to all authenticated users.
     */
    public function serveResource(Request $request, Capstone $capstone, CapstoneResource $resource): \Symfony\Component\HttpFoundation\Response
    {
        $this->authorize('view', $capstone);
        // Ensure the resource belongs to this capstone
        if ($resource->capstone_id !== $capstone->id) {
            return $this->errorResponse('Resource not found.', 404);
        }

        if (!$resource->file_path || !Storage::disk('local')->exists($resource->file_path)) {
            return $this->errorResponse('Resource file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $document = $encryptor->openForViewing($resource->file_path);

        if ($document === null) {
            return $this->errorResponse('Resource file could not be decrypted.', 500);
        }

        $originalName = $resource->file_original_name ?? $resource->name;
        $extension    = strtolower(pathinfo($originalName, PATHINFO_EXTENSION));

        $mimeMap = [
            'pdf'  => 'application/pdf',
            'doc'  => 'application/msword',
            'docx' => 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
            'xls'  => 'application/vnd.ms-excel',
            'xlsx' => 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            'ppt'  => 'application/vnd.ms-powerpoint',
            'pptx' => 'application/vnd.openxmlformats-officedocument.presentationml.presentation',
            'png'  => 'image/png',
            'jpg'  => 'image/jpeg',
            'jpeg' => 'image/jpeg',
            'gif'  => 'image/gif',
            'zip'  => 'application/zip',
            'txt'  => 'text/plain',
        ];

        $mimeType = $mimeMap[$extension] ?? 'application/octet-stream';
        // Office/archive/unknown formats trigger a browser download even with
        // inline disposition. Do not turn preview into a download-role bypass.
        if (!in_array($mimeType, ['application/pdf', 'text/plain', 'image/png', 'image/jpeg', 'image/gif'], true)) {
            $this->authorize('download', $capstone);
        }


        $headers = [
                'Content-Type'           => $mimeType,
                'Content-Disposition'    => 'inline; filename="' . addslashes($originalName) . '"',
                'Cache-Control'          => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                 => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ];

        return $document instanceof \App\Services\ChunkedEncryptedFile
            ? $document->response($request, $headers)
            : $document->response($headers);
    }

    /**
     * Download an additional resource file (admin + faculty only).
     */
    public function downloadResource(Request $request, Capstone $capstone, CapstoneResource $resource): \Symfony\Component\HttpFoundation\StreamedResponse|JsonResponse
    {
        $this->authorize('download', $capstone);
        $user = $request->user();

        // Students are not permitted to download resource files
        if ($user->hasRole('student')) {
            return $this->errorResponse('Students are not authorised to download resource files.', 403);
        }

        // Ensure the resource belongs to this capstone
        if ($resource->capstone_id !== $capstone->id) {
            return $this->errorResponse('Resource not found.', 404);
        }

        if (!$resource->file_path || !Storage::disk('local')->exists($resource->file_path)) {
            return $this->errorResponse('Resource file not found.', 404);
        }

        $encryptor = new PdfEncryptorService();
        $document = $encryptor->openVerifiedDocument($resource->file_path);

        if ($document === null) {
            return $this->errorResponse('Resource file could not be decrypted.', 500);
        }

        $filename = $resource->file_original_name ?? $resource->name;


        AuditLog::log(
            'download_resource',
            $user->id,
            Capstone::class,
            $capstone->id,
            null,
            ['resource' => $filename]
        );

        return $document->response([
                'Content-Type'           => 'application/octet-stream',
                'Content-Disposition'    => 'attachment; filename="' . addslashes($filename) . '"',
                'Cache-Control'          => 'no-store, no-cache, must-revalidate, max-age=0',
                'Pragma'                 => 'no-cache',
                'X-Content-Type-Options' => 'nosniff',
            ]);
    }

    /**
     * Toggle bookmark.
     */
    public function toggleBookmark(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('interact', $capstone);
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
        $this->authorize('update', $capstone);
        // Students can only edit their own capstones
        if ($request->user()->hasRole('student') && $capstone->uploaded_by !== $request->user()->id) {
            return $this->errorResponse('You can only edit your own capstones.', 403);
        }

        if ($request->exists('keywords')) {
            $request->merge(['keywords' => KeywordInput::normalize($request->input('keywords'))]);
        }

        $validator = Validator::make($request->all(), [
            'title'               => 'sometimes|string|max:255',
            'year'                => 'nullable|integer|min:2000|max:2099',
            'author'              => 'sometimes|string|max:255',
            'author_details'      => 'nullable|array',
            'author_details.*.name'    => 'required|string|max:255',
            'author_details.*.email'   => 'nullable|string|max:255',
            'author_details.*.contact' => 'nullable|string|max:50',
            'program'             => 'nullable|string|in:BSIT,BSCpE',
            'category'            => 'nullable|string|max:100',
            'abstract'            => 'nullable|string',
            'keywords'            => 'nullable|array|max:'.KeywordInput::MAX_KEYWORDS,
            'keywords.*'          => 'string|max:100',
            'publication_status'  => 'nullable|in:published,unpublished,in_progress',
            'copyright_status'    => 'nullable|in:copyrighted,pending,unprotected',
            'imrad_path'          => 'nullable|string',
            'imrad_original_name' => 'nullable|string',
            'adviser_id'          => 'nullable|exists:users,id',
            'adviser_name'        => 'nullable|string|max:255',
            'references'          => 'nullable|array',
            'references.*'        => 'integer|exists:capstones,id',
            'resources'           => 'nullable|array',
            'resources.*.name'             => 'required|string|max:255',
            'resources.*.file_path'        => 'required|string',
            'resources.*.file_original_name' => 'nullable|string',
        ]);

        if ($validator->fails()) {
            return $this->validationFailure($validator);
        }

        return DB::transaction(function () use ($request, $capstone) {
        Capstone::whereKey($capstone->id)->lockForUpdate()->firstOrFail();
        $uploads = app(\App\Services\DocumentUploads::class);
        $resources = $request->input('resources', []);
        foreach ($resources as &$resource) {
            $resource['file_path'] = $uploads->resolve($request->user(), $resource['file_path'], 'resource', $capstone);
        }
        unset($resource);
        $imradPath = $request->imrad_path ? $uploads->resolve($request->user(), $request->imrad_path, 'imrad', $capstone) : null;
        foreach ($request->input('references', []) as $id) {
            if (!Capstone::find($id)) abort(403, 'Referenced capstone unavailable.');
        }
        $adviser = ($request->exists('adviser_name') || $request->exists('adviser_id'))
            ? app(\App\Services\AdviserMatching::class)->resolve($request->input('adviser_name'), $request->input('adviser_id')) : [];
        $paths = array_merge([$imradPath], array_column($resources, 'file_path'));
        if (count(array_filter($paths)) !== count(array_unique(array_filter($paths)))) {
            throw \Illuminate\Validation\ValidationException::withMessages(['documents' => 'Duplicate upload references.']);
        }
        $oldValues = $capstone->only(['title', 'year', 'author', 'program', 'category', 'abstract', 'publication_status', 'copyright_status', 'adviser_id']);

        $updateData = $request->only([
            'title', 'year', 'author', 'author_details', 'program', 'category', 'abstract',
            'publication_status', 'copyright_status', 'imrad_path', 'imrad_original_name',
        ]);
        $updateData = array_merge($updateData, $adviser);

        // publication_status is already in $updateData — no need to sync is_published

        if ($request->has('imrad_path')) $updateData['imrad_path'] = $imradPath;
        if ($request->user()->hasRole('student')) {
            unset($updateData['publication_status']);
            $updateData['status'] = 'pending';
            $updateData['approval_status'] = 'pending';
            $updateData['publication_status'] = 'unpublished';
            $updateData['approved_by'] = null;
            $updateData['approved_at'] = null;
        } else {
            if (array_key_exists('publication_status', $updateData)) {
                $updateData['publication_status'] = $updateData['publication_status'] ?: 'unpublished';
            }
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
            foreach ($this->normalizeKeywords($request->input('keywords', [])) as $name) {
                $keyword = Keyword::withoutGlobalScope('request_access')->firstOrCreate(['name' => $name]);
                $keywordIds[] = $keyword->id;
            }
            $capstone->keywords()->sync($keywordIds);
        }

        if ($request->has('references')) {
            $refs = array_filter(array_unique(array_map('intval', $request->references ?? [])), fn($id) => $id !== (int) $capstone->id);
            $capstone->referencedCapstones()->sync($refs);
        }

        if ($request->has('resources')) {
            $capstone->resources()->delete();
            foreach ($resources as $res) {
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

        $uploads->claim($capstone, $paths);
        $capstone->load('keywords', 'referencedCapstones', 'resources', 'adviser:id,name');
        return $this->successResponse($capstone, 'Capstone updated.');
        });
    }

    /**
     * Return individual analytics for a single capstone.
     * Includes daily trends (last 30 days) for views, downloads, bookmarks,
     * plus summary totals, unique viewers, engagement rate, and peak day.
     */
    public function getAnalytics(Request $request, Capstone $capstone): JsonResponse
    {
        $this->authorize('view', $capstone);
        $days = 30;
        $start = now()->subDays($days - 1)->startOfDay();

        // Build a full date range so days with zero activity are included
        $dateRange = collect();
        for ($i = 0; $i < $days; $i++) {
            $dateRange->push(now()->subDays($days - 1 - $i)->format('Y-m-d'));
        }

        // Daily views
        $viewsByDay = \App\Models\CapstoneView::where('capstone_id', $capstone->id)
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        // Daily downloads
        $downloadsByDay = \App\Models\Download::where('capstone_id', $capstone->id)
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        // Daily bookmarks
        $bookmarksByDay = \App\Models\Bookmark::where('capstone_id', $capstone->id)
            ->where('created_at', '>=', $start)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->pluck('count', 'date');

        // Merge into unified trend array
        $trend = $dateRange->map(function ($date) use ($viewsByDay, $downloadsByDay, $bookmarksByDay) {
            return [
                'date'      => $date,
                'views'     => (int) ($viewsByDay[$date] ?? 0),
                'downloads' => (int) ($downloadsByDay[$date] ?? 0),
                'bookmarks' => (int) ($bookmarksByDay[$date] ?? 0),
            ];
        })->values();

        // Unique viewers (distinct user_id, falling back to ip_address for guests)
        $uniqueViewers = \App\Models\CapstoneView::where('capstone_id', $capstone->id)
            ->whereNotNull('user_id')
            ->distinct('user_id')
            ->count('user_id');

        // Peak activity day (most views in a single day, all-time)
        $peakDay = \App\Models\CapstoneView::where('capstone_id', $capstone->id)
            ->selectRaw('DATE(created_at) as date, COUNT(*) as count')
            ->groupBy('date')
            ->orderByDesc('count')
            ->first();

        // Engagement rate: (downloads / views) * 100, capped at 100
        $totalViews     = $capstone->view_count ?? 0;
        $totalDownloads = $capstone->download_count ?? 0;
        $engagementRate = $totalViews > 0
            ? round(min(($totalDownloads / $totalViews) * 100, 100), 1)
            : 0;

        return $this->successResponse([
            'summary' => [
                'total_views'      => $totalViews,
                'total_downloads'  => $totalDownloads,
                'total_bookmarks'  => $capstone->bookmark_count ?? 0,
                'unique_viewers'   => $uniqueViewers,
                'engagement_rate'  => $engagementRate,
                'peak_day'         => $peakDay ? ['date' => $peakDay->date, 'views' => (int) $peakDay->count] : null,
            ],
            'trend'   => $trend,
        ], 'Capstone analytics retrieved.');
    }

    // ────────────────────────────────────────────────────────────────────────
    // NLP Search Helper
    // ────────────────────────────────────────────────────────────────────────

    /**
     * Apply NLP-enhanced search to an Eloquent query.
     *
     * Strategy (in order):
     *  1. MySQL FULLTEXT BOOLEAN MODE on indexed columns — ranked, handles phrases.
     *  2. LIKE fallback for every expanded NLP term (catches short words, partials).
     *  3. Raw search LIKE for original input (safety net).
     *  4. Keyword relation search when $includeKeywords is true.
     *
     * @param  \Illuminate\Database\Eloquent\Builder $query
     * @param  string   $rawSearch       Raw user input
     * @param  string[] $fulltextColumns Columns in the FULLTEXT index
     * @param  bool     $includeKeywords Also search the keywords relation
     */
    private function applyNlpSearch(
        \Illuminate\Database\Eloquent\Builder $query,
        string $rawSearch,
        array $fulltextColumns,
        bool $includeKeywords = false
    ): void {
        $nlp           = new NlpSearchService();
        $expandedTerms = $nlp->expandTerms($rawSearch);
        $fulltextQuery = $nlp->buildFulltextQuery($rawSearch);
        $columns       = implode(', ', $fulltextColumns);

        $query->where(function ($q) use ($rawSearch, $expandedTerms, $fulltextQuery, $columns, $includeKeywords) {

            // 1. MySQL FULLTEXT boolean mode — relevance ranked, handles phrases
            if (!empty($fulltextQuery)) {
                try {
                    $q->orWhereRaw(
                        "MATCH({$columns}) AGAINST(? IN BOOLEAN MODE)",
                        [$fulltextQuery]
                    );
                } catch (\Throwable) {
                    // FULLTEXT not available — fall through to LIKE below
                }
            }

            // 2. LIKE fallbacks for each expanded NLP term
            foreach ($expandedTerms as $term) {
                $like = "%{$term}%";
                $q->orWhere('title',    'LIKE', $like)
                  ->orWhere('author',   'LIKE', $like)
                  ->orWhere('abstract', 'LIKE', $like)
                  ->orWhere('category', 'LIKE', $like);
            }

            // 3. Raw term LIKE safety net (catches very short terms)
            $rawLike = "%{$rawSearch}%";
            $q->orWhere('title',  'LIKE', $rawLike)
              ->orWhere('author', 'LIKE', $rawLike);

            // 4. Keyword relation search
            if ($includeKeywords && !empty($expandedTerms)) {
                $q->orWhereHas('keywords', function ($kq) use ($expandedTerms, $rawSearch) {
                    $kq->where(function ($inner) use ($expandedTerms, $rawSearch) {
                        foreach ($expandedTerms as $term) {
                            $inner->orWhere('name', 'LIKE', "%{$term}%");
                        }
                        $inner->orWhere('name', 'LIKE', "%{$rawSearch}%");
                    });
                });
            }
        });
    }

    /**
     * Return the first validation error as the top-level message so clients can
     * show "file is too large" instead of the generic "Validation failed.".
     */
    private function validationFailure(\Illuminate\Validation\Validator $validator): JsonResponse
    {
        $message = $validator->errors()->first();

        return $this->errorResponse(
            $message !== '' ? $message : 'Validation failed.',
            422,
            $validator->errors()
        );
    }

    private function uploadValidationMessages(string $field): array
    {
        $limits = app(UploadLimits::class);
        $server = $limits->serverSummary();

        return [
            $field.'.required' => 'Select a file before uploading.',
            $field.'.file' => 'The selected file could not be uploaded.',
            $field.'.mimes' => 'The selected file must be a valid PDF.',
            $field.'.uploaded' => 'The file was rejected by the server upload limit ('.$server.'). '
                .'Ask the administrator to raise upload_max_filesize and post_max_size.',
        ];
    }

    /**
     * PHP reports UPLOAD_ERR_INI_SIZE as a generic "failed to upload" message.
     * Add a precise error from the actual server ceilings.
     */
    private function addUploadLimitError(\Illuminate\Validation\Validator $validator, string $field): void
    {
        $validator->after(function (\Illuminate\Validation\Validator $validator) use ($field) {
            $file = request()->file($field);
            if (!$file) return;

            $limits = app(UploadLimits::class);
            $size = (int) $file->getSize();
            $serverMax = $limits->fileMaxBytes();
            $effectiveMax = $limits->effectiveMaxBytes();

            if (in_array($file->getError(), [UPLOAD_ERR_INI_SIZE, UPLOAD_ERR_FORM_SIZE], true)) {
                $validator->errors()->add($field,
                    'The file exceeds the server upload limit of '.$limits->humanBytes($serverMax).'. '
                    .'Ask the administrator to raise the PHP upload_max_filesize and post_max_size limits.');
            } elseif ($serverMax > 0 && $size > $serverMax) {
                $validator->errors()->add($field,
                    'The file is '.$limits->humanBytes($size).' but the server accepts at most '
                    .$limits->humanBytes($serverMax).' per file.');
            } elseif ($effectiveMax > 0 && $size > $effectiveMax) {
                $validator->errors()->add($field,
                    'The upload exceeds the maximum allowed size of '.$limits->humanBytes($effectiveMax).'.');
            }
        });
    }

    /**
     * Set a reasonable execution time limit for extraction and encryption
     * without overriding the administrator's configured memory ceiling.
     */
    private function prepareUploadEnvironment(\Illuminate\Http\UploadedFile $file): void
    {
        @set_time_limit(600);
    }
}
