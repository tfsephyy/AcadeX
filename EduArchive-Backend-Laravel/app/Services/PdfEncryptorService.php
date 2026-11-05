<?php

namespace App\Services;

use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Illuminate\Validation\ValidationException;

/**
 * PdfEncryptorService
 *
 * New files use bounded authenticated streams; existing Laravel ciphertext is
 * read without conversion. The existing application key remains authoritative.
 */
class PdfEncryptorService
{
    /**
     * Encrypt raw file bytes and store to disk.
     * Returns the storage path.
     */
    public function encryptAndStore(string $directory, \Illuminate\Http\UploadedFile $file, string $disk = 'local'): string
    {
        $filesystem = Storage::disk($disk);
        if (!$filesystem->getAdapter() instanceof \League\Flysystem\Local\LocalFilesystemAdapter) {
            throw new \RuntimeException('Streaming documents require the configured private local disk.');
        }
        $free = @disk_free_space($filesystem->path(''));
        $reserve = max(0, (int) config('acadex.min_free_storage_bytes', 2147483648));
        if ($free === false || $free < $reserve + ($file->getSize() * 2) + 4096) {
            throw ValidationException::withMessages(['documents' => 'Document storage is temporarily unavailable. Contact the administrator.']);
        }
        $filename = $directory . '/' . bin2hex(random_bytes(16)) . '.enc';
        $filesystem->makeDirectory($directory);
        $destination = $filesystem->path($filename);
        $source = $target = null;
        $stored = false;
        $created = false;
        try {
            $source = fopen($file->getRealPath(), 'rb');
            $target = fopen($destination, 'x+b');
            $created = is_resource($target);
            if ($source === false || $target === false) throw new \RuntimeException('Cannot open document streams.');
            if (!chmod($destination, 0600)) throw new \RuntimeException('Cannot restrict encrypted document permissions.');
            // Independent authenticated blocks allow PDF.js to request only
            // the byte ranges needed for its first page and later navigation.
            ChunkedEncryptedFile::encrypt($source, $target, Crypt::getKey());
            if (!fflush($target)) throw new \RuntimeException('Encrypted file could not be flushed.');
            $stored = true;
            return $filename;
        } finally {
            if (is_resource($source)) fclose($source);
            if (is_resource($target)) fclose($target);
            // Close before removing a partial write (also required on Windows).
            if ($created && !$stored && is_file($destination)) $filesystem->delete($filename);
        }
    }

    /**
     * Store raw bytes (already in string form) encrypted.
     */
    public function encryptRawAndStore(string $path, string $rawBytes, string $disk = 'local'): void
    {
        if (!Storage::disk($disk)->put($path, Crypt::encryptString($rawBytes))) {
            throw new \RuntimeException('Encrypted file could not be stored.');
        }
    }

    /**
     * Decrypt an encrypted file from disk and return raw bytes.
     * Returns null if file not found or decryption fails.
     */
    public function decryptFromDisk(string $path, string $disk = 'local'): ?string
    {
        $document = $this->openVerifiedDocument($path, $disk);
        if (!$document) return null;
        try {
            return $document->size() <= 64 * 1024 * 1024 ? $document->contents() : null;
        } finally {
            $document->close();
        }
    }

    /**
     * Decrypt an encrypted document into a private temp file for background
     * extraction. The caller owns the returned path and must unlink it.
     */
    public function decryptToTemp(string $path, string $extension = '.pdf', string $disk = 'local'): ?string
    {
        $document = $this->openVerifiedDocument($path, $disk);
        if (!$document) return null;

        $temp = PrivateTemp::file($extension);
        $output = null;
        $complete = false;
        try {
            $output = fopen($temp, 'wb');
            if ($output === false) throw new \RuntimeException('Cannot open extraction temp file.');
            $document->copyTo($output);
            $complete = true;
            return $temp;
        } finally {
            if (is_resource($output)) fclose($output);
            $document->close();
            if (!$complete && is_file($temp)) @unlink($temp);
        }
    }

