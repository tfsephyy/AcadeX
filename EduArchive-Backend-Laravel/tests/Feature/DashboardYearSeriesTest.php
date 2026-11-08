<?php

namespace Tests\Feature;

use Tests\SecurityTestCase;

class DashboardYearSeriesTest extends SecurityTestCase
{
    public function test_capstone_year_counts_academic_years_matching_repository_records(): void
    {
        $admin = $this->user('admin');
        $owner = $this->user('student');
        foreach ([
            [2023, 'approved', false],
            [2023, 'pending', false],
            [2024, 'approved', false],
            [2025, 'approved', false],
            [2025, 'rejected', true], // Counted in Uploaded, excluded from Approved.
        ] as [$capstoneYear, $status, $archived]) {
            $this->capstone($owner, [
                'year' => $capstoneYear,
                'status' => $status,
                'approval_status' => $status,
                'is_archived' => $archived,
            ]);
        }
        $this->asUser($admin);
        $expected = [
            ['year' => 2023, 'count' => 2],
            ['year' => 2024, 'count' => 1],
            ['year' => 2025, 'count' => 2],
        ];
        $this->getJson('/api/v1/admin/dashboard/uploaded-by-year')->assertOk()->assertExactJson([
            'success' => true, 'message' => 'Uploaded capstones by year.', 'data' => $expected,
        ]);
        $approvedExpected = [
            ['year' => 2023, 'count' => 1],
            ['year' => 2024, 'count' => 1],
            ['year' => 2025, 'count' => 1],
        ];
        $this->getJson('/api/v1/admin/dashboard/approved-by-year')->assertOk()->assertJsonPath('data', $approvedExpected);
        $this->getJson('/api/v1/admin/dashboard/stats')->assertOk()->assertJsonPath('data.uploaded', 5);
    }

    public function test_empty_repository_returns_empty_array_and_dashboard_remains_admin_only(): void
    {
        $this->asUser($this->user('admin'));
        $rows = $this->getJson('/api/v1/admin/dashboard/uploaded-by-year')->assertOk()->json('data');
        self::assertCount(0, $rows);
        self::assertSame([], $rows);
        $this->asUser($this->user('faculty'));
        $this->getJson('/api/v1/admin/dashboard/uploaded-by-year')->assertForbidden();
    }
}
