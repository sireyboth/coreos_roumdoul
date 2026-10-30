<?php

// Your own account: profile, notifications, push and the help assistant.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Account\AiAssistantController;
use App\Http\Controllers\Api\Account\NotificationController;
use App\Http\Controllers\Api\Account\ProfileController;
use App\Http\Controllers\Api\Account\ProfilePhotoController;
use App\Http\Controllers\Api\Account\PushSubscriptionController;
use Illuminate\Support\Facades\Route;

Route::put('/profile', [ProfileController::class, 'update']);
Route::put('/profile/password', [ProfileController::class, 'updatePassword']);
// Your own photo: no HR permission needed, it only touches your own employee record.
Route::post('/profile/photo', [ProfilePhotoController::class, 'store']);
Route::delete('/profile/photo', [ProfilePhotoController::class, 'destroy']);

Route::get('/notifications', [NotificationController::class, 'index']);
Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

// Help assistant: sold as a module. Every member of a company that has
// it may ask, so no permission gate. Trials are refused in the controller.
Route::post('/ai/assistant', [AiAssistantController::class, 'ask'])->middleware('module:'.AiAssistantController::MODULE);

Route::get('/push/key', [PushSubscriptionController::class, 'key']);
Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store']);
Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy']);
