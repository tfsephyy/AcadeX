<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\CapstoneResource;
use App\Models\DocumentUpload;
use App\Models\UploadTransfer;
use App\Services\PdfEncryptorService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\SecurityTestCase;

class StagedUploadQuotaAndPruneTest extends SecurityTestCase
{
    private function uploadResource(string $content = 'synthetic test content')
    {
        return $this->post('/api/v1/student/capstones/upload-resource',
            ['file' => UploadedFile::fake()->createWithContent('synthetic.txt', $content)],
            ['Accept' => 'application/json']);
    }

    private function beginTransfer(string $bytes, ?string $transferId = null): string
    {
        $id = $transferId ?? (string) Str::uuid();
        $this->putJson('/api/v1/uploads/transfers/'.$id, ['name' => 'synthetic.pdf', 'size' => strlen($bytes)])
            ->assertOk()->assertJsonPath('data.received_bytes', 0);
        return $id;
    }

    private function chunkTransfer(string $id, int $offset, string $bytes)
    {
        return $this->post('/api/v1/uploads/transfers/'.$id.'/chunks', [
            'offset' => $offset,
            'chunk' => UploadedFile::fake()->createWithContent('chunk.bin', $bytes)
        ], ['Accept' => 'application/json']);
    }

    public function test_expired_staged_upload_does_not_count_toward_quota_in_stage_and_start(): void
    {
        $user = $this->user('student');
        $this->asUser($user);
        config(['acadex.max_pending_uploads' => 1, 'acadex.min_free_storage_bytes' => 0]);

        $this->uploadResource()->assertOk();
        self::assertSame(1, DocumentUpload::where('user_id', $user->id)->count());

        // Expire the staged upload
        DocumentUpload::where('user_id', $user->id)->update(['expires_at' => now()->subHour()]);

        // Stage another upload: should succeed because the expired upload is ignored
        $this->uploadResource()->assertOk();
        self::assertSame(2, DocumentUpload::where('user_id', $user->id)->count());

        // Expire all staged uploads to verify start() also ignores expired uploads
        DocumentUpload::where('user_id', $user->id)->update(['expires_at' => now()->subHour()]);

        // Test start() also ignores the expired upload
        $transferId = (string) Str::uuid();
        $this->putJson('/api/v1/uploads/transfers/'.$transferId, [
            'name' => 'test.pdf',
            'size' => 1024,
        ])->assertOk();
    }

    public function test_unexpired_staged_uploads_still_count_toward_quota_with_actionable_message(): void
    {
        $user = $this->user('student');
        $this->asUser($user);
        config(['acadex.max_pending_uploads' => 1, 'acadex.min_free_storage_bytes' => 0]);

        $this->uploadResource()->assertOk();

        // Second unexpired upload should fail with 422 and actionable message
        $response = $this->uploadResource();
        $response->assertStatus(422);
        $message = $response->json('message') ?? $response->json('errors.documents.0');
        self::assertStringContainsString('unsubmitted upload', $message);
        self::assertStringContainsString('Submit or discard', $message);
        self::assertStringContainsString('24 hours', $message);
    }

    public function test_delete_uploads_endpoint_owner_can_discard_unsubmitted_upload(): void
    {
        $user = $this->user('student');
        $this->asUser($user);
        config(['acadex.max_pending_uploads' => 1, 'acadex.min_free_storage_bytes' => 0]);

        $res = $this->uploadResource()->assertOk();
        $reference = $res->json('data.file_path');
        self::assertStringStartsWith('upload:', $reference);
        $uploadId = substr($reference, 7);

        $upload = DocumentUpload::findOrFail($uploadId);
        self::assertTrue(Storage::disk('local')->exists($upload->path));

        // Discard
        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertOk();

        self::assertNull(DocumentUpload::find($uploadId));
        self::assertFalse(Storage::disk('local')->exists($upload->path));

        // Quota is freed: next upload succeeds
        $this->uploadResource()->assertOk();
    }

    public function test_delete_uploads_endpoint_other_user_gets_404(): void
    {
        $owner = $this->user('student');
        $other = $this->user('student');

        $this->asUser($owner);
        $res = $this->uploadResource()->assertOk();
        $uploadId = substr($res->json('data.file_path'), 7);

        $this->asUser($other);
        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertNotFound();
    }

