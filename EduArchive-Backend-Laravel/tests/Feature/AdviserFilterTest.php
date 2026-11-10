<?php

namespace Tests\Feature;

use App\Models\Capstone;
use App\Models\User;
use Tests\SecurityTestCase;

class AdviserFilterTest extends SecurityTestCase
{
    public function test_filter_options_returns_both_registered_faculty_and_manual_advisers(): void
    {
        $admin = $this->user('admin');
        $student = $this->user('student');
        $faculty = $this->user('faculty');
        $faculty->update(['name' => 'Dr. Maria Santos', 'adviser_available' => true]);

        // Capstone with registered faculty adviser
        $this->capstone($admin, [
            'title' => 'Registered Adviser Capstone',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => $faculty->id,
            'adviser_name' => 'Dr. Maria Santos',
            'is_archived' => false,
        ]);

        // Capstone with manual adviser (no faculty account)
        $this->capstone($admin, [
            'title' => 'Manual Adviser Capstone',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Engr. Ada Lovelace',
            'is_archived' => false,
        ]);

        $this->asUser($student);

        $res = $this->getJson('/api/v1/student/capstones/browse-filter-options')
            ->assertOk();

        $advisers = collect($res->json('data.advisers'));
        $names = $advisers->pluck('name')->all();

        self::assertTrue(
            $advisers->contains(fn ($a) => str_contains($a['name'], 'Maria Santos') && $a['id'] == $faculty->id),
            'Dropdown must contain registered faculty adviser with user ID'
        );

        self::assertTrue(
            $advisers->contains(fn ($a) => str_contains($a['name'], 'Ada Lovelace')),
            'Dropdown must contain manual adviser even without faculty account'
        );
    }

    public function test_filter_options_deduplicates_variant_and_case_insensitive_names(): void
    {
        $admin = $this->user('admin');
        $student = $this->user('student');

        // Create multiple capstones with different name variations of the same adviser
        $this->capstone($admin, [
            'title' => 'Project 1',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Alan Turing',
            'is_archived' => false,
        ]);

        $this->capstone($admin, [
            'title' => 'Project 2',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Dr. Alan Turing, Ph.D.',
            'is_archived' => false,
        ]);

        $this->capstone($admin, [
            'title' => 'Project 3',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'alan turing',
            'is_archived' => false,
        ]);

        $this->asUser($student);

        $res = $this->getJson('/api/v1/student/capstones/browse-filter-options')
            ->assertOk();

        $advisers = collect($res->json('data.advisers'));
        $matching = $advisers->filter(fn ($a) => str_contains(strtolower($a['name']), 'alan turing'));

        self::assertSame(1, $matching->count(), 'Variant and casing differences of the same adviser must be deduplicated to exactly 1 dropdown item');
    }

    public function test_filtering_by_registered_faculty_returns_both_fk_and_manual_name_records(): void
    {
        $admin = $this->user('admin');
        $student = $this->user('student');
        $faculty = $this->user('faculty');
        $faculty->update(['name' => 'Maria Santos', 'adviser_available' => true]);

        // C1: linked via adviser_id
        $c1 = $this->capstone($admin, [
            'title' => 'Linked By ID',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => $faculty->id,
            'adviser_name' => null,
            'is_archived' => false,
        ]);

        // C2: entered by name with title variant, adviser_id is null
        $c2 = $this->capstone($admin, [
            'title' => 'Linked By Name Only',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Dr. Maria Santos',
            'is_archived' => false,
        ]);

        // C3: completely different adviser
        $c3 = $this->capstone($admin, [
            'title' => 'Different Adviser Project',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Prof. Charles Babbage',
            'is_archived' => false,
        ]);

        $this->asUser($student);

        // Filter by faculty ID
        $res = $this->getJson('/api/v1/student/capstones/all?adviser_id='.$faculty->id)
            ->assertOk();

        $returnedIds = collect($res->json('data.data'))->pluck('id')->all();

        self::assertContains($c1->id, $returnedIds, 'Should include capstone assigned by adviser_id');
        self::assertContains($c2->id, $returnedIds, 'Should include capstone assigned by matching adviser_name');
        self::assertNotContains($c3->id, $returnedIds, 'Should NOT include unrelated capstone');

        // Also test filtering by name string
        $resByName = $this->getJson('/api/v1/student/capstones/all?adviser_id=Maria+Santos')
            ->assertOk();

        $returnedByNameIds = collect($resByName->json('data.data'))->pluck('id')->all();
        self::assertContains($c1->id, $returnedByNameIds);
        self::assertContains($c2->id, $returnedByNameIds);
        self::assertNotContains($c3->id, $returnedByNameIds);
    }

