<?php

namespace Tests\Feature;

use App\Jobs\ExtractUploadMetadataJob;
use App\Models\DocumentUpload;
use App\Services\PdfMetadataSampler;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;
use Tests\Support\MetadataPdfFixture;

class LargeMetadataAutofillTest extends SecurityTestCase
{
    public function test_all_uploader_roles_receive_metadata_from_a_large_pdf_sample(): void
    {
        Queue::fake([ExtractUploadMetadataJob::class]);
        $this->mock(\App\Services\PdfPreviewService::class)->shouldReceive('prepare')->times(3)->andReturn(false);
        $source = tempnam(sys_get_temp_dir(), 'acadex-large-meta-');
        $template = tempnam(sys_get_temp_dir(), 'acadex-small-meta-');
        MetadataPdfFixture::write($source, 21 * 1048576, 15);
        MetadataPdfFixture::write($template);
        config(['acadex.min_free_storage_bytes' => 0]);
        $sampler = new class($template) {
            public int $calls = 0;
            public function __construct(private string $template) {}
            public function create(UploadedFile $file): string {
                if ($file->getSize() <= 20971520) throw new \RuntimeException('Expected the large original.');
                $this->calls++;
                $path = tempnam(sys_get_temp_dir(), 'acadex-meta-copy-');
                copy($this->template, $path);
                return $path;
            }
        };
        $this->app->instance(PdfMetadataSampler::class, $sampler);
        try {
            $originalHash = hash_file('sha256', $source);
            foreach (['student', 'faculty', 'admin'] as $role) {
                $this->asUser($this->user($role));
                $response = $this->post('/api/v1/'.$role.'/capstones/upload', [
                    'pdf' => new UploadedFile($source, 'synthetic-large.pdf', 'application/pdf', null, true),
                ], ['Accept' => 'application/json'])->assertOk()
                    ->assertJsonPath('data.processing_status', 'queued');
                $id = $response->json('data.upload_id');
                Queue::assertPushed(ExtractUploadMetadataJob::class, fn($job) => $job->uploadId === $id);
                $this->app->call([new ExtractUploadMetadataJob($id), 'handle']);
                $this->getJson('/api/v1/uploads/'.$id.'/status')->assertOk()
                    ->assertJsonPath('data.processing_status', 'completed')
                    ->assertJsonPath('data.extraction_status', 'complete')
                    ->assertJsonPath('data.extraction_scope', 'first_12_pages')
                    ->assertJsonPath('data.extracted.title', 'SYNTHETIC CAMPUS ARCHIVE SYSTEM')
                    ->assertJsonPath('data.extracted.author', 'Alex Example, Jamie Sample')
                    ->assertJsonPath('data.extracted.year', 2026)
                    ->assertJsonPath('data.extracted.program', 'BSIT');
            }
            self::assertSame(3, $sampler->calls);
            self::assertSame($originalHash, hash_file('sha256', $source));
        } finally { @unlink($source); @unlink($template); }
    }

    public function test_sampler_failure_preserves_the_staged_original_and_reports_unavailable(): void
    {
        Queue::fake([ExtractUploadMetadataJob::class]);
        $this->mock(\App\Services\PdfPreviewService::class)->shouldReceive('prepare')->once()->andReturn(false);
        $source = tempnam(sys_get_temp_dir(), 'acadex-large-meta-');
        MetadataPdfFixture::write($source, 21 * 1048576);
        config(['acadex.min_free_storage_bytes' => 0]);
        $this->app->instance(PdfMetadataSampler::class, new class {
            public function create(UploadedFile $file): string { throw new \RuntimeException('Synthetic native failure'); }
        });
        $this->asUser($this->user('student'));
        try {
            $response = $this->post('/api/v1/student/capstones/upload', [
                'pdf' => new UploadedFile($source, 'synthetic-large.pdf', 'application/pdf', null, true),
            ], ['Accept' => 'application/json'])->assertOk()
                ->assertJsonPath('data.processing_status', 'queued');
            $id = $response->json('data.upload_id');
            Queue::assertPushed(ExtractUploadMetadataJob::class, fn($job) => $job->uploadId === $id);
            $this->app->call([new ExtractUploadMetadataJob($id), 'handle']);
            $this->getJson('/api/v1/uploads/'.$id.'/status')->assertOk()
                ->assertJsonPath('data.processing_status', 'completed')
                ->assertJsonPath('data.extraction_status', 'unavailable')
                ->assertJsonPath('data.extracted.title', null);
            $upload = DocumentUpload::findOrFail(substr($response->json('data.pdf_path'), 7));
            self::assertTrue(Storage::disk('local')->exists($upload->path));
        } finally { @unlink($source); }
    }
}
