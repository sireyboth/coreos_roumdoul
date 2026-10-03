<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use App\Models\Notification;
use Illuminate\Http\Request;

/** The signed-in person's own alerts — never anyone else's. */
class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()
            ->notifications()
            ->with(['actor:id,name', 'resolvedBy:id,name'])
            ->take(30)
            ->get()
            ->map(fn (Notification $notification) => [
                'id' => $notification->id,
                'type' => $notification->notification_type,
                'data' => [...($notification->data ?? []), 'title' => $notification->title, 'body' => $notification->body],
                'link' => $notification->link,
                'actor' => $notification->actor?->name,
                'read_at' => $notification->read_at,
                // Someone already acted on what this alert is about.
                'resolved_at' => $notification->resolved_at,
                'resolution' => $notification->resolution,
                'resolved_by' => $notification->resolvedBy?->name,
                'created_at' => $notification->created_at,
            ]);
    }

    /** Cheap enough to poll: just the number of unread alerts and the newest one's id. */
    public function unreadCount(Request $request)
    {
        $unread = $request->user()->notifications()->whereNull('read_at');

        return [
            'count' => (clone $unread)->count(),
            'latest_id' => (clone $unread)->max('id'),
        ];
    }

    public function markAsRead(Request $request, string $id)
    {
        $notification = $request->user()->notifications()->findOrFail($id);
        $notification->markAsRead();

        return response()->noContent();
    }

    public function markAllAsRead(Request $request)
    {
        $request->user()->notifications()->whereNull('read_at')->update(['read_at' => now()]);

        return response()->noContent();
    }
}
