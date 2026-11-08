<?php

namespace Tests\Feature;

use App\Jobs\ExtractUploadMetadataJob;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Queue;
use Tests\SecurityTestCase;
use Tests\Support\MetadataPdfFixture;

class PdfOnlyMetadataTest extends SecurityTestCase
{
    public function test_cv_contacts_from_tail_pages_are_saved_for_review_without_raw_source_or_external_calls(): void
    {
        Queue::fake();
        Http::preventStrayRequests();
        Http::fake();
        config(['acadex.min_free_storage_bytes' => 0]);
        $path = tempnam(sys_get_temp_dir(), 'acadex-cv-tail-');
        try {
            MetadataPdfFixture::write($path, 0, 80, 'Alex Example', [
                79 => ['CURRICULUM VITAE', 'Alex Example', 'Email: alex@example.invalid', 'Contact: 0912-345-6789'],
                80 => ['CURRICULUM VITAE', 'Jamie Sample', 'Email: jamie@example.invalid', 'Contact: +639987654321'],
            ]);
            $this->asUser($this->user('student'));
            $upload = $this->post('/api/v1/student/capstones/upload', [
                'pdf' => new UploadedFile($path, 'synthetic-cv.pdf', 'application/pdf', null, true),
            ], ['Accept' => 'application/json'])->assertOk()->json('data');
            $this->app->call([new ExtractUploadMetadataJob($upload['upload_id']), 'handle']);
            $data = $this->getJson('/api/v1/uploads/'.$upload['upload_id'].'/status')->assertOk()
                ->assertJsonPath('data.extracted.author_details.0.email', 'alex@example.invalid')
                ->assertJsonPath('data.extracted.author_details.0.contact', '09123456789')
                ->assertJsonPath('data.extracted.author_details.1.email', 'jamie@example.invalid')
                ->assertJsonPath('data.extracted.author_details.1.contact', '+639987654321')->json('data');
            self::assertArrayNotHasKey('source', $data);
            self::assertArrayNotHasKey('raw_source', $data);
            Http::assertNothingSent();
        } finally { unlink($path); }
    }

    public function test_queued_metadata_uses_pdf_fields_without_model_calls_or_viewing_preview_work(): void
    {
        Queue::fake();
        Http::preventStrayRequests();
        Http::fake();
        // Even stale private model configuration cannot enable generation.
        config(['acadex.ollama_url' => 'https://model.example.invalid', 'acadex.ollama_model' => 'synthetic',
            'acadex.min_free_storage_bytes' => 0]);
        $this->mock(\App\Services\PdfPreviewService::class)->shouldNotReceive('prepare');
        $path = tempnam(sys_get_temp_dir(), 'acadex-pdf-only-');
        try {
            MetadataPdfFixture::write($path, 0, 3, 'Alex Example');
            $this->asUser($this->user('student'));
            $upload = $this->post('/api/v1/student/capstones/upload', [
                'pdf' => new UploadedFile($path, 'synthetic.pdf', 'application/pdf', null, true),
            ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.processing_status', 'queued')->json('data');
            $job = new ExtractUploadMetadataJob($upload['upload_id']);
            $this->app->call([$job, 'handle']);
            $this->getJson('/api/v1/uploads/'.$upload['upload_id'].'/status')->assertOk()
                ->assertJsonPath('data.processing_status', 'completed')
                ->assertJsonPath('data.extracted.title', 'SYNTHETIC CAMPUS ARCHIVE SYSTEM')
                ->assertJsonPath('data.extracted.adviser_name', 'Alex Example')
                ->assertJsonPath('data.extracted.author', 'Alex Example, Jamie Sample')
                ->assertJsonPath('data.extracted.year', 2026)
                ->assertJsonPath('data.extracted.keywords', ['document management', 'research', 'capstone project', 'capstone']);
            Http::assertNothingSent();
            $this->app->call([$job, 'handle']); // Repeated queue delivery is harmless.
            Http::assertNothingSent();
        } finally { unlink($path); }
    }

    public function test_actual_database_worker_extracts_a_synthetic_pdf_and_saves_review_fields(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);
        \Illuminate\Support\Facades\DB::commit();
        config(['queue.default' => 'database', 'acadex.min_free_storage_bytes' => 0]);
        $this->mock(\App\Services\PdfPreviewService::class)->shouldNotReceive('prepare');
        Http::fake();
        $path = tempnam(sys_get_temp_dir(), 'acadex-real-worker-');
        try {
            MetadataPdfFixture::write($path, 0, 150, 'Alex Example');
            $upload = $this->post('/api/v1/student/capstones/upload', [
                'pdf' => new UploadedFile($path, 'synthetic.pdf', 'application/pdf', null, true),
            ], ['Accept' => 'application/json'])->assertOk()->assertJsonPath('data.processing_status', 'queued')->json('data');
            $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--queue' => 'default', '--tries' => 1])->assertSuccessful();
            $this->getJson('/api/v1/uploads/'.$upload['upload_id'].'/status')->assertOk()
                ->assertJsonPath('data.processing_status', 'completed')
                ->assertJsonPath('data.extraction_scope', 'first_12_pages')
                ->assertJsonPath('data.extracted.title', 'SYNTHETIC CAMPUS ARCHIVE SYSTEM')
                ->assertJsonPath('data.extracted.adviser_name', 'Alex Example');
            self::assertSame(0, \Illuminate\Support\Facades\DB::table('jobs')->count());
            self::assertSame(0, \Illuminate\Support\Facades\DB::table('failed_jobs')->count());
            Http::assertNothingSent();
        } finally {
            unlink($path);
            $owner->delete();
            \Illuminate\Support\Facades\DB::beginTransaction();
        }
    }
}
