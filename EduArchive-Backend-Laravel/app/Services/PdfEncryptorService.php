<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;

/**
 * PdfEncryptorService
 *
 * Encrypts and decrypts files at rest using Laravel's AES-256 encryption.
 * Files are stored as encrypted ciphertext; decryption happens in-memory only.
 */
class PdfEncryptorService
{
    /**
     * Encrypt raw file bytes and store to disk.
     * Returns the storage path.
     */
    public function encryptAndStore(string $directory, \Illuminate\Http\UploadedFile $file, string $disk = 'local'): string
    {
        $raw        = file_get_contents($file->getRealPath());
        $encrypted  = Crypt::encryptString($raw);
        $filename   = $directory . '/' . uniqid('', true) . '.enc';

        Storage::disk($disk)->put($filename, $encrypted);

        return $filename;
    }

    /**
     * Store raw bytes (already in string form) encrypted.
     */
    public function encryptRawAndStore(string $path, string $rawBytes, string $disk = 'local'): void
    {
        Storage::disk($disk)->put($path, Crypt::encryptString($rawBytes));
    }

    /**
     * Decrypt an encrypted file from disk and return raw bytes.
     * Returns null if file not found or decryption fails.
     */
    public function decryptFromDisk(string $path, string $disk = 'local'): ?string
    {
        if (!Storage::disk($disk)->exists($path)) {
            return null;
        }

        try {
            $ciphertext = Storage::disk($disk)->get($path);
            return Crypt::decryptString($ciphertext);
        } catch (\Illuminate\Contracts\Encryption\DecryptException) {
            // File was stored before encryption was implemented — serve as-is (raw PDF)
            return $ciphertext;
        }
    }

    /**
     * Re-encrypt a file that is currently stored as plain bytes.
     * Used by the EncryptExistingPdfs artisan command.
     */
    public function reEncryptPlainFile(string $path, string $disk = 'local'): bool
    {
        if (!Storage::disk($disk)->exists($path)) {
            return false;
        }

        $raw = Storage::disk($disk)->get($path);

        // Check if already encrypted (Laravel encrypted strings start with 'eyJ')
        if (str_starts_with($raw, 'eyJ')) {
            return false; // already encrypted, skip
        }

        Storage::disk($disk)->put($path, Crypt::encryptString($raw));
        return true;
    }

    /**
     * Generate a signed time-limited token for PDF access.
     * Payload: capstone_id + user_id + expires_at
     */
    public function generateToken(int $capstoneId, int $userId, int $ttlMinutes = 30): string
    {
        $payload = json_encode([
            'capstone_id' => $capstoneId,
            'user_id'     => $userId,
            'expires_at'  => now()->addMinutes($ttlMinutes)->timestamp,
        ]);

        return base64_encode(Crypt::encryptString($payload));
    }

    /**
     * Validate a signed PDF token.
     * Returns the payload array or null if invalid/expired.
     */
    public function validateToken(string $token, int $capstoneId, int $userId): ?array
    {
        try {
            $payload = json_decode(Crypt::decryptString(base64_decode($token)), true);

            if (!$payload) {
                return null;
            }

            // Check capstone and user binding
            if ((int) $payload['capstone_id'] !== $capstoneId || (int) $payload['user_id'] !== $userId) {
                return null;
            }

            // Check expiry
            if (now()->timestamp > $payload['expires_at']) {
                return null;
            }

            return $payload;
        } catch (\Throwable) {
            return null;
        }
    }
}
