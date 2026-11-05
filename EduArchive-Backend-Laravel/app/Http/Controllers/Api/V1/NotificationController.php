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
     * Notifications are addressed to a recipient through admin_id regardless of
     * that recipient's current role. Any authenticated recipient may read only
     * their own rows.
     */
    public function index(Request $request): JsonResponse
    {
        $notifications = Notification::where('admin_id', $request->user()->id)
            ->with(['relatedUser:id,name', 'relatedCapstone:id,title,slug'])
            ->orderByDesc('created_at')
            ->paginate(min(50, (int) $request->get('per_page', 15)));

        return $this->successResponse($notifications, 'Notifications retrieved.');
    }

    public function unreadCount(Request $request): JsonResponse
    {
        $count = Notification::where('admin_id', $request->user()->id)
            ->where('is_read', false)
            ->count();

        return $this->successResponse(['unread_count' => $count], 'Unread count retrieved.');
    }

    public function markAsRead(Request $request, Notification $notification): JsonResponse
    {
        if ((int) $notification->admin_id !== (int) $request->user()->id) {
            return $this->errorResponse('Unauthorized.', 403);
        }

        $notification->update(['is_read' => true]);

        return $this->successResponse($notification, 'Notification marked as read.');
    }

    public function markAllAsRead(Request $request): JsonResponse
    {
        Notification::where('admin_id', $request->user()->id)
            ->where('is_read', false)
            ->update(['is_read' => true]);

        return $this->successResponse(null, 'All notifications marked as read.');
    }
}
