<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    use ApiResponses;

    /**
     * Get all notifications for the authenticated admin.
     */
    public function index(Request $request): JsonResponse
    {
        // Only admins can see notifications
        if (!$request->user() || !$request->user()->hasRole('admin')) {
            return $this->errorResponse('Only admins can access notifications.', 403);
        }

        $notifications = Notification::where('admin_id', $request->user()->id)
            ->with(['relatedUser', 'relatedCapstone'])
            ->orderByDesc('created_at')
            ->paginate($request->get('per_page', 15));

        return $this->successResponse($notifications, 'Notifications retrieved.');
    }

    /**
     * Get unread notification count for the authenticated admin.
     */
    public function unreadCount(Request $request): JsonResponse
    {
        if (!$request->user() || !$request->user()->hasRole('admin')) {
            return $this->errorResponse('Only admins can access notifications.', 403);
        }

        $count = Notification::where('admin_id', $request->user()->id)
            ->where('is_read', false)
            ->count();

        return $this->successResponse(['unread_count' => $count], 'Unread count retrieved.');
    }

    /**
     * Mark a notification as read.
     */
    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        if (!$request->user() || !$request->user()->hasRole('admin')) {
            return $this->errorResponse('Only admins can access notifications.', 403);
        }

        if ($notification->admin_id !== $request->user()->id) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        $notification->update(['is_read' => true]);

        return $this->successResponse($notification, 'Notification marked as read.');
    }

    /**
     * Mark all notifications as read.
     */
    public function markAllAsRead(Request $request): JsonResponse
    {
        if (!$request->user() || !$request->user()->hasRole('admin')) {
            return $this->errorResponse('Only admins can access notifications.', 403);
        }

        Notification::where('admin_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return $this->successResponse(null, 'All notifications marked as read.');
    }
}
