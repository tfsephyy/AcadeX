<?php

namespace App\Console\Commands;

use App\Services\ChunkedEncryptedFile;
use App\Services\PdfEncryptorService;
use Illuminate\Console\Command;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use League\Flysystem\Local\LocalFilesystemAdapter;

/**
 * Optional, backup-preserving conversion of existing encrypted documents to
 * the random-access format used by the progressive PDF viewer.
 */
class UpgradeDocumentEncryption extends Command
{
    protected $signature = 'acadex:upgrade-document-encryption
        {--dry-run : List legacy documents without modifying them}
        {--force : Confirm the conversion after the backup warning}
        {--limit=0 : Convert at most this many unique files (0 means all)}';

    protected $description = 'Back up and convert existing encrypted documents for authenticated PDF range viewing.';

    public function handle(): int
    {
        $disk = Storage::disk('local');
        if (!$disk->getAdapter() instanceof LocalFilesystemAdapter) {
            $this->error('Document conversion requires the private local storage disk.');
            return self::FAILURE;
        }

        $paths = $this->referencedPaths();
        $limit = max(0, (int) $this->option('limit'));
        if ($limit > 0) $paths = array_slice($paths, 0, $limit);
        $dryRun = (bool) $this->option('dry-run');

        if ($dryRun) {
            $this->info('Dry run: '.count($paths).' unique referenced document paths will be checked.');
        } elseif (!$this->option('force') && !$this->confirm(
            'This will rewrite encrypted files in place after saving exact encrypted backups under private storage. Confirm a separate production backup exists and continue?'
        )) {
            $this->warn('No documents were changed.');
            return self::FAILURE;
        }

        $runId = now()->format('YmdHis').'-'.Str::lower(Str::random(8));
        $backupRoot = 'acadex-encryption-backups/'.$runId;
        $converted = 0;
        $already = 0;
        $missing = 0;
        $failed = 0;
        $manifest = [];

        foreach ($paths as $path) {
            if (!$this->isSafeStoragePath($disk, $path)) {
                $this->error('A referenced document path is invalid or escapes private storage; it was not opened.');
                $failed++;
                continue;
            }
            if (!$disk->exists($path)) {
                $this->warn("Missing referenced file: {$path}");
                $missing++;
                continue;
            }

            $absolutePath = $disk->path($path);
            $prefixStream = $disk->readStream($path);
            if (!is_resource($prefixStream)) {
                $this->error("Cannot open referenced file: {$path}");
                $failed++;
                continue;
            }
            $prefix = fread($prefixStream, strlen(ChunkedEncryptedFile::MAGIC));
            fclose($prefixStream);
            if ($prefix === ChunkedEncryptedFile::MAGIC) {
                $verified = app(PdfEncryptorService::class)->openVerifiedDocument($path);
                if (!$verified) {
                    $this->error('A V2 encrypted document failed full authentication and was left untouched.');
                    $failed++;
                    continue;
                }
                $verified->close();
                $already++;
                continue;
            }

            if ($dryRun) {
                $this->line("Would convert legacy encrypted file: {$path}");
                continue;
            }

            $document = null;
            $target = null;
            $temporaryPath = $path.'.v2tmp-'.Str::lower(Str::random(12));
            $temporaryAbsolute = $disk->path($temporaryPath);
            $backupPath = $backupRoot.'/'.hash('sha256', $path).'.enc';
            $backupAbsolute = $disk->path($backupPath);

            try {
                $sourceBytes = filesize($absolutePath);
                $freeBytes = @disk_free_space(dirname($absolutePath));
                $reserve = max(0, (int) config('acadex.min_free_storage_bytes', 2147483648));
                if ($sourceBytes === false || $freeBytes === false || $freeBytes < ($sourceBytes * 2) + $reserve) {
                    throw new \RuntimeException('Not enough free disk space for an encrypted backup and replacement file.');
                }

                $document = app(PdfEncryptorService::class)->openVerifiedDocument($path);
                if (!$document) throw new \RuntimeException('The original file did not pass full authentication.');

                $disk->makeDirectory(dirname($backupPath));
                @chmod($disk->path(dirname($backupPath)), 0700);
                if (!copy($absolutePath, $backupAbsolute)) throw new \RuntimeException('Could not create the encrypted backup.');
                chmod($backupAbsolute, 0600);
                $sourceHash = hash_file('sha256', $absolutePath);
                $backupHash = hash_file('sha256', $backupAbsolute);
                if (!$sourceHash || !hash_equals($sourceHash, (string) $backupHash)) {
                    throw new \RuntimeException('The encrypted backup did not match the original file.');
                }

                $this->appendManifest($disk->path($backupRoot.'/manifest.json'), $manifest, [
                    'source_path' => $path,
                    'backup_path' => $backupPath,
                    'source_sha256' => $sourceHash,
                    'state' => 'backup_verified',
                ]);

                $disk->makeDirectory(dirname($temporaryPath));
                $target = fopen($temporaryAbsolute, 'x+b');
                if ($target === false) throw new \RuntimeException('Could not open the private replacement file.');
                chmod($temporaryAbsolute, 0600);
                $plainSize = ChunkedEncryptedFile::encryptChunks($document->chunks(), $target, Crypt::getKey());
                if (!fflush($target)) throw new \RuntimeException('Could not flush the replacement file.');
                fclose($target);
                $target = null;
                $document->close();
                $document = null;

                $replacement = app(PdfEncryptorService::class)->openVerifiedDocument($temporaryPath);
                if (!$replacement || $replacement->size() !== $plainSize) {
                    $replacement?->close();
                    throw new \RuntimeException('The replacement did not pass full authentication.');
                }
                $replacement->close();

                if (!hash_equals($sourceHash, (string) hash_file('sha256', $absolutePath))) {
                    throw new \RuntimeException('The source changed during conversion; the original was preserved.');
                }
                if (!rename($temporaryAbsolute, $absolutePath)) {
                    throw new \RuntimeException('Could not atomically replace the source file.');
                }
                chmod($absolutePath, 0600);

                $installed = app(PdfEncryptorService::class)->openVerifiedDocument($path);
                if (!$installed || $installed->size() !== $plainSize) {
                    $installed?->close();
                    $restorePath = $path.'.restore-'.Str::lower(Str::random(12));
                    $restoreAbsolute = $disk->path($restorePath);
                    if (copy($backupAbsolute, $restoreAbsolute)) {
                        chmod($restoreAbsolute, 0600);
                        rename($restoreAbsolute, $absolutePath);
                    }
                    throw new \RuntimeException('The installed file failed verification; the encrypted backup was restored where possible.');
                }
                $installed->close();

                $this->appendManifest($disk->path($backupRoot.'/manifest.json'), $manifest, [
                    'source_path' => $path,
                    'backup_path' => $backupPath,
                    'source_sha256' => $sourceHash,
                    'replacement_sha256' => hash_file('sha256', $absolutePath),
                    'plaintext_bytes' => $plainSize,
                    'state' => 'converted',
                ]);
                $converted++;
                $this->info("Converted after backup and verification: {$path}");
            } catch (\Throwable $error) {
                $failed++;
                $this->error("Could not convert {$path}: ".$error->getMessage());
            } finally {
                if (is_resource($target)) fclose($target);
                if ($document) $document->close();
                if ($disk->exists($temporaryPath)) $disk->delete($temporaryPath);
            }
        }

        if (!$dryRun && $manifest !== []) {
            $this->info('Encrypted backup and conversion manifest: '.$backupRoot);
        }
        $this->info("Finished: {$converted} converted, {$already} already current, {$missing} missing, {$failed} failed.");

        return $failed === 0 ? self::SUCCESS : self::FAILURE;
    }

