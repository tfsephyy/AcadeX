<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Role;
use App\Models\User;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

/**
 * Administrator-managed adviser pool.
 *
 * Availability reuses the existing faculty user account. No parallel adviser
 * table or identity is introduced, and deactivating availability never touches
 * historical capstone assignments.
 */
class AdviserController extends Controller
{
    use ApiResponses;

    public function index(Request $request): JsonResponse
    {
        $facultyRoleId = Role::where('name', 'faculty')->value('id');

        $query = User::withCount('advisedCapstones')
            ->where('role_id', $facultyRoleId)
            ->when($request->boolean('include_archived') === false, fn ($q) => $q->where('is_archived', false))
            ->when($request->filled('search'), function ($q) use ($request) {
                $search = $request->search;
                $q->where(function ($inner) use ($search) {
                    $inner->where('name', 'like', "%{$search}%")
                        ->orWhere('email', 'like', "%{$search}%");
                });
            })
            ->when($request->filled('availability'), function ($q) use ($request) {
                $q->where('adviser_available', $request->boolean('availability'));
            })
            ->orderBy('name');

        $faculty = $query->paginate(min(100, (int) $request->get('per_page', 20)))
            ->through(fn (User $user) => [
                'id' => $user->id,
                'name' => $user->name,
                'email' => $user->email,
                'faculty_program' => $user->faculty_program,
                'is_approved' => $user->is_approved,
                'is_archived' => $user->is_archived,
                'adviser_available' => $user->adviser_available,
                'assigned_capstones_count' => $user->advised_capstones_count,
            ]);

        return $this->successResponse($faculty, 'Advisers retrieved.');
    }

    /**
     * Add an eligible faculty account to the adviser pool or update its state.
     * Deactivation only changes availability; assignments are preserved.
     */
    public function updateAvailability(Request $request, User $user): JsonResponse
    {
        if (!$user->hasRole('faculty')) {
            return $this->errorResponse('Only faculty accounts can be added to the adviser pool.', 422);
        }

        $validated = $request->validate([
            'adviser_available' => ['required', 'boolean'],
        ]);

        if ($validated['adviser_available'] && (!$user->is_approved || $user->is_archived)) {
            return $this->errorResponse('Approve and reactivate the faculty account before making it available as an adviser.', 422);
        }

        $user->update(['adviser_available' => (bool) $validated['adviser_available']]);
        AuditLog::log(
            $validated['adviser_available'] ? 'adviser_activated' : 'adviser_deactivated',
            $request->user()->id,
            User::class,
            $user->id
        );

        return $this->successResponse([
            'id' => $user->id,
            'name' => $user->name,
            'adviser_available' => $user->adviser_available,
        ], $user->adviser_available
            ? 'Faculty account is now available as an adviser.'
            : 'Faculty account is no longer offered as an adviser. Existing assignments are unchanged.');
    }
}
