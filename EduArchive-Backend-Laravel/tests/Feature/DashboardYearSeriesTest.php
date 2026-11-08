<?php

namespace Tests\Feature;

use Tests\SecurityTestCase;

class DashboardYearSeriesTest extends SecurityTestCase
{
    public function test_upload_year_counts_dates_instead_of_academic_years_and_fills_gaps(): void
    {
        $admin = $this->user('admin');
        $owner = $this->user('student');
        $year = now()->year;
        foreach ([
            [$year - 6, 'approved', false], // Outside the six-year window.
            [$year - 5, 'approved', false],
            [$year - 3, 'pending', false],
            [$year, 'approved', false],
            [$year, 'rejected', true], // Counted in Uploaded, excluded from Approved.
            [$year + 1, 'approved', false],
        ] as [$uploadedYear, $status, $archived]) {
            $record = $this->capstone($owner, ['year' => 2001, 'status' => $status,
                'approval_status' => $status, 'is_archived' => $archived]);
            $record->forceFill(['created_at' => $uploadedYear.'-01-01 00:00:00'])->save();
        }
        $this->asUser($admin);
        $expected = [];
        for ($value = $year - 5; $value <= $year; $value++) {
            $expected[] = ['year' => $value, 'count' => match ($value) {
                $year - 5, $year - 3 => 1, $year => 2, default => 0,
            }];
        }
        $this->getJson('/api/v1/admin/dashboard/uploaded-by-year')->assertOk()->assertExactJson([
            'success' => true, 'message' => 'Uploaded capstones by year.', 'data' => $expected,
        ]);
        $approved = $expected;
        foreach ($approved as &$entry) $entry['count'] = in_array($entry['year'], [$year - 5, $year], true) ? 1 : 0;
        $this->getJson('/api/v1/admin/dashboard/approved-by-year')->assertOk()->assertJsonPath('data', $approved);
        $this->getJson('/api/v1/admin/dashboard/stats')->assertOk()->assertJsonPath('data.uploaded', 6);
    }

    public function test_empty_repository_returns_six_zeroes_and_dashboard_remains_admin_only(): void
    {
        $this->asUser($this->user('admin'));
        $rows = $this->getJson('/api/v1/admin/dashboard/uploaded-by-year')->assertOk()->json('data');
        self::assertCount(6, $rows);
        self::assertSame(array_fill(0, 6, 0), array_column($rows, 'count'));
        self::assertSame(range(now()->year - 5, now()->year), array_column($rows, 'year'));
        $this->asUser($this->user('faculty'));
        $this->getJson('/api/v1/admin/dashboard/uploaded-by-year')->assertForbidden();
    }
}
