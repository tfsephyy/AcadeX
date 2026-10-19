<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\CapstoneResource;
use App\Services\PdfEncryptorService;
use Tests\SecurityTestCase;

class VisitorCapstoneAccessTest extends SecurityTestCase
{
    private function encrypt(Capstone $record, string $attribute = 'pdf_path'): void
    {
        $path = $record->{$attribute};
        if ($path) {
            app(PdfEncryptorService::class)->encryptRawAndStore($path, '%PDF-1.4 synthetic visitor document');
        }
    }

    private function encryptRaw(string $path, string $content = 'synthetic resource content'): void
    {
        app(PdfEncryptorService::class)->encryptRawAndStore($path, $content);
    }

    public function test_visitor_sees_full_pdf_only_for_published_or_copyrighted_approved_records(): void
    {
        $owner = $this->user('student');
        $visitor = $this->user('visitor');

        $copyrighted = $this->capstone($owner, [
            'status' => 'approved', 'approval_status' => 'approved',
            'publication_status' => 'unpublished', 'copyright_status' => 'copyrighted',
            'imrad_path' => 'capstone_imrad/copyrighted.enc',
        ]);
        $imradOnly = $this->capstone($owner, [
            'status' => 'approved', 'approval_status' => 'approved',
            'publication_status' => 'unpublished', 'copyright_status' => null,
            'imrad_path' => 'capstone_imrad/imrad-only.enc',
        ]);
        $hidden = $this->capstone($owner, [
            'status' => 'approved', 'approval_status' => 'approved',
            'publication_status' => 'unpublished', 'copyright_status' => null,
        ]);
        $pending = $this->capstone($owner, [
            'status' => 'pending', 'approval_status' => 'pending',
            'publication_status' => 'published', 'copyright_status' => 'copyrighted',
            'imrad_path' => 'capstone_imrad/pending.enc',
        ]);

        foreach ([$copyrighted, $imradOnly, $hidden, $pending] as $record) {
            $this->encrypt($record);
            if ($record->imrad_path) $this->encrypt($record, 'imrad_path');
        }

        // Real resource fixtures for full-access and IMRAD-only records
        $previewableResource = CapstoneResource::create([
            'capstone_id' => $copyrighted->id,
            'name' => 'Previewable Appendix',
            'file_path' => 'capstone_resources/previewable.enc',
            'file_original_name' => 'appendix.pdf',
        ]);
        $this->encryptRaw($previewableResource->file_path, '%PDF-1.4 previewable resource content');

        $nonpreviewableResource = CapstoneResource::create([
            'capstone_id' => $copyrighted->id,
            'name' => 'Dataset Archive',
            'file_path' => 'capstone_resources/dataset.enc',
            'file_original_name' => 'dataset.zip',
        ]);
        $this->encryptRaw($nonpreviewableResource->file_path, 'PK synthetic archive content');

        $imradResource = CapstoneResource::create([
            'capstone_id' => $imradOnly->id,
            'name' => 'IMRAD Supplemental File',
            'file_path' => 'capstone_resources/imrad_supp.enc',
            'file_original_name' => 'supplemental.pdf',
        ]);
        $this->encryptRaw($imradResource->file_path, '%PDF-1.4 imrad supplemental content');

        $this->asUser($visitor);

        $this->getJson('/api/v1/visitor/capstones')->assertOk()
            ->assertJsonFragment(['id' => $copyrighted->id, 'visitor_can_see_pdf' => true])
            ->assertJsonFragment(['id' => $imradOnly->id, 'visitor_can_see_pdf' => false])
            ->assertJsonMissing(['id' => $hidden->id])
            ->assertJsonMissing(['id' => $pending->id]);

        // Copyright clearance with no external publication: full document.
        $this->getJson('/api/v1/visitor/capstones/'.$copyrighted->id)->assertOk()
            ->assertJsonPath('data.visitor_can_see_pdf', true);
        $this->getJson('/api/v1/visitor/capstones/'.$copyrighted->id.'/pdf')->assertOk();
        $this->getJson('/api/v1/visitor/capstones/'.$copyrighted->id.'/imrad')->assertOk();

        // Full-tier visitor can view previewable resources inline
        $this->getJson('/api/v1/capstones/'.$copyrighted->id.'/resources/'.$previewableResource->id.'/view')->assertOk();

        // Nonpreviewable resource triggers download authorization, which visitors lack
        $this->getJson('/api/v1/capstones/'.$copyrighted->id.'/resources/'.$nonpreviewableResource->id.'/view')->assertForbidden();

        // Visitors cannot download resources directly
        $this->getJson('/api/v1/capstones/'.$copyrighted->id.'/resources/'.$previewableResource->id.'/download')->assertForbidden();

        // No clearance/publication: metadata + IMRAD, never the complete PDF or resources.
        $this->getJson('/api/v1/visitor/capstones/'.$imradOnly->id)->assertOk()
            ->assertJsonPath('data.visitor_can_see_pdf', false)
            ->assertJsonPath('data.visitor_imrad_only', true)
            ->assertJsonPath('data.resources', [])
            ->assertJsonPath('data.is_bookmarked', false);
        $this->getJson('/api/v1/visitor/capstones/'.$imradOnly->id.'/pdf')->assertForbidden();
        $this->getJson('/api/v1/visitor/capstones/'.$imradOnly->id.'/imrad')->assertOk();

        // IMRAD-only visitor receives 403 from the shared resource-view and download routes
        $this->getJson('/api/v1/capstones/'.$imradOnly->id.'/resources/'.$imradResource->id.'/view')->assertForbidden();
        $this->getJson('/api/v1/capstones/'.$imradOnly->id.'/resources/'.$imradResource->id.'/download')->assertForbidden();

        // IMRAD-only visitor bookmarking and view tracking work through the shared endpoints
        $this->postJson('/api/v1/capstones/'.$imradOnly->id.'/view')->assertOk();
        $this->postJson('/api/v1/capstones/'.$imradOnly->id.'/bookmark')->assertOk()
            ->assertJsonPath('data.bookmarked', true);

        // Dedicated visitor show reflects the updated bookmark state
        $this->getJson('/api/v1/visitor/capstones/'.$imradOnly->id)->assertOk()
            ->assertJsonPath('data.is_bookmarked', true);

        // Bookmarks listing endpoint includes the IMRAD-only record with visitor flags
        $this->getJson('/api/v1/capstones/bookmarked')->assertOk()
            ->assertJsonFragment(['id' => $imradOnly->id, 'visitor_imrad_only' => true]);

        // Removing the bookmark succeeds
        $this->postJson('/api/v1/capstones/'.$imradOnly->id.'/bookmark')->assertOk()
            ->assertJsonPath('data.bookmarked', false);
        $this->getJson('/api/v1/capstones/bookmarked')->assertOk()
            ->assertJsonMissing(['id' => $imradOnly->id]);

        // Generic staff routes must not be a second door for an IMRAD-only visitor.
        // The visitor can see the record through the dedicated visitor route, so
        // the staff policy returns a deliberate 403 rather than pretending it is absent.
        $this->getJson('/api/v1/capstones/'.$imradOnly->id)->assertForbidden();
        $this->getJson('/api/v1/capstones/'.$imradOnly->id.'/pdf')->assertForbidden();
        $this->getJson('/api/v1/capstones/'.$imradOnly->id.'/imrad')->assertForbidden();
        $this->getJson('/api/v1/capstones/'.$imradOnly->id.'/download')->assertForbidden();
        $this->getJson('/api/v1/visitor/capstones/'.$imradOnly->id.'/download')->assertNotFound();

        // No tier, or not yet approved: not visitor-visible at all.
        foreach ([$hidden, $pending] as $record) {
            $this->getJson('/api/v1/visitor/capstones/'.$record->id)->assertNotFound();
            $this->getJson('/api/v1/visitor/capstones/'.$record->id.'/pdf')->assertNotFound();
            $this->getJson('/api/v1/visitor/capstones/'.$record->id.'/imrad')->assertNotFound();
        }
    }