    public function test_delete_uploads_endpoint_submitted_upload_returns_409(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);

        $res = $this->uploadResource()->assertOk();
        $uploadId = substr($res->json('data.file_path'), 7);

        $capstone = $this->capstone($owner);
        DocumentUpload::whereKey($uploadId)->update(['capstone_id' => $capstone->id]);

        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertStatus(409);
    }

    public function test_delete_uploads_endpoint_recent_processing_returns_409(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);

        $res = $this->uploadResource()->assertOk();
        $uploadId = substr($res->json('data.file_path'), 7);

        DocumentUpload::whereKey($uploadId)->update([
            'processing_status' => DocumentUpload::STATUS_PROCESSING,
            'processing_started_at' => now()->subMinutes(5),
        ]);

        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertStatus(409);
    }

    public function test_delete_uploads_endpoint_repeat_call_returns_404(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);

        $res = $this->uploadResource()->assertOk();
        $uploadId = substr($res->json('data.file_path'), 7);

        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertOk();
        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertNotFound();
    }

    public function test_discard_removes_transfer_chunks_and_cascaded_transfer_row(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);

        $res = $this->uploadResource()->assertOk();
        $uploadId = substr($res->json('data.file_path'), 7);

        $chunkPath = 'transfer-chunks/synthetic_chunk.bin';
        Storage::disk('local')->put($chunkPath, 'chunk content');

        $transfer = UploadTransfer::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'original_name' => 'test.pdf',
            'size' => 1024,
            'received_bytes' => 1024,
            'chunks' => [['path' => $chunkPath, 'offset' => 0, 'hash' => 'fake', 'size' => 1024]],
            'upload_id' => $uploadId,
            'expires_at' => now()->addHour(),
        ]);

        self::assertTrue(Storage::disk('local')->exists($chunkPath));

        $this->deleteJson('/api/v1/uploads/'.$uploadId)->assertOk();

        self::assertNull(UploadTransfer::find($transfer->id));
        self::assertFalse(Storage::disk('local')->exists($chunkPath));
    }

    public function test_prune_staged_uploads_command(): void
    {
        $owner = $this->user('student');

        // 1. Expired unclaimed upload -> should be pruned
        $file1 = 'capstones/prune1.enc';
        Storage::disk('local')->put($file1, 'data1');
        $upload1 = DocumentUpload::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'purpose' => 'pdf',
            'path' => $file1,
            'expires_at' => now()->subHour(),
            'processing_status' => DocumentUpload::STATUS_COMPLETED,
        ]);

        // 2. Unexpired unclaimed upload -> should be kept
        $file2 = 'capstones/keep2.enc';
        Storage::disk('local')->put($file2, 'data2');
        $upload2 = DocumentUpload::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'purpose' => 'pdf',
            'path' => $file2,
            'expires_at' => now()->addHour(),
            'processing_status' => DocumentUpload::STATUS_COMPLETED,
        ]);

        // 3. Claimed upload -> should be kept even if expired
        $file3 = 'capstones/keep3.enc';
        Storage::disk('local')->put($file3, 'data3');
        $capstone = $this->capstone($owner, ['pdf_path' => $file3]);
        $upload3 = DocumentUpload::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'purpose' => 'pdf',
            'path' => $file3,
            'capstone_id' => $capstone->id,
            'expires_at' => now()->subHour(),
            'processing_status' => DocumentUpload::STATUS_COMPLETED,
        ]);

        // 4. Expired but recent processing -> should be kept
        $file4 = 'capstones/keep4.enc';
        Storage::disk('local')->put($file4, 'data4');
        $upload4 = DocumentUpload::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'purpose' => 'pdf',
            'path' => $file4,
            'expires_at' => now()->subHour(),
            'processing_status' => DocumentUpload::STATUS_PROCESSING,
            'processing_started_at' => now()->subMinutes(5),
        ]);

        // 5. Expired unclaimed upload whose path is referenced by a capstone -> should be skipped with warning
        $file5 = 'capstones/referenced.enc';
        Storage::disk('local')->put($file5, 'data5');
        $this->capstone($owner, ['imrad_path' => $file5]);
        $upload5 = DocumentUpload::create([
            'id' => (string) Str::uuid(),
            'user_id' => $owner->id,
            'purpose' => 'imrad',
            'path' => $file5,
            'expires_at' => now()->subHour(),
            'processing_status' => DocumentUpload::STATUS_COMPLETED,
        ]);

        $this->artisan('acadex:prune-staged-uploads')->assertSuccessful();

        // Assert 1 was pruned
        self::assertNull(DocumentUpload::find($upload1->id));
        self::assertFalse(Storage::disk('local')->exists($file1));

        // Assert 2 was kept
        self::assertNotNull(DocumentUpload::find($upload2->id));
        self::assertTrue(Storage::disk('local')->exists($file2));

        // Assert 3 was kept
        self::assertNotNull(DocumentUpload::find($upload3->id));
        self::assertTrue(Storage::disk('local')->exists($file3));

        // Assert 4 was kept
        self::assertNotNull(DocumentUpload::find($upload4->id));
        self::assertTrue(Storage::disk('local')->exists($file4));

        // Assert 5 was kept
        self::assertNotNull(DocumentUpload::find($upload5->id));
        self::assertTrue(Storage::disk('local')->exists($file5));
    }

    public function test_finalize_failing_on_quota_does_not_leave_reservation(): void
    {
        Queue::fake();
        $owner = $this->user('student');
        $this->asUser($owner);

        // Quota = 4000 bytes
        config(['acadex.max_pending_upload_bytes' => 4000, 'acadex.min_free_storage_bytes' => 0]);

        // Staged upload uses 1500 bytes.
        // Transfer size is 1200 bytes. (1500 + 1200 = 2700 <= 4000, so start() succeeds)
        $this->uploadResource(str_repeat('A', 1500))->assertOk();
        $part = '%PDF-1.4'.str_repeat(' ', 1200 - 15)."\n%%EOF\n";
        $transferId = $this->beginTransfer($part);
        $this->chunkTransfer($transferId, 0, $part)->assertOk();

        // Before complete(), stage ANOTHER upload that pushes total staged bytes above quota:
        // Add 1500 bytes -> staged is now ~3000 bytes.
        $this->uploadResource(str_repeat('B', 1500))->assertOk();

        // Now complete() the transfer (1200 bytes). ~3000 + 1200 = 4200 > 4000!
        // complete() calls CapstoneController::upload(), which calls stage(), which throws ValidationException!
        $this->postJson('/api/v1/uploads/transfers/'.$transferId.'/complete')->assertStatus(422);

        // The failed transfer must be expired so its reservation is released
        $transfer = UploadTransfer::findOrFail($transferId);
        self::assertTrue($transfer->expires_at->isPast() || $transfer->expires_at->isCurrentSecond());

        // Now if we start a new transfer with 600 bytes:
        // Staged bytes ~ 3000. 3000 + 600 = 3600 <= 4000.
        // If the old transfer (1200) was still counted, total would be 3000 + 1200 + 600 = 4800 > 4000!
        $newTransferId = (string) Str::uuid();
        $this->putJson('/api/v1/uploads/transfers/'.$newTransferId, [
            'name' => 'new.pdf',
            'size' => 600,
        ])->assertOk();
    }

    public function test_regression_quota_upload_discard_sequence(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);

        // Quota: 2000 bytes
        config(['acadex.max_pending_upload_bytes' => 2000, 'acadex.min_free_storage_bytes' => 0]);

        // Upload ~1200 bytes
        $res1 = $this->uploadResource(str_repeat('X', 1200))->assertOk();
        $id1 = substr($res1->json('data.file_path'), 7);

        // Discard
        $this->deleteJson('/api/v1/uploads/'.$id1)->assertOk();

        // Upload ~1200 bytes again
        $res2 = $this->uploadResource(str_repeat('Y', 1200))->assertOk();
        $id2 = substr($res2->json('data.file_path'), 7);

        // Discard
        $this->deleteJson('/api/v1/uploads/'.$id2)->assertOk();

        // Upload ~1200 bytes a third time: succeeds because quota was freed each time
        $this->uploadResource(str_repeat('Z', 1200))->assertOk();
    }
}
