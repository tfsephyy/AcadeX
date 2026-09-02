<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Capstone;
use App\Models\Role;
use App\Models\User;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Support\Facades\DB;

class AdminDashboardController extends Controller
{
    use ApiResponses;

    /**
     * Get dashboard statistics.
     */
    public function stats(): JsonResponse
    {
        $studentRoleId = Role::where('name', 'student')->value('id');
        $facultyRoleId = Role::where('name', 'faculty')->value('id');
        $visitorRoleId = Role::where('name', 'visitor')->value('id');

        $data = [
            'students'  => User::where('role_id', $studentRoleId)->where('is_approved', true)->count(),
            'faculty'   => User::where('role_id', $facultyRoleId)->where('is_approved', true)->count(),
            'visitors'  => User::where('role_id', $visitorRoleId)->where('is_approved', true)->count(),
            'uploaded'  => Capstone::count(),
        ];

        return $this->successResponse($data, 'Dashboard stats retrieved.');
    }

    /**
     * Get uploaded capstones by year (bar chart) - 6 most recent years.
     */
    public function uploadedByYear(): JsonResponse
    {
        $data = Capstone::select('year', DB::raw('COUNT(*) as count'))
            ->groupBy('year')
            ->orderByDesc('year')
            ->limit(6)
            ->get();

        return $this->successResponse($data, 'Uploaded capstones by year.');
    }

    /**
     * Get approved capstones by year (bar chart).
     */
    public function approvedByYear(): JsonResponse
    {
        $data = Capstone::select('year', DB::raw('COUNT(*) as count'))
            ->groupBy('year')
            ->orderByDesc('year')
            ->limit(6)
            ->get();

        return $this->successResponse($data, 'Approved capstones by year.');
    }

    /**
     * Get students per year level (bar chart).
     */
    public function studentsPerYear(): JsonResponse
    {
        $data = DB::table('student_profiles')
            ->join('users', 'student_profiles.user_id', '=', 'users.id')
            ->where('users.is_approved', true)
            ->select('student_profiles.year', DB::raw('COUNT(*) as count'))
            ->groupBy('student_profiles.year')
            ->orderBy('student_profiles.year')
            ->get();

        return $this->successResponse($data, 'Students per year level.');
    }

    /**
     * Get recent capstones.
     */
    public function recentApproved(): JsonResponse
    {
        $data = Capstone::with(['keywords', 'uploader:id,name'])
            ->published()
            ->orderByDesc('created_at')
            ->limit(10)
            ->get();

        return $this->successResponse($data, 'Recent approved capstones.');
    }

    /**
     * Get the top 5 most-viewed capstones (unique views per user).
     */
    public function mostViewed(): JsonResponse
    {
        $data = Capstone::with(['uploader:id,name'])
            ->withCount(['views as unique_views' => function ($q) {
                $q->whereNotNull('user_id');
            }])
            ->orderByDesc('unique_views')
            ->limit(5)
            ->get()
            ->map(fn($c) => [
                'id'           => $c->id,
                'title'        => $c->title,
                'author'       => $c->author,
                'year'         => $c->year,
                'program'      => $c->program,
                'unique_views' => $c->unique_views,
                'uploader'     => $c->uploader?->name,
            ]);

        return $this->successResponse($data, 'Most viewed capstones.');
    }

    /**
     * Get the top 5 most-cited capstones (referenced by other capstones).
     */
    public function mostCited(): JsonResponse
    {
        $data = Capstone::with(['uploader:id,name'])
            ->withCount('referencedBy as citation_count')
            ->orderByDesc('citation_count')
            ->having('citation_count', '>', 0)
            ->limit(5)
            ->get()
            ->map(fn($c) => [
                'id'             => $c->id,
                'title'          => $c->title,
                'author'         => $c->author,
                'year'           => $c->year,
                'program'        => $c->program,
                'citation_count' => $c->citation_count,
                'uploader'       => $c->uploader?->name,
            ]);

        return $this->successResponse($data, 'Most cited capstones.');
    }
}
