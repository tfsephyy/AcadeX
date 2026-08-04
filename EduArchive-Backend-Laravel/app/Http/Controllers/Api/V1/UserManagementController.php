<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Mail;

class UserManagementController extends Controller
{
    use ApiResponses;

    /**
     * Get new (unapproved) users.
     */
    public function newUsers(Request $request): JsonResponse
    {
        $query = User::with(['role', 'studentProfile'])
            ->where('is_approved', false)
            ->whereHas('role', fn($q) => $q->whereIn('name', ['student', 'faculty']))
            ->orderByDesc('created_at');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('id_number', 'like', "%{$search}%");
            });
        }

        $users = $query->paginate($request->get('per_page', 15));

        return $this->successResponse($users, 'New users retrieved.');
    }

    /**
     * Get all approved students (excluding archived).
     */
    public function students(Request $request): JsonResponse
    {
        $studentRoleId = Role::where('name', 'student')->value('id');

        $query = User::with(['studentProfile'])
            ->where('role_id', $studentRoleId)
            ->where('is_approved', true)
            ->where('is_archived', false);

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('id_number', 'like', "%{$search}%");
            });
        }

        // Filter by program (via student profile)
        if ($request->has('program') && $request->program) {
            $program = $request->program;
            $query->whereHas('studentProfile', function ($q) use ($program) {
                $q->where('program', $program);
            });
        }

        $students = $query->orderBy('name')->paginate($request->get('per_page', 15));

        return $this->successResponse($students, 'Students retrieved.');
    }

    /**
     * Get all approved faculty (excluding archived).
     */
    public function faculty(Request $request): JsonResponse
    {
        $facultyRoleId = Role::where('name', 'faculty')->value('id');

        $query = User::where('role_id', $facultyRoleId)
            ->where('is_approved', true)
            ->where('is_archived', false);

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $faculty = $query->orderBy('name')->paginate($request->get('per_page', 15));

        return $this->successResponse($faculty, 'Faculty retrieved.');
    }

    /**
     * View a specific user.
     */
    public function show(User $user): JsonResponse
    {
        $user->load(['role', 'studentProfile']);

        return $this->successResponse($user, 'User retrieved.');
    }

    /**
     * Approve (accept) a new user.
     */
    public function approve(Request $request, User $user): JsonResponse
    {
        if ($user->is_approved) {
            return $this->errorResponse('User is already approved.', 400);
        }

        $user->update(['is_approved' => true]);

        AuditLog::log('approve_user', $request->user()->id, User::class, $user->id);

        // Send approval email to user
        try {
            Mail::raw(
                "Hello {$user->name},\n\n" .
                "Your account has been approved! You can now log in to EduArchive.\n\n" .
                "Email: {$user->email}\n" .
                "Role: {$user->role->name}\n\n" .
                "Welcome to EduArchive!\n\n" .
                "Best regards,\n" .
                "EduArchive Admin Team",
                function ($message) use ($user) {
                    $message->to($user->email)
                            ->subject('Account Approved - Welcome to EduArchive');
                }
            );
        } catch (\Exception $e) {
            // Log email error but don't fail the approval
            \Log::error('Failed to send approval email to ' . $user->email . ': ' . $e->getMessage());
        }

        return $this->successResponse($user, 'User approved and notification sent.');
    }

    /**
     * Deny (reject) a new user.
     */
    public function deny(Request $request, User $user): JsonResponse
    {
        AuditLog::log(
            'deny_user',
            $request->user()->id,
            User::class,
            $user->id,
            ['name' => $user->name, 'email' => $user->email]
        );

        // Delete user and profile
        $user->studentProfile()?->delete();
        $user->tokens()->delete();
        $user->delete();

        return $this->successResponse(null, 'User denied and removed.');
    }

    /**
     * Archive user (soft removal — user is hidden but not deleted).
     */
    public function archive(Request $request, User $user): JsonResponse
    {
        if ($user->isAdmin()) {
            return $this->errorResponse('Cannot archive admin account.', 403);
        }

        $user->update(['is_archived' => true]);

        AuditLog::log(
            'archive_user',
            $request->user()->id,
            User::class,
            $user->id,
            ['name' => $user->name, 'email' => $user->email]
        );

        return $this->successResponse(null, 'User archived successfully.');
    }

    /**
     * Unarchive user (restore from archive).
     */
    public function unarchive(Request $request, User $user): JsonResponse
    {
        $user->update(['is_archived' => false]);

        AuditLog::log(
            'unarchive_user',
            $request->user()->id,
            User::class,
            $user->id,
            ['name' => $user->name, 'email' => $user->email]
        );

        return $this->successResponse(null, 'User restored successfully.');
    }

    /**
     * Get archived users.
     */
    public function archivedUsers(Request $request): JsonResponse
    {
        $query = User::with(['role', 'studentProfile'])
            ->where('is_archived', true)
            ->whereHas('role', fn($q) => $q->whereIn('name', ['student', 'faculty']))
            ->orderByDesc('updated_at');

        if ($request->has('search') && $request->search) {
            $search = $request->search;
            $query->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%")
                  ->orWhere('id_number', 'like', "%{$search}%");
            });
        }

        $users = $query->paginate($request->get('per_page', 15));

        return $this->successResponse($users, 'Archived users retrieved.');
    }

    /**
     * Remove account (permanently delete — for archived users).
     */
    public function remove(Request $request, User $user): JsonResponse
    {
        if ($user->isAdmin()) {
            return $this->errorResponse('Cannot remove admin account.', 403);
        }

        AuditLog::log(
            'remove_user',
            $request->user()->id,
            User::class,
            $user->id,
            ['name' => $user->name, 'email' => $user->email]
        );

        $user->studentProfile()?->delete();
        $user->tokens()->delete();
        $user->delete();

        return $this->successResponse(null, 'User account removed.');
    }
}
