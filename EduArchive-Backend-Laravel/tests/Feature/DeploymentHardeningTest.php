<?php

namespace Tests\Feature;

use App\Models\DocumentUpload;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class DeploymentHardeningTest extends SecurityTestCase
{
    private function resource()
    {
        return $this->post('/api/v1/student/capstones/upload-resource',
            ['file' => UploadedFile::fake()->createWithContent('synthetic.txt', 'Synthetic research notes')],
            ['Accept' => 'application/json']);
    }

    public function test_student_update_returns_only_public_adviser_identity(): void
    {
        $owner = $this->user('student');
        $faculty = $this->user('faculty');
        $record = $this->capstone($owner);
        $this->asUser($owner);
        $adviser = $this->putJson('/api/v1/student/capstones/'.$record->id,
            ['adviser_id' => $faculty->id])->assertOk()->json('data.adviser');
        self::assertSame($faculty->id, $adviser['id']);
        self::assertSame($faculty->name, $adviser['name']);
        self::assertEqualsCanonicalizing(['id', 'name'], array_keys($adviser));
    }

    public function test_pending_count_includes_expired_allocations_and_rejection_removes_only_new_file(): void
    {
        $this->asUser($this->user('student'));
        config(['acadex.max_pending_uploads' => 1, 'acadex.min_free_storage_bytes' => 0]);
        $this->resource()->assertOk();
        $existing = Storage::disk('local')->allFiles();
        DocumentUpload::query()->update(['expires_at' => now()->subDay()]);
        $this->resource()->assertUnprocessable();
        self::assertSame(1, DocumentUpload::count());
        self::assertSame($existing, Storage::disk('local')->allFiles());
    }

    public function test_encrypted_byte_budget_rejects_without_leaving_a_file_or_reference(): void
    {
        $this->asUser($this->user('student'));
        config(['acadex.max_pending_upload_bytes' => 1, 'acadex.min_free_storage_bytes' => 0]);
        $this->resource()->assertUnprocessable();
        self::assertSame(0, DocumentUpload::count());
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_disk_reserve_rejects_before_creating_a_file(): void
    {
        $this->asUser($this->user('student'));
        config(['acadex.min_free_storage_bytes' => PHP_INT_MAX]);
        $this->resource()->assertUnprocessable();
        self::assertSame(0, DocumentUpload::count());
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_upload_rate_budget_is_shared_across_the_role_upload_routes(): void
    {
        $this->asUser($this->user('student'));
        config(['acadex.max_pending_uploads' => 100, 'acadex.min_free_storage_bytes' => 0]);
        for ($i = 0; $i < 30; $i++) $this->resource()->assertOk();
        $this->post('/api/v1/student/capstones/upload-imrad',
            ['file' => UploadedFile::fake()->createWithContent('invalid.pdf', 'invalid')],
            ['Accept' => 'application/json'])->assertStatus(429);
        self::assertSame(30, DocumentUpload::count());
    }
}
