<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Cache;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Storage;
use Symfony\Component\Process\Process;

/** Private encrypted web preview; the uploaded original is never replaced. */
class PdfPreviewService
{
    public function previewPath(string $source): string
    {
        $disk = Storage::disk('local');
        return 'document-previews/'.hash('sha256', 'linear-v1|'.$source.'|'.$disk->size($source).'|'.$disk->lastModified($source)).'.enc';
    }

    public function openForViewing(string $source): VerifiedDocument|ChunkedEncryptedFile|null
    {
        $encryptor = app(PdfEncryptorService::class);
        try {
            $preview = $this->previewPath($source);
            if (Storage::disk('local')->exists($preview)) {
                $document = $encryptor->openForViewing($preview);
                if ($document) return $document;
            }
        } catch (\Throwable $error) {
            Log::warning('PDF preview unavailable; opening original.', ['type' => get_class($error)]);
        }
        return $encryptor->openForViewing($source);
    }

    public function prepare(string $source, ?string $verifiedPlaintext = null): bool
    {
        $input = null; $output = null; $temporaryEncrypted = null; $lock = null;
        $disk = Storage::disk('local');
        try {
            $target = $this->previewPath($source);
            if ($disk->exists($target)) return true;
            $lock = Cache::store(config('acadex.upload_lock_store') ?: config('cache.default'))->lock('pdf-preview:'.hash('sha256',$source),300);
            if (!$lock->get()) return false;
            if ($disk->exists($target)) return true;
            if (disk_free_space($disk->path('')) < $disk->size($source) * 3 + 2147483648) return false;
            $input = $verifiedPlaintext ?? app(PdfEncryptorService::class)->decryptToTemp($source);
            if (!$input) return false;
            $output = PrivateTemp::file('.pdf');
            $binary = config('acadex.qpdf_binary', 'qpdf');
            $process = new Process([$binary, '--linearize', '--stream-data=preserve', '--object-streams=preserve', $input, $output]);
            $process->setTimeout(120)->run();
            if (!in_array($process->getExitCode(),[0,3],true) || filesize($output) < 8) return false;
            $counts = [];
            foreach ([$input,$output] as $file) {
                $check = new Process([$binary,'--show-npages',$file]);
                $check->setTimeout(30)->run();
                if (!in_array($check->getExitCode(),[0,3],true) || !ctype_digit(trim($check->getOutput()))) return false;
                $counts[] = (int) trim($check->getOutput());
            }
            if ($counts[0] < 1 || $counts[0] !== $counts[1]) return false;
            $check = new Process([$binary,'--check-linearization',$output]);
            $check->setTimeout(30)->run();
            if (!$check->isSuccessful()) return false;
            $temporaryEncrypted = app(PdfEncryptorService::class)->encryptAndStore('document-previews', new UploadedFile($output,'preview.pdf','application/pdf',null,true));
            $disk->move($temporaryEncrypted,$target);
            $temporaryEncrypted = null;
            return true;
        } catch (\Throwable $error) {
            Log::warning('Web PDF preview preparation unavailable.', ['type' => get_class($error)]);
            return false;
        } finally {
            if ($verifiedPlaintext === null && $input && is_file($input)) @unlink($input);
            if ($output && is_file($output)) @unlink($output);
            if ($temporaryEncrypted) $disk->delete($temporaryEncrypted);
            $lock?->release();
        }
    }
}