    /** Authenticate the complete document before exposing a response or plaintext. */
    public function openVerifiedDocument(string $path, string $disk = 'local'): ?VerifiedDocument    {
        $source = null;
        try {
            $filesystem = Storage::disk($disk);
            if (!$filesystem->exists($path)) return null;
            $source = $filesystem->readStream($path);
            if (!is_resource($source) || !flock($source, LOCK_SH)) throw new \RuntimeException('Cannot lock encrypted document.');

            $prefix = fread($source, strlen(ChunkedEncryptedFile::MAGIC));
            if ($prefix === ChunkedEncryptedFile::MAGIC) {
                $document = ChunkedEncryptedFile::open($source, Crypt::getAllKeys());
                foreach ($document->chunks() as $_chunk) {
                    // Verify each independently authenticated block before a
                    // full-download/extraction caller receives the document.
                }
                $size = $document->size();
                return new VerifiedDocument($source, static fn () => $document->chunks(), $size);
            }

            rewind($source);
            $magic = fread($source, strlen(EncryptedFileStream::MAGIC));
            if ($magic === EncryptedFileStream::MAGIC) {
                foreach (Crypt::getAllKeys() as $applicationKey) {
                    $key = EncryptedFileStream::key($applicationKey);
                    try {
                        $size = 0;
                        foreach (EncryptedFileStream::chunks($source, $key) as $chunk) $size += strlen($chunk);
                        return new VerifiedDocument($source,
                            static fn () => EncryptedFileStream::chunks($source, $key), $size);
                    } catch (\RuntimeException|\SodiumException) {
                        // Try explicitly configured previous application keys only.
                    }
                }
                throw new \RuntimeException('Document authentication failed.');
            }
            // Historical files were limited to 64 MiB plaintext. Bound the
            // legacy decoder allocation even if the version header was damaged.
            if (fstat($source)['size'] > 128 * 1024 * 1024) throw new \RuntimeException('Invalid legacy document size.');
            rewind($source);
            $ciphertext = stream_get_contents($source);
            try {
                $plaintext = Crypt::decryptString($ciphertext);
            } catch (\Illuminate\Contracts\Encryption\DecryptException $error) {
                if (!config('acadex.allow_legacy_plaintext') || str_ends_with($path, '.enc')) throw $error;
                $plaintext = $ciphertext;
            }
            if (strlen($plaintext) > 64 * 1024 * 1024) throw new \RuntimeException('Invalid legacy plaintext size.');
            return new VerifiedDocument($source, static function () use ($plaintext) { yield $plaintext; }, strlen($plaintext));
        } catch (\Throwable) {
            if (is_resource($source)) { flock($source, LOCK_UN); fclose($source); }
            return null;
        }
    }

    /**
     * Open a document for inline viewing. New V2 files support authenticated
     * HTTP ranges; existing V1/legacy files retain their verified full-stream
     * response until explicitly converted.
     */
    public function openForViewing(string $path, string $disk = 'local'): VerifiedDocument|ChunkedEncryptedFile|null
    {
        $source = null;
        try {
            $filesystem = Storage::disk($disk);
            if (!$filesystem->exists($path)) return null;
            $source = $filesystem->readStream($path);
            if (!is_resource($source) || !flock($source, LOCK_SH)) throw new \RuntimeException('Cannot lock encrypted document.');
            $prefix = fread($source, strlen(ChunkedEncryptedFile::MAGIC));
            if ($prefix === ChunkedEncryptedFile::MAGIC) {
                return ChunkedEncryptedFile::open($source, Crypt::getAllKeys());
            }
            flock($source, LOCK_UN);
            fclose($source);
            $source = null;
            return $this->openVerifiedDocument($path, $disk);
        } catch (\Throwable) {
            if (is_resource($source)) { flock($source, LOCK_UN); fclose($source); }
            return null;
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

        $prefix = Storage::disk($disk)->readStream($path);
        if (!is_resource($prefix)) return false;
        try { $magic = fread($prefix, max(strlen(EncryptedFileStream::MAGIC), strlen(ChunkedEncryptedFile::MAGIC))); }
        finally { fclose($prefix); }
        if (str_starts_with($magic, EncryptedFileStream::MAGIC) || str_starts_with($magic, ChunkedEncryptedFile::MAGIC)) return false;
        // This explicit legacy conversion command must never allocate a new large file.
        if (Storage::disk($disk)->size($path) > 64 * 1024 * 1024) return false;
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