    public function test_filtering_by_manual_adviser_name_returns_all_assigned_capstones(): void
    {
        $admin = $this->user('admin');
        $student = $this->user('student');

        $c1 = $this->capstone($admin, [
            'title' => 'Manual Adviser Project Alpha',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Prof. Charles Babbage',
            'is_archived' => false,
        ]);

        $c2 = $this->capstone($admin, [
            'title' => 'Manual Adviser Project Beta',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Charles Babbage',
            'is_archived' => false,
        ]);

        $c3 = $this->capstone($admin, [
            'title' => 'Other Project',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Ada Lovelace',
            'is_archived' => false,
        ]);

        $this->asUser($student);

        $res = $this->getJson('/api/v1/student/capstones/all?adviser_id=Prof.+Charles+Babbage')
            ->assertOk();

        $returnedIds = collect($res->json('data.data'))->pluck('id')->all();

        self::assertContains($c1->id, $returnedIds);
        self::assertContains($c2->id, $returnedIds);
        self::assertNotContains($c3->id, $returnedIds);
    }

    public function test_adviser_filter_combines_with_year_category_and_search_filters(): void
    {
        $admin = $this->user('admin');
        $student = $this->user('student');

        // C1: matches all filters
        $c1 = $this->capstone($admin, [
            'title' => 'Machine Learning for Health Diagnostics',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Grace Hopper',
            'year' => 2025,
            'category' => 'Machine Learning',
            'is_archived' => false,
        ]);

        // C2: same adviser and category, but different year
        $c2 = $this->capstone($admin, [
            'title' => 'Machine Learning Vision System',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Grace Hopper',
            'year' => 2024,
            'category' => 'Machine Learning',
            'is_archived' => false,
        ]);

        // C3: same adviser and year, but different category
        $c3 = $this->capstone($admin, [
            'title' => 'Web Portal for Campus Safety',
            'status' => 'approved',
            'approval_status' => 'approved',
            'adviser_id' => null,
            'adviser_name' => 'Grace Hopper',
            'year' => 2025,
            'category' => 'Web Development',
            'is_archived' => false,
        ]);

        $this->asUser($student);

        // Combined: adviser + year + category
        $res = $this->getJson('/api/v1/student/capstones/all?adviser_id=Grace+Hopper&year=2025&category=Machine+Learning')
            ->assertOk();

        $returnedIds = collect($res->json('data.data'))->pluck('id')->all();
        self::assertContains($c1->id, $returnedIds);
        self::assertNotContains($c2->id, $returnedIds);
        self::assertNotContains($c3->id, $returnedIds);

        // Combined with search keyword: 'Diagnostics'
        $searchRes = $this->getJson('/api/v1/student/capstones/all?adviser_id=Grace+Hopper&search=Diagnostics')
            ->assertOk();

        $searchReturnedIds = collect($searchRes->json('data.data'))->pluck('id')->all();
        self::assertContains($c1->id, $searchReturnedIds);
        self::assertNotContains($c2->id, $searchReturnedIds);
        self::assertNotContains($c3->id, $searchReturnedIds);
    }

    public function test_visitor_advisers_endpoint_and_filtering_handles_manual_and_registered_advisers(): void
    {
        $admin = $this->user('admin');
        $faculty = $this->user('faculty');
        $faculty->update(['name' => 'Dr. Visitor Faculty', 'adviser_available' => true]);

        // Published with manual adviser
        $c1 = $this->capstone($admin, [
            'title' => 'Visitor Visible Manual',
            'status' => 'approved',
            'approval_status' => 'approved',
            'publication_status' => 'published',
            'adviser_id' => null,
            'adviser_name' => 'Engr. Katherine Johnson',
            'is_archived' => false,
        ]);

        // Published with registered faculty
        $c2 = $this->capstone($admin, [
            'title' => 'Visitor Visible Registered',
            'status' => 'approved',
            'approval_status' => 'approved',
            'publication_status' => 'published',
            'adviser_id' => $faculty->id,
            'adviser_name' => 'Dr. Visitor Faculty',
            'is_archived' => false,
        ]);

        // Unpublished / pending - should NOT leak into visitor advisers list
        $c3 = $this->capstone($admin, [
            'title' => 'Visitor Hidden Unpublished',
            'status' => 'pending',
            'approval_status' => 'pending',
            'publication_status' => 'unpublished',
            'adviser_id' => null,
            'adviser_name' => 'Secret Adviser',
            'is_archived' => false,
        ]);

        // Visitor endpoint
        $visitor = $this->user('visitor');
        $this->asUser($visitor);
        $res = $this->getJson('/api/v1/visitor/capstones/advisers')
            ->assertOk();

        $advisers = collect($res->json('data'));
        $names = $advisers->pluck('name')->all();

        self::assertTrue($advisers->contains(fn ($a) => str_contains($a['name'], 'Katherine Johnson')));
        self::assertTrue($advisers->contains(fn ($a) => str_contains($a['name'], 'Visitor Faculty')));
        self::assertFalse($advisers->contains(fn ($a) => str_contains($a['name'], 'Secret Adviser')), 'Unpublished internal advisers must not leak to visitor dropdown');

        // Filter visitor capstones by manual adviser
        $filterRes = $this->getJson('/api/v1/visitor/capstones?adviser_id=Katherine+Johnson')
            ->assertOk();

        $visitorReturned = collect($filterRes->json('data.data'))->pluck('id')->all();
        self::assertContains($c1->id, $visitorReturned);
        self::assertNotContains($c2->id, $visitorReturned);
    }
}
