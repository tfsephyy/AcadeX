<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\AuditLog;
use App\Models\Capstone;
use App\Models\LoginAudit;
use App\Models\User;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class ActivityLogController extends Controller
{
    use ApiResponses;

    /**
     * Get unified activity logs (audit_logs + login_audits).
     * Supports search, filter by type/role/date, user_id, capstone_id, and pagination.
     */
    public function index(Request $request): JsonResponse
    {
        $perPage = (int) $request->get('per_page', 20);
        $page = (int) $request->get('page', 1);

        // Determine which sources to include
        $includeAudit = true;
        $includeLogin = true;

        $category = $request->get('category');
        if ($category) {
            $loginCategories = ['login'];
            $auditCategories = ['upload', 'edit', 'delete', 'download', 'account'];
            if (in_array($category, $loginCategories)) {
                $includeAudit = false;
            } elseif (in_array($category, $auditCategories)) {
                $includeLogin = false;
            }
        }

        // user_id filter narrows to a single user's logs
        $userId = $request->get('user_id');

        // capstone_id filter narrows to logs tied to a specific capstone model
        $capstoneId = $request->get('capstone_id');
        if ($capstoneId) {
            // Capstone logs are only in audit_logs
            $includeLogin = false;
        }

        // Collect all logs in-memory, then sort and paginate
        $allLogs = collect();

        // ── Audit logs ──
        if ($includeAudit) {
            $auditQuery = AuditLog::with(['user.role']);

            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $auditQuery->where(function ($q) use ($search) {
                    $q->whereHas('user', fn($uq) => $uq->where('name', 'like', "%{$search}%"))
                      ->orWhere('action', 'like', "%{$search}%")
                      ->orWhere('old_values', 'like', "%{$search}%")
                      ->orWhere('new_values', 'like', "%{$search}%");
                });
            }

            if ($request->has('role') && $request->role) {
                $role = $request->role;
                $auditQuery->whereHas('user.role', fn($q) => $q->where('name', $role));
            }

            if ($userId) {
                $auditQuery->where('user_id', $userId);
            }

            if ($capstoneId) {
                $auditQuery->where('model_id', $capstoneId)
                           ->where('model_type', 'like', '%Capstone%');
            }

            if ($category) {
                $categoryMap = [
                    'upload'   => ['upload_capstone', 'store_capstone'],
                    'edit'     => ['update_capstone', 'approve_capstone', 'reject_capstone', 'unpublish_capstone', 'archive_capstone', 'unarchive_capstone'],
                    'delete'   => ['delete_capstone', 'delete_user', 'remove_user'],
                    'download' => ['download_capstone'],
                    'account'  => ['approve_user', 'deny_user', 'register', 'archive_user', 'unarchive_user'],
                ];
                if (isset($categoryMap[$category])) {
                    $auditQuery->whereIn('action', $categoryMap[$category]);
                }
            }

            if ($request->has('date_from') && $request->date_from) {
                $auditQuery->where('created_at', '>=', $request->date_from . ' 00:00:00');
            }
            if ($request->has('date_to') && $request->date_to) {
                $auditQuery->where('created_at', '<=', $request->date_to . ' 23:59:59');
            }

            $auditLogs = $auditQuery->orderByDesc('created_at')->get();

            foreach ($auditLogs as $log) {
                $allLogs->push([
                    'id'            => $log->id,
                    'source'        => 'audit',
                    'activity_type' => $log->action,
                    'user_name'     => $log->user?->name ?? 'System',
                    'user_email'    => $log->user?->email ?? '',
                    'user_role'     => $log->user?->role?->name ?? 'unknown',
                    'model_type'    => $log->model_type,
                    'model_id'      => $log->model_id,
                    'old_values'    => $log->old_values,
                    'new_values'    => $log->new_values,
                    'ip_address'    => $log->ip_address,
                    'user_agent'    => $log->user_agent,
                    'activity_date' => $log->created_at,
                ]);
            }
        }

        // ── Login logs ──
        if ($includeLogin) {
            $loginQuery = LoginAudit::with(['user.role']);

            if ($request->has('search') && $request->search) {
                $search = $request->search;
                $loginQuery->where(function ($q) use ($search) {
                    $q->where('email', 'like', "%{$search}%")
                      ->orWhereHas('user', fn($uq) => $uq->where('name', 'like', "%{$search}%"));
                });
            }

            if ($request->has('role') && $request->role) {
                $role = $request->role;
                $loginQuery->whereHas('user.role', fn($q) => $q->where('name', $role));
            }

            if ($userId) {
                $loginQuery->where('user_id', $userId);
            }

            if ($request->has('date_from') && $request->date_from) {
                $loginQuery->where('attempted_at', '>=', $request->date_from . ' 00:00:00');
            }
            if ($request->has('date_to') && $request->date_to) {
                $loginQuery->where('attempted_at', '<=', $request->date_to . ' 23:59:59');
            }

            $loginLogs = $loginQuery->orderByDesc('attempted_at')->get();

            foreach ($loginLogs as $log) {
                $allLogs->push([
                    'id'            => $log->id,
                    'source'        => 'login',
                    'activity_type' => 'login_' . $log->status,
                    'user_name'     => $log->user?->name ?? $log->email,
                    'user_email'    => $log->email ?? $log->user?->email ?? '',
                    'user_role'     => $log->user?->role?->name ?? 'unknown',
                    'model_type'    => null,
                    'model_id'      => null,
                    'old_values'    => null,
                    'new_values'    => null,
                    'ip_address'    => $log->ip_address,
                    'user_agent'    => $log->user_agent,
                    'activity_date' => $log->attempted_at,
                ]);
            }
        }

        // Sort by date descending
        $sorted = $allLogs->sortByDesc('activity_date')->values();

        // Add descriptions and categories
        $sorted = $sorted->map(function ($log) {
            $log['description'] = $this->getDescription((object) $log);
            $log['category'] = $this->getCategory($log['activity_type']);
            return $log;
        });

        // Manual pagination
        $total = $sorted->count();
        $lastPage = max(1, (int) ceil($total / $perPage));
        $page = min($page, $lastPage);
        $offset = ($page - 1) * $perPage;
        $items = $sorted->slice($offset, $perPage)->values();

        $result = [
            'data'         => $items,
            'current_page' => $page,
            'last_page'    => $lastPage,
            'per_page'     => $perPage,
            'total'        => $total,
            'from'         => $total > 0 ? $offset + 1 : 0,
            'to'           => $total > 0 ? min($offset + $perPage, $total) : 0,
        ];

        return $this->successResponse($result, 'Activity logs retrieved.');
    }

    /**
     * Get a list of users who have activity logs, with counts and last-activity date.
     */
    public function usersWithActivity(Request $request): JsonResponse
    {
        $search = $request->get('search', '');

        // Get distinct user_ids from audit_logs (exclude null = system)
        $auditUserIds = AuditLog::whereNotNull('user_id')
            ->select('user_id')
            ->distinct()
            ->pluck('user_id');

        // Get distinct user_ids from login_audits
        $loginUserIds = LoginAudit::whereNotNull('user_id')
            ->select('user_id')
            ->distinct()
            ->pluck('user_id');

        $allUserIds = $auditUserIds->merge($loginUserIds)->unique();

        $usersQuery = User::with('role')
            ->whereIn('id', $allUserIds);

        if ($search) {
            $usersQuery->where(function ($q) use ($search) {
                $q->where('name', 'like', "%{$search}%")
                  ->orWhere('email', 'like', "%{$search}%");
            });
        }

        $users = $usersQuery->get()->map(function ($user) {
            // Count audit logs
            $auditCount = AuditLog::where('user_id', $user->id)->count();
            // Count login logs
            $loginCount = LoginAudit::where('user_id', $user->id)->count();

            // Last activity (most recent of audit or login)
            $lastAudit = AuditLog::where('user_id', $user->id)
                ->latest('created_at')
                ->value('created_at');
            $lastLogin = LoginAudit::where('user_id', $user->id)
                ->latest('attempted_at')
                ->value('attempted_at');

            $lastActivity = null;
            if ($lastAudit && $lastLogin) {
                $lastActivity = $lastAudit > $lastLogin ? $lastAudit : $lastLogin;
            } else {
                $lastActivity = $lastAudit ?? $lastLogin;
            }

            return [
                'id'             => $user->id,
                'name'           => $user->name,
                'email'          => $user->email,
                'role'           => $user->role?->name ?? 'unknown',
                'activity_count' => $auditCount + $loginCount,
                'last_activity'  => $lastActivity,
            ];
        })->sortByDesc('last_activity')->values();

        return $this->successResponse($users, 'Users with activity retrieved.');
    }

    /**
     * Get a list of capstones that have audit log entries, with activity counts.
     */
    public function capstonesWithActivity(Request $request): JsonResponse
    {
        $search = $request->get('search', '');

        // Find distinct capstone IDs referenced in audit_logs
        $capstoneIds = AuditLog::whereNotNull('model_id')
            ->where('model_type', 'like', '%Capstone%')
            ->select('model_id')
            ->distinct()
            ->pluck('model_id');

        $capstonesQuery = Capstone::whereIn('id', $capstoneIds);

        if ($search) {
            $capstonesQuery->where(function ($q) use ($search) {
                $q->where('title', 'like', "%{$search}%")
                  ->orWhere('author', 'like', "%{$search}%")
                  ->orWhere('program', 'like', "%{$search}%");
            });
        }

        $capstones = $capstonesQuery->get()->map(function ($capstone) {
            $activityCount = AuditLog::where('model_id', $capstone->id)
                ->where('model_type', 'like', '%Capstone%')
                ->count();

            $lastActivity = AuditLog::where('model_id', $capstone->id)
                ->where('model_type', 'like', '%Capstone%')
                ->latest('created_at')
                ->value('created_at');

            return [
                'id'             => $capstone->id,
                'title'          => $capstone->title,
                'author'         => $capstone->author,
                'year'           => $capstone->year,
                'program'        => $capstone->program,
                'status'         => $capstone->status,
                'activity_count' => $activityCount,
                'last_activity'  => $lastActivity,
            ];
        })->sortByDesc('last_activity')->values();

        return $this->successResponse($capstones, 'Capstones with activity retrieved.');
    }

    /**
     * Get available activity types for filter dropdown.
     */
    public function types(): JsonResponse
    {
        $auditTypes = AuditLog::distinct()->pluck('action')->toArray();
        $loginTypes = ['login_success', 'login_failed', 'login_locked'];

        $allTypes = array_merge($auditTypes, $loginTypes);
        sort($allTypes);

        return $this->successResponse($allTypes, 'Activity types retrieved.');
    }

    /**
     * Generate human-readable description for an activity log entry.
     */
    private function getDescription(object $log): string
    {
        $user = $log->user_name ?? 'Unknown user';
        $oldValues = is_array($log->old_values) ? $log->old_values : (is_string($log->old_values) ? json_decode($log->old_values, true) : null);
        $newValues = is_array($log->new_values) ? $log->new_values : (is_string($log->new_values) ? json_decode($log->new_values, true) : null);

        return match ($log->activity_type) {
            'upload_capstone', 'store_capstone' => "{$user} uploaded a new capstone project" .
                (!empty($newValues['title']) ? ": \"{$newValues['title']}\"" : ''),

            'update_capstone' => "{$user} edited a capstone project" .
                ($this->formatChanges($oldValues, $newValues)),

            'approve_capstone' => "{$user} approved a capstone project" .
                (!empty($newValues['title']) ? " \"{$newValues['title']}\"" : " #{$log->model_id}"),

            'reject_capstone' => "{$user} rejected a capstone project" .
                (!empty($newValues['title']) ? " \"{$newValues['title']}\"" : " #{$log->model_id}"),

            'delete_capstone' => "{$user} deleted capstone" .
                (!empty($oldValues['title']) ? " \"{$oldValues['title']}\"" : " #{$log->model_id}"),

            'download_capstone' => "{$user} downloaded" .
                (!empty($newValues['title']) ? " \"{$newValues['title']}\"" : " a capstone file"),

            'archive_capstone' => "{$user} archived a capstone project",
            'unarchive_capstone' => "{$user} unarchived a capstone project",
            'unpublish_capstone' => "{$user} unpublished a capstone project",

            'approve_user' => "{$user} approved a user account" .
                (!empty($newValues['name']) ? " for {$newValues['name']}" : ''),

            'deny_user' => "{$user} denied a user account" .
                (!empty($oldValues['name']) ? " for {$oldValues['name']}" : ''),

            'remove_user', 'delete_user' => "{$user} removed a user" .
                (!empty($oldValues['name']) ? " ({$oldValues['name']})" : ''),

            'archive_user' => "{$user} archived a user account" .
                (!empty($newValues['name']) ? " for {$newValues['name']}" : ''),

            'unarchive_user' => "{$user} restored a user account" .
                (!empty($newValues['name']) ? " for {$newValues['name']}" : ''),

            'register' => "New account created: {$user}" .
                (!empty($newValues['role']) ? " ({$newValues['role']})" : ''),

            'login_success' => "{$user} logged in successfully",
            'login_failed' => "Failed login attempt for " . ($log->user_email ?? 'unknown'),
            'login_locked' => "Account locked after multiple failed attempts for " . ($log->user_email ?? 'unknown'),

            default => "{$user} performed {$log->activity_type}",
        };
    }

    /**
     * Format changed fields into a readable string.
     */
    private function formatChanges(?array $old, ?array $new): string
    {
        if (!$old && !$new) return '';

        $changes = [];
        $fields = array_unique(array_merge(array_keys($old ?? []), array_keys($new ?? [])));

        foreach ($fields as $field) {
            if (in_array($field, ['updated_at', 'created_at'])) continue;
            $oldVal = $old[$field] ?? '(empty)';
            $newVal = $new[$field] ?? '(empty)';
            if ($oldVal !== $newVal) {
                $changes[] = $field;
            }
        }

        if (empty($changes)) return '';
        return ' — changed: ' . implode(', ', $changes);
    }

    /**
     * Map activity type to a category for badge coloring.
     */
    private function getCategory(string $type): string
    {
        if (str_contains($type, 'upload') || str_contains($type, 'store')) return 'upload';
        if (str_contains($type, 'delete') || str_contains($type, 'remove')) return 'delete';
        if (str_contains($type, 'update') || str_contains($type, 'approve') || str_contains($type, 'reject') || str_contains($type, 'unpublish') || str_contains($type, 'archive') || str_contains($type, 'unarchive')) return 'edit';
        if (str_contains($type, 'download')) return 'download';
        if (str_contains($type, 'login')) return 'login';
        if (str_contains($type, 'register') || str_contains($type, 'deny') || str_contains($type, 'user')) return 'account';
        return 'other';
    }
}
