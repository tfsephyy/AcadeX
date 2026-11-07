<?php

namespace App\Services;

use App\Models\Capstone;
use App\Models\DocumentUpload;
use App\Models\User;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;
use Illuminate\Validation\ValidationException;

class DocumentUploads
{
    /**
     * Calculate pending unexpired and unclaimed upload count and total bytes.
     *
     * @return array{count: int, bytes: int}
     */
    public function pendingUsage(User $user): array
    {
        $pending = DocumentUpload::where('user_id', $user->id)
            ->whereNull('capstone_id')
            ->where('expires_at', '>', now())
            ->get(['path']);
        $disk = Storage::disk('local');
        $bytes = 0;
        $count = 0;
        foreach ($pending as $upload) {
            if ($disk->exists($upload->path)) {
                $bytes += $disk->size($upload->path);
                $count++;
            }
        }
        return ['count' => $count, 'bytes' => $bytes];
    }

    public static function quotaMessage(int $count, int $bytes, int $maxBytes): string
    {
        $countStr = $count === 1 ? '1 unsubmitted upload' : "{$count} unsubmitted uploads";
        $limits = app(UploadLimits::class);
        $usedStr = $limits->humanBytes($bytes);
        $limitStr = $limits->humanBytes($maxBytes);
        return "You have {$countStr} using {$usedStr} of your {$limitStr} limit. Submit or discard them (they expire automatically after 24 hours).";
    }

    public function stage(User $user, string $purpose, string $path, string $processingStatus = DocumentUpload::STATUS_COMPLETED, ?string $originalName = null): string
    {
        $id = (string) Str::uuid();
        try {
            DB::transaction(function () use ($id, $user, $purpose, $path, $processingStatus, $originalName) {
                // Serialize this owner's allocations, including concurrent uploads.
                User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                $usage = $this->pendingUsage($user);
                $disk = Storage::disk('local');
                $newBytes = $disk->exists($path) ? $disk->size($path) : 0;
                $totalBytes = $usage['bytes'] + $newBytes;
                $maxUploads = max(1, (int) config('acadex.max_pending_uploads', 20));
                $maxBytes = max(1, (int) config('acadex.max_pending_upload_bytes', 1073741824));
                if ($usage['count'] >= $maxUploads || $totalBytes > $maxBytes) {
                    throw ValidationException::withMessages(['documents' =>
                        self::quotaMessage($usage['count'], $usage['bytes'], $maxBytes)]);
                }
                DocumentUpload::create(['id' => $id, 'user_id' => $user->id, 'purpose' => $purpose,
                    'path' => $path, 'expires_at' => now()->addHours(24),
                    'processing_status' => $processingStatus, 'original_name' => $originalName]);
            }, 3);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }
        return 'upload:'.$id;
    }

    /** Resolve an upload reference owned by this user for a status/retry request. */
    public function findOwned(User $user, string $reference): ?DocumentUpload
    {
        if (!str_starts_with($reference, 'upload:')) return null;
        return DocumentUpload::whereKey(substr($reference, 7))
            ->where('user_id', $user->id)
            ->first();
    }

    // Must run inside the controller's DB transaction, before record mutation.
    public function resolve(User $user, string $reference, string $purpose, ?Capstone $capstone = null): string
    {
        if ($capstone && $purpose === 'imrad' && $reference === 'imrad:'.$capstone->id && $capstone->imrad_path) {
            return $capstone->imrad_path;
        }
        if ($capstone && $purpose === 'resource' && preg_match('/^resource:(\d+)$/D', $reference, $match)) {
            $resource = $capstone->resources()->whereKey($match[1])->first();
            if ($resource) return $resource->file_path;
        }
        $upload = str_starts_with($reference, 'upload:')
            ? DocumentUpload::whereKey(substr($reference, 7))->lockForUpdate()->first() : null;
        if (!$upload || (int) $upload->user_id !== (int) $user->id || $upload->purpose !== $purpose ||
            $upload->capstone_id !== null || !$upload->expires_at->isFuture() ||
            !Storage::disk('local')->exists($upload->path)) {
            throw ValidationException::withMessages(['documents' => 'Invalid, expired, reused or unowned upload reference.']);
        }
        return $upload->path;
    }

    public function claim(Capstone $capstone, array $paths): void
    {
        DocumentUpload::whereIn('path', array_values(array_filter($paths)))
            ->whereNull('capstone_id')->update(['capstone_id' => $capstone->id]);
    }
}