    /** @return list<string> */
    private function referencedPaths(): array
    {
        $paths = [];
        foreach (DB::table('capstones')->get(['pdf_path', 'imrad_path']) as $row) {
            if ($row->pdf_path) $paths[] = $row->pdf_path;
            if ($row->imrad_path) $paths[] = $row->imrad_path;
        }
        foreach (DB::table('capstone_resources')->whereNotNull('file_path')->pluck('file_path') as $path) $paths[] = $path;
        foreach (DB::table('document_uploads')->whereNotNull('path')->pluck('path') as $path) $paths[] = $path;
        return array_values(array_unique(array_filter($paths)));
    }

    /** Reject traversal, absolute paths, and symlinks outside the private disk. */
    private function isSafeStoragePath($disk, string $path): bool
    {
        if ($path === '' || str_contains($path, "\0") || str_starts_with($path, '/') || str_starts_with($path, '\\')) {
            return false;
        }

        $normalized = str_replace('\\', '/', $path);
        foreach (explode('/', $normalized) as $segment) {
            if ($segment === '' || $segment === '.' || $segment === '..' || str_contains($segment, ':')) {
                return false;
            }
        }

        $root = realpath($disk->path(''));
        $candidate = realpath($disk->path($normalized));
        if ($root === false || $candidate === false || is_link($disk->path($normalized))) return false;

        $root = rtrim(str_replace('\\', '/', $root), '/').'/';
        $candidate = str_replace('\\', '/', $candidate);
        return str_starts_with($candidate, $root);
    }

    /** Keep a private, atomically rewritten path-to-backup manifest. */
    private function appendManifest(string $path, array &$manifest, array $entry): void
    {
        $manifest[$entry['source_path']] = array_merge($manifest[$entry['source_path']] ?? [], $entry);
        $json = json_encode(array_values($manifest), JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES | JSON_THROW_ON_ERROR);
        $temporary = $path.'.tmp';
        if (file_put_contents($temporary, $json, LOCK_EX) === false) throw new \RuntimeException('Could not write the private backup manifest.');
        chmod($temporary, 0600);
        if (!rename($temporary, $path)) throw new \RuntimeException('Could not install the private backup manifest.');
        chmod($path, 0600);
    }
}
