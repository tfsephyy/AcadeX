<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\CitationEvent;
use App\Models\DocumentUpload;
use App\Models\UploadTransfer;
use App\Services\PdfEncryptorService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Queue;
use Illuminate\Support\Facades\Storage;
use Illuminate\Support\Str;
use Tests\SecurityTestCase;

class ResumableUploadsAndReferencesTest extends SecurityTestCase
{
    private function begin(string $bytes): string
    {
        $id = (string) Str::uuid();
        $this->putJson('/api/v1/uploads/transfers/'.$id, ['name' => 'synthetic.pdf', 'size' => strlen($bytes)])
            ->assertOk()->assertJsonPath('data.received_bytes', 0);
        return '/api/v1/uploads/transfers/'.$id;
    }

    private function chunk(string $base, int $offset, string $bytes)
    {
        return $this->post($base.'/chunks', ['offset' => $offset,
            'chunk' => UploadedFile::fake()->createWithContent('chunk.bin', $bytes)], ['Accept' => 'application/json']);
    }

    public function test_reload_resumes_acknowledged_chunks_and_finalization_dispatches_once(): void
    {
        Queue::fake();
        $owner = $this->user('student');
        $other = $this->user('student');
        $this->asUser($owner);
        $part = '%PDF-1.4'.str_repeat(' ', 2 * 1024 * 1024 - 8);
        $bytes = $part."\n%%EOF\n";
        $base = $this->begin($bytes);
        $this->chunk($base, 0, $part)->assertOk()->assertJsonPath('data.received_bytes', strlen($part));
        $this->postJson($base.'/complete')->assertConflict();
        $this->putJson($base, ['name' => 'synthetic.pdf', 'size' => strlen($bytes)])
            ->assertOk()->assertJsonPath('data.received_bytes', strlen($part));
        $this->chunk($base, 0, $part)->assertOk(); // lost acknowledgement replay
        $this->chunk($base, 0, str_repeat('x', strlen($part)))->assertConflict();
        self::assertCount(1, UploadTransfer::first()->chunks);
        $this->asUser($other);
        $this->putJson($base, ['name' => 'synthetic.pdf', 'size' => strlen($bytes)])->assertNotFound();
        $this->chunk($base, strlen($part), "\n%%EOF\n")->assertNotFound();
        $this->postJson($base.'/complete')->assertNotFound();
        $this->asUser($owner);
        $this->chunk($base, strlen($part), "\n%%EOF\n")->assertOk();
        $result = $this->postJson($base.'/complete')->assertOk()->json('data');
        $this->postJson($base.'/complete')->assertOk()->assertJsonPath('data.upload_id', $result['upload_id']);
        self::assertSame(1, DocumentUpload::count());
        $stored = DocumentUpload::first();
        self::assertSame($bytes, app(PdfEncryptorService::class)->decryptFromDisk($stored->path));
        self::assertSame([], UploadTransfer::first()->chunks);
        // Jobs are deliberately dispatched only after the outer transaction commits.
        // SecurityTestCase owns that outer transaction; verify the reference's queued state here.
        self::assertSame('queued', $stored->processing_status);
        self::assertSame(0, Capstone::count());
    }

    public function test_repeated_submission_returns_original_record_and_saved_reference_is_counted_once(): void
    {
        Queue::fake();
        $owner = $this->user('admin');
        $this->asUser($owner);
        $target = $this->capstone($owner, ['status' => 'approved', 'approval_status' => 'approved']);
        $bytes = "%PDF-1.4\n%%EOF";
        $base = $this->begin($bytes);
        $this->chunk($base, 0, $bytes)->assertOk();
        $reference = $this->postJson($base.'/complete')->assertOk()->json('data.pdf_path');
        $payload = ['publication_status' => 'unpublished', 'copyright_status' => 'unprotected',
            'title' => 'Synthetic saved reference', 'author' => 'Synthetic Author', 'pdf_path' => $reference,
            'references' => [$target->id, $target->id]];
        $record = $this->postJson('/api/v1/admin/capstones', $payload)->assertCreated()->json('data');
        $this->postJson('/api/v1/admin/capstones', $payload)->assertOk()->assertJsonPath('data.id', $record['id']);
        self::assertSame(2, Capstone::count());
        self::assertSame(1, DB::table('capstone_references')->count());
        self::assertSame(1, $target->referenceTotal());
        $this->putJson('/api/v1/admin/capstones/'.$record['id'], ['references' => [(string) $record['id'], (string) $target->id]])->assertOk();
        self::assertSame(1, DB::table('capstone_references')->count());
        $this->putJson('/api/v1/admin/capstones/'.$record['id'], ['references' => [$target->id, $target->id]])->assertOk();
        self::assertSame(1, $target->referenceTotal());
        $this->getJson('/api/v1/uploads/'.substr($reference, 7).'/status')->assertOk()->assertJsonPath('data.capstone_id', $record['id']);
    }

