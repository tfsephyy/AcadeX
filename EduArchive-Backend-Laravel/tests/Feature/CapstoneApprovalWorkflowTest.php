<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Services\PdfEncryptorService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class CapstoneApprovalWorkflowTest extends SecurityTestCase
{
    private function syntheticPdf(): string
    {
        $text = str_repeat('Synthetic capstone approval workflow content. ', 5);
        $stream = 'BT /F1 12 Tf 50 700 Td ('.$text.') Tj ET';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>', '<< /Type /Pages /Kids [3 0 R] /Count 1 >>',
            '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 4 0 R >> >> /Contents 5 0 R >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>', '<< /Length '.strlen($stream).">>\nstream\n".$stream."\nendstream"];
        $pdf = "%PDF-1.4\n"; $offsets = [0];
        foreach ($objects as $i => $object) { $offsets[] = strlen($pdf); $pdf .= ($i + 1)." 0 obj\n".$object."\nendobj\n"; }
        $xref = strlen($pdf); $pdf .= "xref\n0 6\n0000000000 65535 f \n";
        foreach (array_slice($offsets, 1) as $offset) $pdf .= sprintf("%010d 00000 n \n", $offset);
        return $pdf."trailer\n<< /Size 6 /Root 1 0 R >>\nstartxref\n".$xref."\n%%EOF";
    }

    private function submitAsStudent(): array
    {
        $this->asUser($this->user('student'));
        $upload = $this->post('/api/v1/student/capstones/upload', [
            'pdf' => UploadedFile::fake()->createWithContent('synthetic.pdf', $this->syntheticPdf()),
            'skip_extraction' => 1,
        ], ['Accept' => 'application/json'])->assertOk()->json('data');

        $record = $this->postJson('/api/v1/student/capstones', [
            'title' => 'Synthetic workflow '.bin2hex(random_bytes(5)),
            'author' => 'Synthetic Author',
            'year' => 2026,
            'pdf_path' => $upload['pdf_path'],
            'pdf_original_name' => $upload['pdf_original_name'],
        ])->assertCreated()->json('data');

        return $record;
    }

    public function test_student_submission_is_pending_and_appears_in_library_only_after_approval(): void
    {
        $record = $this->submitAsStudent();
        $stored = Capstone::withoutGlobalScopes()->findOrFail($record['id']);

        self::assertSame('pending', $stored->status);
        self::assertSame('pending', $stored->approval_status);
        self::assertSame('unpublished', $stored->publication_status);

        // Pending submissions are not in the approved library, for any reader.
        $this->asUser($this->user('student'));
        $this->getJson('/api/v1/published')->assertOk()
            ->assertJsonMissing(['id' => $stored->id]);
        $this->getJson('/api/v1/student/capstones/all')->assertOk()
            ->assertJsonMissing(['id' => $stored->id]);

        $admin = $this->user('admin');
        $this->asUser($admin);
        $this->getJson('/api/v1/admin/capstones/pending')->assertOk()
            ->assertJsonPath('data.data.0.id', $stored->id);

        $this->postJson('/api/v1/admin/capstones/'.$stored->id.'/approve')->assertOk();
        $stored->refresh();
        self::assertSame('approved', $stored->approval_status);
        self::assertSame('unpublished', $stored->publication_status);

        // Approval alone puts the record in the platform library. External
        // publication remains a separate administrator decision.
        $this->getJson('/api/v1/published')->assertOk()
            ->assertJsonFragment(['id' => $stored->id]);
        $this->asUser($this->user('student'));
        $this->getJson('/api/v1/student/capstones/all')->assertOk()
            ->assertJsonFragment(['id' => $stored->id]);
    }

    public function test_legacy_status_values_are_backfilled_without_reapproving_pending_work(): void
    {
        $owner = $this->user('student');
        $legacyApproved = $this->capstone($owner, [
            'status' => 'approved', 'approval_status' => 'pending',
            'publication_status' => 'unpublished',
        ]);
        $legacyRejected = $this->capstone($owner, [
            'status' => 'rejected', 'approval_status' => 'pending',
            'publication_status' => 'unpublished', 'is_archived' => true,
        ]);
        $genuinelyPending = $this->capstone($owner, [
            'status' => 'pending', 'approval_status' => 'pending',
            'publication_status' => 'unpublished',
        ]);

        $migration = require database_path('migrations/2026_10_19_000001_backfill_capstone_approval_status.php');
        $migration->up();

        self::assertSame('approved', $legacyApproved->fresh()->approval_status);
        self::assertSame('rejected', $legacyRejected->fresh()->approval_status);
        self::assertSame('pending', $genuinelyPending->fresh()->approval_status);
    }

    public function test_restoring_a_rejected_submission_returns_it_to_review_instead_of_bypassing_approval(): void
    {        $owner = $this->user('student');
        $admin = $this->user('admin');
        $record = $this->capstone($owner, [
            'status' => 'rejected',
            'approval_status' => 'rejected',
            'publication_status' => 'published',
            'is_archived' => true,
            'rejection_reason' => 'Synthetic rejection',
            'approved_by' => $admin->id,
            'approved_at' => now(),
        ]);

        $this->asUser($owner);
        $this->postJson('/api/v1/student/capstones/'.$record->id.'/unarchive')->assertOk();
        $record->refresh();

        self::assertFalse($record->is_archived);
        self::assertSame('pending', $record->status);
        self::assertSame('pending', $record->approval_status);
        self::assertSame('unpublished', $record->publication_status);
        self::assertNull($record->rejection_reason);
        self::assertNull($record->approved_by);
        self::assertNull($record->approved_at);

        // The submitter also cannot inject approval through the edit payload.
        $this->putJson('/api/v1/student/capstones/'.$record->id, [
            'title' => 'Synthetic still pending',
            'approval_status' => 'approved',
            'status' => 'approved',
        ])->assertOk();
        $record->refresh();
        self::assertSame('pending', $record->approval_status);

        // Publishing is not possible until review approves it again.
        $this->asUser($admin);
        $this->postJson('/api/v1/admin/capstones/'.$record->id.'/publish')->assertStatus(400);
    }

    public function test_admin_and_faculty_uploads_default_to_unpublished_and_do_not_expose_full_documents_to_visitors(): void
    {
        $admin = $this->user('admin');
        $faculty = $this->user('faculty');
        $visitor = $this->user('visitor');
        $student = $this->user('student');

        // Admin upload without specifying publication_status
        $this->asUser($admin);
        $adminUpload = $this->post('/api/v1/admin/capstones/upload', [
            'pdf' => UploadedFile::fake()->createWithContent('admin.pdf', $this->syntheticPdf()),
            'skip_extraction' => 1,
        ], ['Accept' => 'application/json'])->assertOk()->json('data');

        $adminCapstone = $this->postJson('/api/v1/admin/capstones', [
            'title' => 'Admin default unpublished '.bin2hex(random_bytes(5)),
            'author' => 'Admin Author',
            'year' => 2026,
            'pdf_path' => $adminUpload['pdf_path'],
            'pdf_original_name' => $adminUpload['pdf_original_name'],
        ])->assertCreated()->json('data');

        $storedAdmin = Capstone::withoutGlobalScopes()->findOrFail($adminCapstone['id']);
        self::assertSame('approved', $storedAdmin->approval_status);
        self::assertSame('unpublished', $storedAdmin->publication_status);

        // Faculty upload without specifying publication_status
        $this->asUser($faculty);
        $facultyUpload = $this->post('/api/v1/faculty/capstones/upload', [
            'pdf' => UploadedFile::fake()->createWithContent('faculty.pdf', $this->syntheticPdf()),
            'skip_extraction' => 1,
        ], ['Accept' => 'application/json'])->assertOk()->json('data');

        $facultyCapstone = $this->postJson('/api/v1/faculty/capstones', [
            'title' => 'Faculty default unpublished '.bin2hex(random_bytes(5)),
            'author' => 'Faculty Author',
            'year' => 2026,
            'pdf_path' => $facultyUpload['pdf_path'],
            'pdf_original_name' => $facultyUpload['pdf_original_name'],
        ])->assertCreated()->json('data');

        $storedFaculty = Capstone::withoutGlobalScopes()->findOrFail($facultyCapstone['id']);
        self::assertSame('approved', $storedFaculty->approval_status);
        self::assertSame('unpublished', $storedFaculty->publication_status);

        // Both are approved, so they appear in the internal library for students and faculty
        $this->asUser($student);
        $this->getJson('/api/v1/published')->assertOk()
            ->assertJsonFragment(['id' => $storedAdmin->id])
            ->assertJsonFragment(['id' => $storedFaculty->id]);

        // Visitors must NOT see either record by default
        $this->asUser($visitor);
        $this->getJson('/api/v1/visitor/capstones')->assertOk()
            ->assertJsonMissing(['id' => $storedAdmin->id])
            ->assertJsonMissing(['id' => $storedFaculty->id]);
        $this->getJson('/api/v1/visitor/capstones/'.$storedAdmin->id)->assertNotFound();
        $this->getJson('/api/v1/visitor/capstones/'.$storedFaculty->id)->assertNotFound();
    }

    public function test_schema_default_for_publication_status_is_unpublished(): void
    {
        $owner = $this->user('student');
        $id = \Illuminate\Support\Facades\DB::table('capstones')->insertGetId([
            'title' => 'Schema Default Test '.bin2hex(random_bytes(5)),
            'year' => 2026,
            'author' => 'Schema Author',
            'pdf_path' => 'capstones/schema_default_test.enc',
            'uploaded_by' => $owner->id,
            'status' => 'pending',
            'approval_status' => 'pending',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        $stored = \Illuminate\Support\Facades\DB::table('capstones')->where('id', $id)->first();
        self::assertSame('unpublished', $stored->publication_status);
    }
}
