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
        $headerBytes = strlen(\App\Services\ChunkedEncryptedFile::MAGIC)
            + \App\Services\ChunkedEncryptedFile::FILE_ID_BYTES;
        $frameBytes = \App\Services\EncryptedFileStream::CHUNK_BYTES
            + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_ABYTES;
        $footerBytes = \App\Services\ChunkedEncryptedFile::FOOTER_BYTES;
        $tamperOffset = $headerBytes + 100;
        $tampered[$tamperOffset] = chr(ord($tampered[$tamperOffset]) ^ 1);
        $header = substr($original, 0, $headerBytes);
        $frame0 = substr($original, $headerBytes, $frameBytes);
        $frame1 = substr($original, $headerBytes + $frameBytes, $frameBytes);
        $frame2 = substr($original, $headerBytes + 2 * $frameBytes, -$footerBytes);
        $footer = substr($original, -$footerBytes);
        $reordered = $header.$frame1.$frame0.$frame2.$footer;
        $missing = $header.$frame0.$frame2.$footer;
        foreach ([$tampered, substr($original, 0, -1), substr($original, 0, -21), $original.'extra', $reordered, $missing] as $invalid) {
            Storage::disk('local')->put($path, $invalid);
            self::assertNull($service->openVerifiedDocument($path));
        }
    }

    public function test_authenticated_byte_ranges_return_only_requested_plaintext(): void
    {
        $bytes = '%PDF-1.4'.str_repeat('synthetic range fixture ', 100000);
        $path = (new PdfEncryptorService())->encryptAndStore(
            'capstones', UploadedFile::fake()->createWithContent('range.pdf', $bytes)
        );
        $document = (new PdfEncryptorService())->openForViewing($path);
        self::assertInstanceOf(\App\Services\ChunkedEncryptedFile::class, $document);

        $start = 1048576 - 10;
        $end = $start + 29;
        $request = \Illuminate\Http\Request::create('/pdf', 'GET', [], [], [], [
            'HTTP_RANGE' => "bytes={$start}-{$end}",
        ]);
        $response = $document->response($request, ['Content-Type' => 'application/pdf']);
        self::assertSame(206, $response->getStatusCode());
        self::assertSame("bytes {$start}-{$end}/".strlen($bytes), $response->headers->get('Content-Range'));

        ob_start();
        $response->sendContent();
        $actual = ob_get_clean();
        self::assertSame(substr($bytes, $start, $end - $start + 1), $actual);
    }

    public function test_corrupt_range_chunk_is_not_written_before_authentication(): void
    {
        $service = new PdfEncryptorService();
        $path = $service->encryptAndStore(
            'capstones', UploadedFile::fake()->createWithContent('range.pdf', str_repeat('private-range-bytes', 100000))
        );
        $ciphertext = Storage::disk('local')->get($path);
        $offset = strlen(\App\Services\ChunkedEncryptedFile::MAGIC)
            + \App\Services\ChunkedEncryptedFile::FILE_ID_BYTES + 100;
        $ciphertext[$offset] = chr(ord($ciphertext[$offset]) ^ 1);
        Storage::disk('local')->put($path, $ciphertext);

        $document = $service->openForViewing($path);
        self::assertInstanceOf(\App\Services\ChunkedEncryptedFile::class, $document);
        $response = $document->response(
            \Illuminate\Http\Request::create('/pdf', 'GET', [], [], [], ['HTTP_RANGE' => 'bytes=0-99']),
            ['Content-Type' => 'application/pdf'],
        );

        ob_start();
        try {
            $response->sendContent();
            self::fail('Corrupt range data must not be returned.');
        } catch (\RuntimeException $error) {
            self::assertStringContainsString('authentication failed', strtolower($error->getMessage()));
        } finally {
            $body = ob_get_clean();
        }
        self::assertSame('', $body);
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
