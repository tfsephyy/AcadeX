<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use App\Services\DocumentUploads;
use App\Services\PdfEncryptorService;
use Illuminate\Support\Facades\Queue;
use Tests\SecurityTestCase;

class AdviserSubmissionTest extends SecurityTestCase
{
    private function payload(User $owner, array $extra = []): array
    {
        Queue::fake();
        $path = 'capstones/'.bin2hex(random_bytes(8)).'.enc';
        app(PdfEncryptorService::class)->encryptRawAndStore($path, '%PDF-1.4 synthetic approval document');
        return $extra + ['title' => 'Synthetic adviser '.bin2hex(random_bytes(6)), 'author' => 'Synthetic Author',
            'pdf_path' => app(DocumentUploads::class)->stage($owner, 'pdf', $path), 'pdf_original_name' => 'synthetic.pdf'];
    }

    public function test_unique_name_links_automatically_and_rematching_manual_edits_clears_stale_links(): void
    {
        $faculty = $this->user('faculty');
        $faculty->update(['name' => 'Alex Example']);
        $owner = $this->user('student');
        $this->asUser($owner);
        $record = $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => " ALEX  \tEXAMPLE "]))
            ->assertCreated()->assertJsonPath('data.adviser_id', $faculty->id)
            ->assertJsonPath('data.adviser_name', 'ALEX EXAMPLE')->json('data');
        $this->putJson('/api/v1/student/capstones/'.$record['id'], ['adviser_name' => 'Other Person'])
            ->assertOk()->assertJsonPath('data.adviser_name', 'Other Person')->assertJsonPath('data.adviser_id', null);
        $this->putJson('/api/v1/student/capstones/'.$record['id'], ['adviser_name' => ' alex example '])
            ->assertOk()->assertJsonPath('data.adviser_id', $faculty->id);
        $this->putJson('/api/v1/student/capstones/'.$record['id'], ['adviser_name' => ''])
            ->assertOk()->assertJsonPath('data.adviser_name', null)->assertJsonPath('data.adviser_id', null);
    }

    public function test_duplicate_names_require_explicit_choice_and_no_match_keeps_text(): void
    {
        $first = $this->user('faculty');
        $second = $this->user('faculty');
        $first->update(['name' => 'Jamie Sample']);
        $second->update(['name' => ' JAMIE  SAMPLE ']);
        $owner = $this->user('student');
        $this->asUser($owner);
        $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => 'Jamie Sample']))
            ->assertCreated()->assertJsonPath('data.adviser_id', null)->assertJsonPath('data.adviser_name', 'Jamie Sample');
        $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => 'Jamie Sample', 'adviser_id' => $second->id]))
            ->assertCreated()->assertJsonPath('data.adviser_id', $second->id);
        $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => 'Unregistered Adviser']))
            ->assertCreated()->assertJsonPath('data.adviser_name', 'Unregistered Adviser')->assertJsonPath('data.adviser_id', null);
        $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => 'Different Name', 'adviser_id' => $first->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('adviser_id');
    }

    public function test_ineligible_accounts_are_not_suggested_or_assignable_and_visitors_cannot_list_accounts(): void
    {
        $owner = $this->user('student');
        $faculty = $this->user('faculty');
        $faculty->update(['name' => 'Unavailable Faculty', 'adviser_available' => false]);
        $unapproved = $this->user('faculty');
        $unapproved->update(['is_approved' => false]);
        $archived = $this->user('faculty');
        $archived->update(['is_archived' => true]);
        $eligible = $this->user('faculty');
        $this->asUser($owner);
        $data = $this->getJson('/api/v1/uploads/advisers')->assertOk()->json('data');
        self::assertSame([$eligible->id], array_column($data, 'id'));
        self::assertArrayNotHasKey('email', $data[0]);
        self::assertArrayNotHasKey('id_number', $data[0]);
        $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => $faculty->name, 'adviser_id' => $faculty->id]))
            ->assertUnprocessable()->assertJsonValidationErrors('adviser_id');
        $this->postJson('/api/v1/student/capstones', $this->payload($owner, ['adviser_name' => $faculty->name]))
            ->assertCreated()->assertJsonPath('data.adviser_id', null);
        $this->asUser($this->user('visitor'));
        $this->getJson('/api/v1/uploads/advisers')->assertForbidden();
    }

    public function test_student_visibility_choice_is_saved_but_never_bypasses_review(): void
    {
        $owner = $this->user('student');
        $faculty = $this->user('faculty');
        $visitor = $this->user('visitor');
        foreach (['published', 'unpublished', 'in_progress'] as $choice) {
            $this->asUser($owner);
            $record = $this->postJson('/api/v1/student/capstones', $this->payload($owner, [
                'publication_status' => $choice, 'adviser_name' => $faculty->name,
                'approval_status' => 'approved', 'status' => 'approved',
            ]))->assertCreated()->assertJsonPath('data.publication_status', $choice)
                ->assertJsonPath('data.approval_status', 'pending')->json('data');
            $this->asUser($visitor);
            $this->getJson('/api/v1/visitor/capstones/'.$record['id'])->assertNotFound();
            $this->getJson('/api/v1/capstones/'.$record['id'].'/pdf')->assertNotFound();
            $this->asUser($this->user('student'));
            $this->getJson('/api/v1/capstones/'.$record['id'])->assertNotFound();
            $this->asUser($faculty);
            $this->postJson('/api/v1/faculty/capstones/'.$record['id'].'/approve')->assertOk();
            self::assertSame($choice, Capstone::withoutGlobalScopes()->findOrFail($record['id'])->publication_status);
            $this->asUser($visitor);
            if ($choice === 'published') {
                $this->getJson('/api/v1/visitor/capstones/'.$record['id'])->assertOk()->assertJsonPath('data.visitor_can_see_pdf', true);
                $this->getJson('/api/v1/capstones/'.$record['id'].'/pdf')->assertOk();
            } else {
                $this->getJson('/api/v1/visitor/capstones/'.$record['id'])->assertNotFound();
            }
        }
    }
}
