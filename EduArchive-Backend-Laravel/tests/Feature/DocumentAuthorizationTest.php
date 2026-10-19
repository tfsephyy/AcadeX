<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\Keyword;
use App\Services\PdfEncryptorService;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class DocumentAuthorizationTest extends SecurityTestCase
{
    public function test_inline_nonpreviewable_resources_cannot_bypass_download_restrictions(): void
    {
        $owner = $this->user('student');
        $record = $this->capstone($owner, ['status' => 'approved', 'approval_status' => 'approved', 'publication_status' => 'published']);
        $resource = $record->resources()->create(['name' => 'Archive', 'file_path' => 'capstone_resources/synthetic.enc', 'file_original_name' => 'synthetic.zip']);
        app(PdfEncryptorService::class)->encryptRawAndStore($resource->file_path, 'synthetic archive bytes');
        foreach (['student', 'visitor', 'faculty', 'admin'] as $role) {
            $this->asUser($this->user($role));
            $response = $this->getJson('/api/v1/capstones/'.$record->id.'/resources/'.$resource->id.'/view');
            in_array($role, ['faculty', 'admin'], true) ? $response->assertOk() : $response->assertForbidden();
        }
    }

    public function test_all_roles_and_alternate_document_routes_enforce_the_matrix(): void
    {
        $student = $this->user('student');
        $other = $this->user('student');
        $faculty = $this->user('faculty');
        $outsider = $this->user('faculty');
        $visitor = $this->user('visitor');
        $admin = $this->user('admin');
        $private = $this->capstone($student, ['adviser_id' => $faculty->id, 'copyright_status' => 'copyrighted',
            'imrad_path' => 'capstone_imrad/synthetic.enc']);
        $public = $this->capstone($student, ['status' => 'approved', 'approval_status' => 'approved',
            'publication_status' => 'published', 'imrad_path' => 'capstone_imrad/published.enc']);
        $archived = $this->capstone($student, ['is_archived' => true, 'status' => 'approved',
            'approval_status' => 'approved', 'publication_status' => 'published']);
        $rejected = $this->capstone($student, ['status' => 'rejected', 'approval_status' => 'rejected',
            'publication_status' => 'published']);
        $facultyOwn = $this->capstone($faculty, ['adviser_id' => $outsider->id]);
        foreach ([$private, $public, $archived, $rejected, $facultyOwn] as $record) {
            app(PdfEncryptorService::class)->encryptRawAndStore($record->pdf_path, '%PDF-1.4 synthetic');
            if ($record->imrad_path) app(PdfEncryptorService::class)->encryptRawAndStore($record->imrad_path, '%PDF-1.4 imrad');
            $record->resources()->create(['name' => 'Synthetic resource', 'file_path' => $record->pdf_path,
                'file_original_name' => 'synthetic.pdf']);
        }

        foreach ([$admin, $student, $other, $faculty, $outsider, $visitor] as $user) {
            $this->asUser($user);
            foreach ([$private, $public, $archived, $rejected, $facultyOwn] as $record) {
                $allowed = $user->hasRole('admin') || (!$record->is_archived &&
                    (($user->id === $student->id && $record->id !== $facultyOwn->id) ||
                        ($user->id === $faculty->id && in_array($record->id, [$private->id, $facultyOwn->id], true)) ||
                        $record->id === $public->id));
                $resource = $record->resources()->first();
                foreach (['', '/pdf', '/pdf-token', '/analytics', '/resources/'.$resource->id.'/view'] as $suffix) {
                    $response = $this->getJson('/api/v1/capstones/'.$record->id.$suffix);
                    $allowed ? $response->assertOk() : $response->assertNotFound();
                }
                if ($record->imrad_path) {
                    $response = $this->getJson('/api/v1/capstones/'.$record->id.'/imrad');
                    $allowed ? $response->assertOk() : $response->assertNotFound();
                }
                foreach (['/download', '/resources/'.$resource->id.'/download'] as $suffix) {
                    $response = $this->getJson('/api/v1/capstones/'.$record->id.$suffix);
                    if (!$allowed) $response->assertNotFound();
                    elseif ($user->hasRole('admin') || $user->hasRole('faculty')) $response->assertOk();
                    else $response->assertForbidden();
                }
            }
        }
        $this->asUser($visitor);
        foreach ([$private, $archived, $rejected] as $record) {
            $this->getJson('/api/v1/visitor/capstones/'.$record->id)->assertNotFound();
            $this->getJson('/api/v1/visitor/capstones/'.$record->id.'/pdf')->assertNotFound();
            $this->getJson('/api/v1/visitor/capstones/'.$record->id.'/imrad')->assertNotFound();
        }
        $this->getJson('/api/v1/visitor/capstones/'.$public->id)->assertOk();
        $this->getJson('/api/v1/visitor/capstones/'.$public->id.'/pdf')->assertOk();
    }

    public function test_guessed_resource_ids_metadata_references_and_queries_do_not_disclose_private_records(): void
    {
        $owner = $this->user('student');
        $reader = $this->user('student');
        $hidden = $this->capstone($owner, ['title' => 'PRIVATE_SENTINEL']);
        $visible = $this->capstone($owner, ['status' => 'approved', 'approval_status' => 'approved', 'publication_status' => 'published']);
        $resource = $hidden->resources()->create(['name' => 'PRIVATE_RESOURCE', 'file_path' => $hidden->pdf_path]);
        $visible->referencedCapstones()->attach($hidden->id);
        $hidden->keywords()->attach(Keyword::create(['name' => 'privatekeyword'])->id);
        $visible->keywords()->attach(Keyword::create(['name' => 'publickeyword'])->id);
        $hidden->bookmarks()->create(['user_id' => $reader->id]);
        $hidden->update(['view_count' => 100]);
        $visible->update(['view_count' => 1]);
        $this->asUser($reader);
        $this->getJson('/api/v1/capstones/'.$visible->id.'/resources/'.$resource->id.'/view')->assertNotFound();
        $response = $this->getJson('/api/v1/capstones/'.$visible->id)->assertOk();
        $data = $response->json('data');
        foreach (['pdf_text', 'pdf_path', 'imrad_path', 'author_details'] as $field) self::assertArrayNotHasKey($field, $data);
        self::assertSame([], $data['referenced_capstones']);
        foreach (['/student/capstones/all', '/student/capstones/browse-filter-options', '/capstones/bookmarked',
            '/published', '/published/keywords', '/published/suggest?q=privatekeyword'] as $path) {
            $response = $this->getJson('/api/v1'.$path)->assertOk();
            self::assertStringNotContainsString('PRIVATE_SENTINEL', $response->getContent());
            self::assertStringNotContainsString('privatekeyword', $response->getContent());
        }
        foreach (['most viewed capstones', 'no imrad attached', 'never logged in', 'hello'] as $message) {
            $response = $this->postJson('/api/v1/chatbot/message', ['message' => $message])->assertOk();
            self::assertStringNotContainsString('PRIVATE_SENTINEL', $response->getContent());
            self::assertStringNotContainsString($owner->email, $response->getContent());
            self::assertStringNotContainsString('privatekeyword', $response->getContent());
        }
    }

    public function test_unassigned_faculty_cannot_modify_or_review_another_users_submission(): void
    {
        $owner = $this->user('student');
        $adviser = $this->user('faculty');
        $other = $this->user('faculty');
        $record = $this->capstone($owner, ['adviser_id' => $adviser->id]);
        $this->asUser($other);
        $this->postJson('/api/v1/faculty/capstones/'.$record->id.'/approve')->assertNotFound();
        $this->putJson('/api/v1/faculty/capstones/'.$record->id, ['title' => 'tampered'])->assertNotFound();
        $this->asUser($adviser);
        $this->putJson('/api/v1/faculty/capstones/'.$record->id, ['title' => 'tampered'])->assertForbidden();
        $this->postJson('/api/v1/faculty/capstones/'.$record->id.'/approve')->assertOk();
        self::assertSame('approved', Capstone::withoutGlobalScopes()->findOrFail($record->id)->approval_status);
    }
}
