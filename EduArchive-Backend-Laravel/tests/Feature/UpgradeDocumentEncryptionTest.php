<?php

namespace Tests\Feature;

use App\Services\ChunkedEncryptedFile;
use App\Services\EncryptedFileStream;
use App\Services\PdfEncryptorService;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class UpgradeDocumentEncryptionTest extends SecurityTestCase
{
    public function test_legacy_file_is_backed_up_verified_and_converted_without_changing_its_reference(): void
    {
        config(['acadex.min_free_storage_bytes' => 0]);
        $owner = $this->user('admin');
        $path = 'capstones/synthetic-v1.enc';
        $plaintext = "%PDF-1.4\nSynthetic conversion fixture\n%%EOF";
        $source = fopen('php://temp', 'w+b');
        $encrypted = fopen('php://temp', 'w+b');
        fwrite($source, $plaintext);
        rewind($source);
        EncryptedFileStream::encrypt($source, $encrypted, EncryptedFileStream::key(Crypt::getKey()));
        rewind($encrypted);
        $legacyCiphertext = stream_get_contents($encrypted);
        fclose($source);
        fclose($encrypted);
        Storage::disk('local')->put($path, $legacyCiphertext);

        $capstone = $this->capstone($owner, ['pdf_path' => $path]);

        $this->artisan('acadex:upgrade-document-encryption', ['--force' => true])
            ->assertSuccessful();

        $replacement = Storage::disk('local')->get($path);
        self::assertStringStartsWith(ChunkedEncryptedFile::MAGIC, $replacement);
        self::assertSame($path, $capstone->fresh()->pdf_path);

        $verified = app(PdfEncryptorService::class)->openVerifiedDocument($path);
        self::assertNotNull($verified);
        self::assertSame($plaintext, $verified->contents());
        $verified->close();

        $files = Storage::disk('local')->allFiles();
        $backup = collect($files)->first(fn (string $file) => str_starts_with($file, 'acadex-encryption-backups/') && str_ends_with($file, '.enc'));
        self::assertNotNull($backup);
        self::assertSame($legacyCiphertext, Storage::disk('local')->get($backup));

        $manifest = collect($files)->first(fn (string $file) => str_starts_with($file, 'acadex-encryption-backups/') && str_ends_with($file, 'manifest.json'));
        self::assertNotNull($manifest);
        self::assertSame('converted', json_decode(Storage::disk('local')->get($manifest), true)[0]['state']);
    }
}
