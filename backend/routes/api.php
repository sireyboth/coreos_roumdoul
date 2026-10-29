<?php

use App\Http\Controllers\Api\Account\AuthController;
use App\Http\Controllers\Api\Organization\EmployeePhotoController;
use App\Http\Controllers\Api\Requests\EmployeeRequestController;
use App\Http\Middleware\CatchUpAttendance;
use App\Http\Middleware\EnsureCompanyIsActive;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'time' => now()->toIso8601String(),
    ]);
});

// Photos load through <img> tags, which can't send a login header — so this one
// route is reached with a short-lived signed link instead (relative, so it
// keeps working behind proxies that change the host or scheme).
Route::get('/employees/{employee}/photo', [EmployeePhotoController::class, 'show'])
    ->middleware('signed:relative')
    ->name('employees.photo');

// A request's file (e.g. a medical certificate) opens in a new tab, which
// can't send a login header either: the same kind of short-lived signed link.
Route::get('/attachments/{attachment}', [EmployeeRequestController::class, 'attachment'])
    ->middleware('signed:relative')
    ->whereNumber('attachment')
    ->name('attachments.show');

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login'])->middleware('throttle:login');

Route::middleware(['auth:sanctum'])->group(function () {
    // Always reachable even for a paused company, so a user can still see
    // why they're locked out (via /me's company.status) and log out cleanly.
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

// Everything below needs a signed-in user of an active company. Each module
// has its own file in routes/api/ — add a new module as a new file here.
Route::middleware(['auth:sanctum', EnsureCompanyIsActive::class, CatchUpAttendance::class])->group(function () {
    require __DIR__.'/api/account.php';
    require __DIR__.'/api/organization.php';
    require __DIR__.'/api/schedules.php';
    require __DIR__.'/api/access.php';
    require __DIR__.'/api/payroll.php';
    require __DIR__.'/api/attendance.php';
    require __DIR__.'/api/requests.php';
});