    public function test_approved_unpublished_record_stays_available_to_students_and_faculty_but_not_visitors(): void
    {
        $owner = $this->user('student');
        $reader = $this->user('student');
        $faculty = $this->user('faculty');
        $visitor = $this->user('visitor');

        $record = $this->capstone($owner, [
            'title' => 'Approved unpublished library record',
            'status' => 'approved', 'approval_status' => 'approved',
            'publication_status' => 'unpublished', 'copyright_status' => null,
        ]);
        $this->encrypt($record);

        $this->asUser($reader);
        $this->getJson('/api/v1/published')->assertOk()
            ->assertJsonFragment(['id' => $record->id]);
        $this->getJson('/api/v1/capstones/'.$record->id)->assertOk();
        $this->getJson('/api/v1/capstones/'.$record->id.'/pdf')->assertOk();
        $this->getJson('/api/v1/capstones/'.$record->id.'/download')->assertForbidden();

        $this->asUser($faculty);
        $this->getJson('/api/v1/capstones/'.$record->id)->assertOk();
        $this->getJson('/api/v1/capstones/'.$record->id.'/pdf')->assertOk();
        $this->getJson('/api/v1/capstones/'.$record->id.'/download')->assertOk();

        // No publication, copyright clearance or IMRAD means no visitor tier.
        $this->asUser($visitor);
        $this->getJson('/api/v1/published')->assertOk()
            ->assertJsonMissing(['id' => $record->id]);
        $this->getJson('/api/v1/visitor/capstones/'.$record->id)->assertNotFound();
        $this->getJson('/api/v1/visitor/capstones/'.$record->id.'/pdf')->assertNotFound();
    }

    public function test_unauthenticated_request_to_visitor_capstone_route_returns_401(): void
    {
        $this->getJson('/api/v1/visitor/capstones')->assertUnauthorized();
    }
}
