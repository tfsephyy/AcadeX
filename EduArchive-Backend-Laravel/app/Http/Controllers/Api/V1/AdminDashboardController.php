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

        $data = [
            'students'  => User::where('role_id', $studentRoleId)->where('is_approved', true)->count(),
            'faculty'   => User::where('role_id', $facultyRoleId)->where('is_approved', true)->count(),
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
}
