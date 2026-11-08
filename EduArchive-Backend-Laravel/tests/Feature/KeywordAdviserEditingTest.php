<?php

namespace Tests\Feature;

use App\Models\{Capstone, Keyword, User};
use App\Services\{DocumentUploads, PdfEncryptorService};
use Illuminate\Support\Facades\Queue;
use Tests\SecurityTestCase;

class KeywordAdviserEditingTest extends SecurityTestCase
{
    private function payload(User $owner, mixed $keywords): array
    {
        Queue::fake();
        $path = 'capstones/'.bin2hex(random_bytes(8)).'.enc';
        app(PdfEncryptorService::class)->encryptRawAndStore($path, '%PDF-1.4 synthetic keyword document');
        return ['publication_status' => 'unpublished', 'copyright_status' => 'unprotected',
            'title' => 'Synthetic keyword '.bin2hex(random_bytes(6)), 'author' => 'Synthetic Author',
            'pdf_path' => app(DocumentUploads::class)->stage($owner, 'pdf', $path), 'keywords' => $keywords];
    }

    public function test_all_upload_roles_accept_fifteen_deduplicated_keywords_and_persist_them_on_refresh(): void
    {
        $names = ['Laravel', 'React', 'MySQL', 'PDF Extraction', 'OCR', 'Database Management', 'Web Development',
            'Python', 'JavaScript', 'Encryption', 'Authentication', 'Access Control', 'Metadata Extraction', 'API', 'Docker'];
        foreach (['student', 'faculty', 'admin'] as $role) {
            $owner = $this->user($role);
            $this->asUser($owner);
            // Total raw text exceeds 100 characters; individual terms do not.
            $record = $this->postJson('/api/v1/'.$role.'/capstones', $this->payload($owner, implode(', ', $names).', REACT, , laravel'))
                ->assertCreated()->json('data');
            self::assertCount(15, $record['keywords']);
            $persisted = Capstone::withoutGlobalScopes()->findOrFail($record['id'])->keywords()->orderBy('name')->pluck('name')->all();
            $expected = array_map('strtolower', $names); sort($expected);
            self::assertSame($expected, $persisted);
            $this->getJson('/api/v1/capstones/'.$record['id'])->assertOk()->assertJsonCount(15, 'data.keywords');
        }
    }

    public function test_count_is_enforced_after_splitting_for_both_new_and_existing_capstones(): void
    {
        foreach (['student', 'faculty', 'admin'] as $role) {
            $owner = $this->user($role);
            $this->asUser($owner);
            $record = $this->capstone($owner);
            $names = array_map(fn ($index) => 'technology '.$index, range(1, 16));
            $before = Capstone::withoutGlobalScopes()->count();
            $this->postJson('/api/v1/'.$role.'/capstones', $this->payload($owner, [implode(',', $names)]))
                ->assertUnprocessable()->assertJsonValidationErrors('keywords');
            self::assertSame($before, Capstone::withoutGlobalScopes()->count());
            $this->putJson('/api/v1/'.$role.'/capstones/'.$record->id, ['keywords' => implode(',', $names), 'adviser_name' => 'Must Not Be Saved'])
                ->assertUnprocessable()->assertJsonValidationErrors('keywords');
            self::assertNull($record->fresh()->adviser_name);
            self::assertCount(0, $record->fresh()->keywords);
        }
    }