    public function test_only_successful_copy_events_and_saved_relationships_contribute_to_totals(): void
    {
        $owner = $this->user('admin');
        $this->asUser($owner);
        $target = $this->capstone($owner, ['status' => 'approved', 'approval_status' => 'approved']);
        CitationEvent::create(['capstone_id' => $target->id, 'user_id' => $owner->id, 'format' => 'apa', 'action' => 'generate']);
        $this->getJson('/api/v1/capstones/'.$target->id)->assertOk()->assertJsonPath('data.reference_count', 0);
        foreach (['generate', 'download'] as $action) {
            $this->postJson('/api/v1/capstones/'.$target->id.'/citation', ['format' => 'apa', 'action' => $action])
                ->assertOk()->assertJsonPath('data.reference_count', 0);
        }
        $analytics = app(\App\Services\Chatbot\ChatbotAnalyticsService::class);
        self::assertNull($analytics->getMostReferencedCapstone());
        $this->postJson('/api/v1/capstones/'.$target->id.'/citation', ['format' => 'ieee'])->assertUnprocessable();
        $this->postJson('/api/v1/capstones/'.$target->id.'/citation', ['format' => 'apa', 'action' => 'copy'])->assertUnprocessable();
        $copy = ['format' => 'apa', 'action' => 'copy', 'event_key' => (string) Str::uuid()];
        $this->postJson('/api/v1/capstones/'.$target->id.'/citation', $copy)->assertOk()->assertJsonPath('data.reference_count', 1);
        $this->postJson('/api/v1/capstones/'.$target->id.'/citation', $copy)->assertOk()->assertJsonPath('data.reference_count', 1);
        self::assertSame(1, $analytics->getMostReferencedCapstone()['count']);
        $source = $this->capstone($owner);
        $source->referencedCapstones()->sync([$target->id]);
        $source->referencedCapstones()->sync([$target->id]);
        $this->getJson('/api/v1/capstones/'.$target->id)->assertOk()->assertJsonPath('data.reference_count', 2);
        self::assertSame(2, $analytics->getMostReferencedCapstone()['count']);
        $this->postJson('/api/v1/capstones/'.$source->id.'/citation', $copy)->assertConflict();
        self::assertSame(0, $source->referenceTotal());
    }

    public function test_rankings_exclude_zero_counts_for_admin_and_faculty(): void
    {
        $admin = $this->user('admin');
        $faculty = $this->user('faculty');
        $this->asUser($admin);
        $target = $this->capstone($admin, ['status' => 'approved', 'approval_status' => 'approved', 'publication_status' => 'published', 'adviser_id' => $faculty->id]);
        $zero = $this->capstone($admin, ['status' => 'approved', 'approval_status' => 'approved', 'publication_status' => 'published', 'adviser_id' => $faculty->id]);
        $analytics = app(\App\Services\Chatbot\ChatbotAnalyticsService::class);
        self::assertCount(0, $analytics->mostViewed());
        $this->getJson('/api/v1/admin/dashboard/most-viewed')->assertOk()->assertJsonCount(0, 'data');
        $this->getJson('/api/v1/admin/dashboard/most-cited')->assertOk()->assertJsonCount(0, 'data');
        $this->asUser($faculty);
        $this->getJson('/api/v1/faculty/dashboard')->assertOk()->assertJsonCount(0, 'data.assigned.most_viewed')->assertJsonCount(0, 'data.assigned.most_cited');
        DB::table('capstone_views')->insert(['capstone_id' => $target->id, 'user_id' => $faculty->id, 'created_at' => now(), 'updated_at' => now()]);
        $target->update(['view_count' => 1]);
        self::assertCount(1, $analytics->mostViewed());
        $zero->referencedCapstones()->sync([$target->id]);
        $this->asUser($admin);
        $this->getJson('/api/v1/admin/dashboard/most-viewed')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.id', $target->id);
        $this->getJson('/api/v1/admin/dashboard/most-cited')->assertOk()->assertJsonCount(1, 'data')->assertJsonPath('data.0.reference_count', 1);
        $this->asUser($faculty);
        $this->getJson('/api/v1/faculty/dashboard')->assertOk()->assertJsonCount(1, 'data.assigned.most_viewed')->assertJsonCount(1, 'data.assigned.most_cited')->assertJsonPath('data.assigned.most_cited.0.reference_count', 1);
    }

