<?php

namespace App\Http\Controllers\Api;

use App\Http\Controllers\Controller;
use Illuminate\Http\Request;

class NotificationController extends Controller
{
    public function index(Request $request)
    {
        return $request->user()
            ->notifications()
            ->take(20)
            ->get()
            ->map(fn ($notification) => [
                'id' => $notification->id,
                'data' => [...($notification->data ?? []), 'title' => $notification->title, 'body' => $notification->body],
                'read_at' => $notification->read_at,
                'created_at' => $notification->created_at,
            ]);
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
