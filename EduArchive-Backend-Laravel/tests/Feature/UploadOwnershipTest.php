<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Services\PdfEncryptorService;
use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Storage;
use Tests\SecurityTestCase;

class UploadOwnershipTest extends SecurityTestCase
{
    private function pdf(): string
    {
        $text = str_repeat('Synthetic research content for document security validation. ', 5);
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

    private function upload(): string
    {
        return $this->post('/api/v1/student/capstones/upload', ['pdf' => UploadedFile::fake()->createWithContent('synthetic.pdf', $this->pdf()),
            'skip_extraction' => 1], ['Accept' => 'application/json'])->assertOk()->json('data.pdf_path');
    }

    private function payload(string $reference): array
    {
        return ['title' => 'Synthetic '.bin2hex(random_bytes(5)), 'author' => 'Synthetic', 'pdf_path' => $reference];
    }

    public function test_owned_upload_round_trip_rejects_stolen_reused_and_arbitrary_paths(): void
    {
        $owner = $this->user('student');
        $other = $this->user('student');
        $this->asUser($owner);
        $reference = $this->upload();
        self::assertStringStartsWith('upload:', $reference);
        $this->asUser($other);
        $this->postJson('/api/v1/student/capstones', $this->payload($reference))->assertUnprocessable();
        $this->postJson('/api/v1/student/capstones', $this->payload('../.env'))->assertUnprocessable();
        $this->asUser($owner);
        $record = $this->postJson('/api/v1/student/capstones', $this->payload($reference))->assertCreated()->json('data');
        self::assertArrayNotHasKey('pdf_path', $record);
        $this->getJson('/api/v1/capstones/'.$record['id'].'/pdf')->assertOk();
        $this->postJson('/api/v1/student/capstones', $this->payload($reference))->assertUnprocessable();
        $this->asUser($other);
        $this->getJson('/api/v1/capstones/'.$record['id'].'/pdf')->assertNotFound();
    }

    public function test_resources_are_bound_to_owner_purpose_and_parent_and_can_be_retained_on_edit(): void
    {
        $owner = $this->user('student');
        $this->asUser($owner);
        $pdf = $this->upload();
        $resource = $this->post('/api/v1/student/capstones/upload-resource',
            ['file' => UploadedFile::fake()->createWithContent('notes.txt', 'Synthetic notes')],
            ['Accept' => 'application/json'])->assertOk()->json('data.file_path');
        $this->postJson('/api/v1/student/capstones', $this->payload($resource))->assertUnprocessable();
        $record = $this->postJson('/api/v1/student/capstones', $this->payload($pdf) +
            ['resources' => [['name' => 'Notes', 'file_path' => $resource]]])->assertCreated()->json('data');
        $existing = $record['resources'][0];
        self::assertArrayNotHasKey('file_path', $existing);
        $this->putJson('/api/v1/student/capstones/'.$record['id'], ['title' => 'Edited Synthetic',
            'resources' => [['name' => 'Notes', 'file_path' => $existing['file_reference']]], 'publication_status' => 'published'])->assertOk();
        $stored = Capstone::withoutGlobalScopes()->findOrFail($record['id']);
        self::assertSame('unpublished', $stored->publication_status);
        self::assertSame('pending', $stored->approval_status);
        $next = $this->upload();
        $this->postJson('/api/v1/student/capstones', $this->payload($next) +
            ['resources' => [['name' => 'Stolen parent', 'file_path' => $existing['file_reference']]]])->assertUnprocessable();
    }

    public function test_corrupted_encrypted_files_are_never_served_as_legacy_plaintext(): void
    {
        Storage::disk('local')->put('capstones/corrupt.enc', 'not encrypted');
        self::assertNull(app(PdfEncryptorService::class)->decryptFromDisk('capstones/corrupt.enc'));
    }

    public function test_imrad_upload_uses_its_own_purpose_and_is_retrievable_only_with_parent_access(): void
    {
        $owner = $this->user('student');
        $other = $this->user('student');
        $this->asUser($owner);
        $pdf = $this->upload();
        $imrad = $this->post('/api/v1/student/capstones/upload-imrad',
            ['file' => UploadedFile::fake()->createWithContent('imrad.pdf', $this->pdf())],
            ['Accept' => 'application/json'])->assertOk()->json('data.file_path');
        $record = $this->postJson('/api/v1/student/capstones', $this->payload($pdf) + ['imrad_path' => $imrad])->assertCreated()->json('data');
        $this->getJson('/api/v1/capstones/'.$record['id'].'/imrad')->assertOk();
        $this->putJson('/api/v1/student/capstones/'.$record['id'], ['imrad_path' => $record['imrad_reference']])->assertOk();
        $this->asUser($other);
        $this->getJson('/api/v1/capstones/'.$record['id'].'/imrad')->assertNotFound();
    }
}
