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
    public function stage(User $user, string $purpose, string $path): string
    {
        $id = (string) Str::uuid();
        try {
            DB::transaction(function () use ($id, $user, $purpose, $path) {
                // Serialize this owner's allocations, including concurrent uploads.
                User::whereKey($user->id)->lockForUpdate()->firstOrFail();
                $pending = DocumentUpload::where('user_id', $user->id)->whereNull('capstone_id')->get(['path']);
                $disk = Storage::disk('local');
                $bytes = $disk->size($path);
                foreach ($pending as $upload) {
                    if ($disk->exists($upload->path)) $bytes += $disk->size($upload->path);
                }
                if ($pending->count() >= max(1, (int) config('acadex.max_pending_uploads', 20)) ||
                    $bytes > max(1, (int) config('acadex.max_pending_upload_bytes', 268435456))) {
                    throw ValidationException::withMessages(['documents' =>
                        'Your pending uploads have reached the storage limit. Submit an existing upload or contact the administrator.']);
                }
                DocumentUpload::create(['id' => $id, 'user_id' => $user->id, 'purpose' => $purpose,
                    'path' => $path, 'expires_at' => now()->addHours(24)]);
            }, 3);
        } catch (\Throwable $e) {
            Storage::disk('local')->delete($path);
            throw $e;
        }
        return 'upload:'.$id;
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
