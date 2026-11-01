<?php

namespace Tests\Unit;

use App\Services\PdfEncryptorService;
use Illuminate\Encryption\Encrypter;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Crypt;
use Illuminate\Support\Facades\Storage;
use Tests\TestCase;

class StreamingDocumentTest extends TestCase
{
    protected function setUp(): void
    {
        parent::setUp();
        Storage::fake('local');
        config(['acadex.min_free_storage_bytes' => 0]);
    }

    public function test_new_encrypted_document_round_trips_multiple_frames_without_plaintext_storage(): void
    {
        $bytes = "%PDF-1.4\n".str_repeat('synthetic-private-document-', 100000);
        $service = new PdfEncryptorService();
        $path = $service->encryptAndStore('capstones', UploadedFile::fake()->createWithContent('synthetic.pdf', $bytes));
        $ciphertext = Storage::disk('local')->get($path);
        self::assertStringNotContainsString('synthetic-private-document-', $ciphertext);
        self::assertLessThan(strlen($bytes) + 4096, strlen($ciphertext));
        $document = $service->openVerifiedDocument($path);
        self::assertNotNull($document);
        self::assertSame(strlen($bytes), $document->size());
        self::assertSame($bytes, $document->contents());
        $document->close();
    }

    public function test_legacy_laravel_ciphertext_is_readable_and_never_rewritten(): void
    {
        $ciphertext = Crypt::encryptString('%PDF-1.4 legacy synthetic bytes');
        Storage::disk('local')->put('capstones/legacy.enc', $ciphertext);
        $service = new PdfEncryptorService();
        $document = $service->openVerifiedDocument('capstones/legacy.enc');
        self::assertNotNull($document);
        self::assertSame('%PDF-1.4 legacy synthetic bytes', $document->contents());
        $document->close();
        self::assertSame($ciphertext, Storage::disk('local')->get('capstones/legacy.enc'));
    }

    public function test_corruption_truncation_and_appended_bytes_are_rejected_before_response(): void
    {
        $service = new PdfEncryptorService();
        $path = $service->encryptAndStore('capstones', UploadedFile::fake()->createWithContent('synthetic.pdf', str_repeat('a', 2200000)));
        $original = Storage::disk('local')->get($path);
        $tampered = $original;
        $tampered[1500000] = chr(ord($tampered[1500000]) ^ 1);
        $start = strlen(\App\Services\EncryptedFileStream::MAGIC) + 24;
        $frameLength = 4 + 1048576 + 17;
        $reordered = substr($original, 0, $start)
            .substr($original, $start + $frameLength, $frameLength)
            .substr($original, $start, $frameLength)
            .substr($original, $start + 2 * $frameLength);
        $missing = substr($original, 0, $start).substr($original, $start + $frameLength);
        foreach ([$tampered, substr($original, 0, -1), substr($original, 0, -21), $original.'extra', $reordered, $missing] as $invalid) {
            Storage::disk('local')->put($path, $invalid);
            self::assertNull($service->openVerifiedDocument($path));
        }
    }

    public function test_explicit_legacy_conversion_skips_new_encrypted_files_without_modifying_them(): void
    {
        $service = new PdfEncryptorService();
        $path = $service->encryptAndStore('capstones', UploadedFile::fake()->createWithContent('synthetic.pdf', 'synthetic bytes'));
        $hash = hash_file('sha256', Storage::disk('local')->path($path));
        self::assertFalse($service->reEncryptPlainFile($path));
        self::assertSame($hash, hash_file('sha256', Storage::disk('local')->path($path)));
    }

    public function test_failed_encryption_removes_only_its_partial_file_and_preserves_existing_storage(): void
    {
        Storage::disk('local')->put('capstones/preserved.enc', 'existing synthetic sentinel');
        $source = tempnam(sys_get_temp_dir(), 'acadex-oversize-');
        $stream = fopen($source, 'w+b');
        ftruncate($stream, 134217729);
        fclose($stream);
        try {
            try {
                (new PdfEncryptorService())->encryptAndStore('capstones', new UploadedFile($source, 'oversize.pdf', 'application/pdf', null, true));
                self::fail('Oversized direct encryption must fail.');
            } catch (\RuntimeException $error) {
                self::assertStringContainsString('128 MiB', $error->getMessage());
            }
            self::assertSame(['capstones/preserved.enc'], Storage::disk('local')->allFiles());
            self::assertSame('existing synthetic sentinel', Storage::disk('local')->get('capstones/preserved.enc'));
        } finally { unlink($source); }
    }

    public function test_wrong_key_is_rejected_and_previous_key_can_read_new_format(): void
    {
        $service = new PdfEncryptorService();
        $path = $service->encryptAndStore('capstones', UploadedFile::fake()->createWithContent('synthetic.pdf', 'private synthetic bytes'));
        $original = Crypt::getFacadeRoot();
        $replacement = new Encrypter(random_bytes(32), 'AES-256-CBC');
        try {
            Crypt::swap($replacement);
            self::assertNull($service->openVerifiedDocument($path));
            $replacement->previousKeys([$original->getKey()]);
            $document = $service->openVerifiedDocument($path);
            self::assertNotNull($document);
            self::assertSame('private synthetic bytes', $document->contents());
            $document->close();
        } finally {
            Crypt::swap($original);
        }
    }
}
