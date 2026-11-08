<?php

namespace Tests\Feature;

use App\Models\{Capstone, DocumentUpload};
use App\Services\{DocumentUploads, PdfEncryptorService};
use Illuminate\Support\Facades\Queue;
use Tests\SecurityTestCase;

class RequiredSubmissionChoicesTest extends SecurityTestCase
{
    public function test_each_role_must_make_both_choices_before_its_upload_can_be_claimed(): void
    {
        Queue::fake();
        foreach (['admin', 'faculty', 'student'] as $role) {
            $owner = $this->user($role);
            $this->asUser($owner);
            $path = 'capstones/'.bin2hex(random_bytes(8)).'.enc';
            app(PdfEncryptorService::class)->encryptRawAndStore($path, '%PDF-1.4 synthetic required choices');
            $reference = app(DocumentUploads::class)->stage($owner, 'pdf', $path);
            $payload = ['title' => 'Synthetic choices '.bin2hex(random_bytes(6)), 'author' => 'Synthetic Author', 'pdf_path' => $reference];
            $before = Capstone::withoutGlobalScopes()->count();
            $endpoint = '/api/v1/'.$role.'/capstones';
            foreach ([[], ['publication_status' => ''], ['publication_status' => null, 'copyright_status' => null],
                ['publication_status' => 'invalid', 'copyright_status' => 'invalid']] as $choices) {
                $this->postJson($endpoint, $payload + $choices)->assertUnprocessable()
                    ->assertJsonValidationErrors(['publication_status', 'copyright_status']);
            }
            $this->postJson($endpoint, $payload + ['publication_status' => 'unpublished'])->assertUnprocessable()->assertJsonValidationErrors('copyright_status');
            $this->postJson($endpoint, $payload + ['copyright_status' => 'pending'])->assertUnprocessable()->assertJsonValidationErrors('publication_status');
            self::assertSame($before, Capstone::withoutGlobalScopes()->count());
            self::assertNull(DocumentUpload::findOrFail(substr($reference, 7))->capstone_id);
            $created = $this->postJson($endpoint, $payload + ['publication_status' => 'in_progress', 'copyright_status' => 'pending'])
                ->assertCreated()->assertJsonPath('data.publication_status', 'in_progress')->assertJsonPath('data.copyright_status', 'pending')->json('data');
            self::assertSame($role === 'student' ? 'pending' : 'approved', $created['approval_status']);
        }
    }
}
