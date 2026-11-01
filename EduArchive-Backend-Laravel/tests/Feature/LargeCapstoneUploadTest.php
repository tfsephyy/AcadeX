<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\DocumentUpload;
use App\Services\PdfEncryptorService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class LargeCapstoneUploadTest extends SecurityTestCase
{
    /** Valid small PDF padded with comments; no student material is used. */
    private function pdf(int $size): UploadedFile
    {
        $path = tempnam(sys_get_temp_dir(), 'acadex-synthetic-');
        $header = "%PDF-1.4\n1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n2 0 obj\n<< /Type /Pages /Kids [] /Count 0 >>\nendobj\n";
        $stream = fopen($path, 'w+b');
        fwrite($stream, $header);
        $remaining = $size - strlen($header) - 6;
        $padding = '%'.str_repeat('x', 1022)."\n";
        while ($remaining > 0) {
            $part = substr(str_repeat($padding, 1024), 0, min($remaining, 1048576));
            fwrite($stream, $part);
            $remaining -= strlen($part);
        }
        fwrite($stream, "\n%%EOF");
        fclose($stream);
        return new UploadedFile($path, 'synthetic-capstone.pdf', 'application/pdf', null, true);
    }

    public function test_100_mib_capstone_upload_submit_and_authorized_streamed_retrieval(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);
        config(['acadex.min_free_storage_bytes' => 0]);
        $file = $this->pdf(100 * 1024 * 1024);
        try {
            $expectedHash = hash_file('sha256', $file->getPathname());
            $upload = $this->post('/api/v1/student/capstones/upload', ['pdf' => $file], ['Accept' => 'application/json'])
                ->assertOk()->assertJsonPath('data.extraction_status', 'manual_required');
            $record = $this->postJson('/api/v1/student/capstones', [
                'title' => 'Synthetic large '.bin2hex(random_bytes(5)), 'author' => 'Synthetic',
                'pdf_path' => $upload->json('data.pdf_path'),
            ])->assertCreated()->json('data');
            $stored = Capstone::withoutGlobalScopes()->findOrFail($record['id']);
            self::assertNull($stored->pdf_text);
            $response = $this->get('/api/v1/capstones/'.$record['id'].'/pdf')->assertOk();
            $response->assertHeader('Content-Length', (string) (100 * 1024 * 1024));
            $hash = hash_init('sha256');
            ob_start(static function ($chunk) use ($hash) { hash_update($hash, $chunk); return ''; }, 1048576);
            try { $response->baseResponse->sendContent(); } finally { ob_end_clean(); }
            self::assertSame($expectedHash, hash_final($hash));
            $this->asUser($this->user('student'));
            $this->getJson('/api/v1/capstones/'.$record['id'].'/pdf')->assertNotFound();
        } finally { @unlink($file->getPathname()); }
    }

    public function test_admin_and_faculty_can_stage_large_pdfs_without_extraction(): void
    {
        config(['acadex.min_free_storage_bytes' => 0]);
        $file = $this->pdf(21 * 1024 * 1024);
        try {
            foreach (['admin', 'faculty'] as $role) {
                $this->asUser($this->user($role));
                $this->post('/api/v1/'.$role.'/capstones/upload', ['pdf' => $file], ['Accept' => 'application/json'])
                    ->assertOk()->assertJsonPath('data.extraction_status', 'manual_required')
                    ->assertJsonPath('data.extracted.title', null);
            }
        } finally { @unlink($file->getPathname()); }
    }

    public function test_exact_128_mib_is_accepted_and_one_byte_over_is_rejected_without_new_storage(): void
    {
        $this->asUser($this->user('student'));
        config(['acadex.min_free_storage_bytes' => 0]);
        $file = $this->pdf(134217728);
        try {
            $this->post('/api/v1/student/capstones/upload', ['pdf' => $file], ['Accept' => 'application/json'])->assertOk();
            self::assertSame(1, DocumentUpload::count());
            $existing = Storage::disk('local')->allFiles();
            file_put_contents($file->getPathname(), 'x', FILE_APPEND);
            clearstatcache(true, $file->getPathname());
            $this->post('/api/v1/student/capstones/upload', ['pdf' => $file], ['Accept' => 'application/json'])->assertStatus(413);
            self::assertSame(1, DocumentUpload::count());
            self::assertSame($existing, Storage::disk('local')->allFiles());
        } finally { @unlink($file->getPathname()); }
    }

    public function test_extraction_failure_does_not_prevent_secure_upload(): void
    {
        $this->asUser($this->user('student'));
        config(['acadex.min_free_storage_bytes' => 0]);
        // A PDF header alone passes MIME validation but cannot be parsed/OCRed.
        $file = UploadedFile::fake()->createWithContent('unreadable.pdf', "%PDF-1.4\nnot a valid PDF");
        $response = $this->post('/api/v1/student/capstones/upload', ['pdf' => $file], ['Accept' => 'application/json'])->assertOk();
        self::assertSame(1, DocumentUpload::count());
        self::assertStringStartsWith('upload:', $response->json('data.pdf_path'));
        self::assertSame('%PDF-1.4' . "\nnot a valid PDF", app(PdfEncryptorService::class)->decryptFromDisk(DocumentUpload::first()->path));
    }
}
