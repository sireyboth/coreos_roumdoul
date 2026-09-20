<?php

use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AttendanceCorrectionController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\HolidayController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\ShiftController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkLocationController;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Route;

Route::get('/health', function () {
    return response()->json([
        'status' => 'ok',
        'app' => config('app.name'),
        'time' => now()->toIso8601String(),
    ]);
});

Route::post('/auth/register', [AuthController::class, 'register']);
Route::post('/auth/login', [AuthController::class, 'login']);

Route::middleware(['auth:sanctum'])->group(function () {
    // Always reachable even for a paused company, so a user can still see
    // why they're locked out (via /me's company.status) and log out cleanly.
    Route::get('/user', function (Request $request) {
        return $request->user();
    });

    Route::get('/me', [AuthController::class, 'me']);
    Route::post('/auth/logout', [AuthController::class, 'logout']);
});

Route::middleware(['auth:sanctum', \App\Http\Middleware\EnsureCompanyIsActive::class])->group(function () {
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    foreach ([
        'branches' => BranchController::class,
        'departments' => DepartmentController::class,
        'teams' => TeamController::class,
        'employees' => EmployeeController::class,
        'work_locations' => WorkLocationController::class,
        'shifts' => ShiftController::class,
        'holidays' => HolidayController::class,
        'schedules' => ScheduleController::class,
    ] as $uri => $controller) {
        Route::apiResource($uri, $controller)
            ->middlewareFor(['index', 'show'], "company_permission:{$uri}.view")
            ->middlewareFor(['store', 'update', 'destroy'], "company_permission:{$uri}.manage");
    }

    Route::middleware('company_permission:branches.manage')->group(function () {
        Route::post('/branches/{branch}/regenerate-qr', [BranchController::class, 'regenerateQrCode']);
    });

    Route::middleware('company_permission:users.view')->group(function () {
        Route::get('/users', [UserController::class, 'index']);
    });

    Route::middleware('company_permission:users.manage')->group(function () {
        Route::post('/users', [UserController::class, 'store']);
        Route::put('/users/{user}', [UserController::class, 'update']);
        Route::patch('/users/{user}/active', [UserController::class, 'setActive']);
        Route::put('/users/{user}/branch-access', [UserController::class, 'setBranchAccess']);
        Route::delete('/users/{user}', [UserController::class, 'destroy']);
    });

    Route::middleware('company_permission:roles.view')->group(function () {
        Route::get('/roles', [RoleController::class, 'index']);
        Route::get('/permissions', [RoleController::class, 'permissions']);
    });

    Route::middleware('company_permission:roles.manage')->group(function () {
        Route::post('/roles', [RoleController::class, 'store']);
        Route::put('/roles/{role}', [RoleController::class, 'update']);
        Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
    });

    Route::middleware('module:attendance')->group(function () {
        Route::middleware('company_permission:attendance.view')->group(function () {
            Route::get('/attendance', [AttendanceController::class, 'index']);
            Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
            Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);
            Route::get('/attendance/corrections', [AttendanceCorrectionController::class, 'index']);
            Route::post('/attendance/corrections', [AttendanceCorrectionController::class, 'store']);
        });

        Route::middleware('company_permission:attendance.manage')->group(function () {
            Route::post('/attendance/corrections/{correction}/approve', [AttendanceCorrectionController::class, 'approve']);
            Route::post('/attendance/corrections/{correction}/reject', [AttendanceCorrectionController::class, 'reject']);
        });
    });
});