    public function test_edit_splits_and_deduplicates_then_supports_individual_replacement_and_explicit_removal(): void
    {
        $owner = $this->user('student');
        $record = $this->capstone($owner);
        $this->asUser($owner);
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['keywords' => ['React, Laravel, MySQL', 'PDF Extraction, OCR, REACT, ']])
            ->assertOk()->assertJsonCount(5, 'data.keywords');
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['keywords' => ['react', 'laravel', 'mysql', 'metadata extraction']])
            ->assertOk()->assertJsonCount(4, 'data.keywords');
        $this->getJson('/api/v1/capstones/'.$record->id)->assertOk()->assertJsonCount(4, 'data.keywords');
        self::assertContains('metadata extraction', $record->fresh()->keywords->pluck('name')->all());
        self::assertNotContains('ocr', $record->fresh()->keywords->pluck('name')->all());
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['keywords' => []])->assertOk()->assertJsonCount(0, 'data.keywords');
        self::assertCount(0, $record->fresh()->keywords);
    }

    public function test_omitted_keywords_and_adviser_preserve_legacy_values_even_above_the_new_limit(): void
    {
        $owner = $this->user('student');
        $faculty = $this->user('faculty');
        $faculty->update(['adviser_available' => false]);
        $record = $this->capstone($owner, ['adviser_id' => $faculty->id, 'adviser_name' => 'Historical Adviser']);
        foreach (range(1, 16) as $index) $record->keywords()->attach(Keyword::withoutGlobalScopes()->create(['name' => 'legacy '.$index])->id);
        $original = $record->keywords()->orderBy('keywords.id')->pluck('keywords.id')->all();
        $this->asUser($owner);
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['abstract' => 'An intentional abstract correction.'])
            ->assertOk()->assertJsonPath('data.adviser_name', 'Historical Adviser')->assertJsonPath('data.adviser_id', $faculty->id)
            ->assertJsonCount(16, 'data.keywords');
        self::assertSame($original, $record->fresh()->keywords()->orderBy('keywords.id')->pluck('keywords.id')->all());
    }

    public function test_edit_reassigns_faculty_or_preserves_free_text_and_updates_the_faculty_dashboard(): void
    {
        $owner = $this->user('student');
        $first = $this->user('faculty'); $first->update(['name' => 'First Faculty']);
        $second = $this->user('faculty'); $second->update(['name' => 'Second Faculty']);
        $record = $this->capstone($owner, ['adviser_id' => $first->id, 'adviser_name' => 'First Faculty']);
        $this->asUser($owner);
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['adviser_name' => 'Dr. SECOND FACULTY', 'adviser_id' => $second->id])
            ->assertOk()->assertJsonPath('data.adviser_name', 'Dr. SECOND FACULTY')->assertJsonPath('data.adviser_id', $second->id);
        $this->getJson('/api/v1/capstones/'.$record->id)->assertOk()->assertJsonPath('data.adviser.name', 'Second Faculty');
        $this->asUser($first);
        $this->getJson('/api/v1/faculty/dashboard')->assertOk()->assertJsonPath('data.assigned.total', 0);
        $this->asUser($second);
        $this->getJson('/api/v1/faculty/dashboard')->assertOk()->assertJsonPath('data.assigned.total', 1);
        $this->asUser($owner);
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['adviser_name' => 'External Adviser', 'adviser_id' => null])
            ->assertOk()->assertJsonPath('data.adviser_name', 'External Adviser')->assertJsonPath('data.adviser_id', null);
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['adviser_name' => '', 'adviser_id' => null])
            ->assertOk()->assertJsonPath('data.adviser_name', null)->assertJsonPath('data.adviser_id', null);
    }

    public function test_unauthorized_and_assignment_only_accounts_cannot_edit_keywords_or_adviser(): void
    {
        $owner = $this->user('student');
        $adviser = $this->user('faculty');
        $record = $this->capstone($owner, ['adviser_id' => $adviser->id, 'adviser_name' => $adviser->name]);
        $this->asUser($adviser);
        $this->putJson('/api/v1/faculty/capstones/'.$record->id, ['keywords' => ['laravel'], 'adviser_name' => 'Other Name'])->assertForbidden();
        $this->asUser($this->user('student'));
        $this->putJson('/api/v1/student/capstones/'.$record->id, ['keywords' => ['laravel']])->assertNotFound();
        self::assertSame($adviser->name, $record->fresh()->adviser_name);
        self::assertCount(0, $record->fresh()->keywords);
    }

    public function test_invalid_keyword_types_and_overlong_terms_are_rejected_without_silently_dropping_them(): void
    {
        $owner = $this->user('admin');
        $record = $this->capstone($owner);
        $this->asUser($owner);
        foreach ([['keywords' => 4], ['keywords' => [['name' => 'react']]], ['keywords' => [str_repeat('a', 101)]]] as $input) {
            $this->putJson('/api/v1/admin/capstones/'.$record->id, $input)->assertUnprocessable();
        }
        self::assertCount(0, $record->fresh()->keywords);
    }
}