    public function test_quotas_expiry_cancellation_and_pruning_apply_to_transfers_only(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);
        config(['acadex.max_pending_uploads' => 1]);
        $base = $this->begin('%PDF');
        $this->putJson('/api/v1/uploads/transfers/'.Str::uuid(), ['name' => 'synthetic.pdf', 'size' => 4])->assertUnprocessable();
        $this->chunk($base, 1, 'bad')->assertConflict();
        $this->chunk($base, 0, '%PDF')->assertOk();
        $this->deleteJson($base)->assertOk();
        self::assertSame([], UploadTransfer::first()->chunks);
        $this->putJson($base, ['name' => 'synthetic.pdf', 'size' => 4])->assertGone();
        $this->artisan('acadex:prune-upload-transfers')->assertSuccessful();
        self::assertSame(0, UploadTransfer::count());
        self::assertSame(0, DocumentUpload::count());
        self::assertSame([], Storage::disk('local')->allFiles());
    }

    public function test_committed_transfer_queues_once_and_worker_completes_without_a_browser(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);
        // Commit only this test's synthetic data in the guarded disposable DB.
        // Real after-commit queue delivery cannot be observed inside the base
        // class's always-rolled-back outer transaction.
        DB::commit();
        $this->mock(\App\Services\PdfPreviewService::class)->shouldNotReceive('prepare');
        $this->mock(\App\Services\PdfExtractorService::class)->shouldReceive('extractPathWithSource')->once()->andReturn([
            'metadata' => ['title' => 'Synthetic recovered extraction', 'author' => 'Synthetic Author'],
            'source' => 'Synthetic recovered extraction by Synthetic Author', 'scope' => 'full_document',
        ]);
        config(['queue.default' => 'database']);
        try {
            $bytes = "%PDF-1.4\n%%EOF";
            $base = $this->begin($bytes);
            $this->chunk($base, 0, $bytes)->assertOk();
            $id = $this->postJson($base.'/complete')->assertOk()->json('data.upload_id');
            $this->postJson($base.'/complete')->assertOk()->assertJsonPath('data.upload_id', $id);
            self::assertSame(1, DB::table('jobs')->count());
            $this->getJson('/api/v1/uploads/'.$id.'/status')->assertOk()->assertJsonPath('data.processing_status', 'queued');
            // A queue worker owns all extraction; no page/status request runs it.
            $this->artisan('queue:work', ['connection' => 'database', '--once' => true, '--queue' => 'default', '--tries' => 1])->assertSuccessful();
            self::assertSame(0, DB::table('jobs')->count());
            self::assertSame(0, DB::table('failed_jobs')->count());
            $this->getJson('/api/v1/uploads/'.$id.'/status')->assertOk()
                ->assertJsonPath('data.processing_status', 'completed')
                ->assertJsonPath('data.extracted.title', 'Synthetic recovered extraction');
            $this->postJson($base.'/complete')->assertOk()->assertJsonPath('data.upload_id', $id);
            self::assertSame(0, DB::table('jobs')->count());
            self::assertSame(1, DocumentUpload::where('user_id', $owner->id)->count());
        } finally {
            $owner->delete();
            DB::beginTransaction(); // Restore the base class's cleanup boundary.
        }
    }

    public function test_failed_finalization_rolls_back_staging_and_retry_does_not_leave_a_second_file(): void
    {
        Queue::fake();
        $this->asUser($this->user('student'));
        $bytes = "%PDF-1.4\n%%EOF";
        $base = $this->begin($bytes);
        $this->chunk($base, 0, $bytes)->assertOk();
        UploadTransfer::updating(function (UploadTransfer $transfer) {
            if ($transfer->isDirty('upload_id')) throw new \RuntimeException('Synthetic database failure after staging.');
        });
        try {
            $this->postJson($base.'/complete')->assertStatus(500);
        } finally {
            UploadTransfer::getEventDispatcher()->forget('eloquent.updating: '.UploadTransfer::class);
        }
        self::assertSame(0, DocumentUpload::count());
        self::assertCount(1, Storage::disk('local')->allFiles()); // confirmed encrypted chunk only
        self::assertNull(UploadTransfer::first()->upload_id);
        $this->postJson($base.'/complete')->assertOk();
        self::assertSame(1, DocumentUpload::count());
        self::assertCount(1, Storage::disk('local')->allFiles()); // final encrypted PDF only
    }
}
