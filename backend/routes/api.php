<?php

use App\Http\Controllers\Api\AttendanceController;
use App\Http\Controllers\Api\AttendanceCorrectionController;
use App\Http\Controllers\Api\AttendanceReviewController;
use App\Http\Controllers\Api\AuthController;
use App\Http\Controllers\Api\BranchController;
use App\Http\Controllers\Api\CalendarController;
use App\Http\Controllers\Api\DashboardController;
use App\Http\Controllers\Api\DayOffController;
use App\Http\Controllers\Api\DepartmentController;
use App\Http\Controllers\Api\EmployeeCardController;
use App\Http\Controllers\Api\EmployeeController;
use App\Http\Controllers\Api\EmployeePhotoController;
use App\Http\Controllers\Api\EmployeeRequestController;
use App\Http\Controllers\Api\HolidayController;
use App\Http\Controllers\Api\LeaveController;
use App\Http\Controllers\Api\NotificationController;
use App\Http\Controllers\Api\ProfileController;
use App\Http\Controllers\Api\PushSubscriptionController;
use App\Http\Controllers\Api\RoleController;
use App\Http\Controllers\Api\ScheduleAssignmentController;
use App\Http\Controllers\Api\ScheduleController;
use App\Http\Controllers\Api\TeamController;
use App\Http\Controllers\Api\UserController;
use App\Http\Controllers\Api\WorkLocationController;
use App\Http\Controllers\Api\WorkScheduleController;
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

Route::middleware(['auth:sanctum', EnsureCompanyIsActive::class])->group(function () {
    Route::put('/profile', [ProfileController::class, 'update']);
    Route::put('/profile/password', [ProfileController::class, 'updatePassword']);

    Route::get('/notifications', [NotificationController::class, 'index']);
    Route::get('/notifications/unread-count', [NotificationController::class, 'unreadCount']);
    Route::post('/notifications/{id}/read', [NotificationController::class, 'markAsRead']);
    Route::post('/notifications/read-all', [NotificationController::class, 'markAllAsRead']);

    Route::get('/push/key', [PushSubscriptionController::class, 'key']);
    Route::post('/push/subscriptions', [PushSubscriptionController::class, 'store']);
    Route::delete('/push/subscriptions', [PushSubscriptionController::class, 'destroy']);

    foreach ([
        'branches' => BranchController::class,
        'departments' => DepartmentController::class,
        'teams' => TeamController::class,
        'employees' => EmployeeController::class,
        'work_locations' => WorkLocationController::class,
        'work_schedules' => WorkScheduleController::class,
        'holidays' => HolidayController::class,
        'schedules' => ScheduleController::class,
    ] as $uri => $controller) {
        Route::apiResource($uri, $controller)
            ->middlewareFor(['index', 'show'], "company_permission:{$uri}.view")
            ->middlewareFor(['store', 'update', 'destroy'], "company_permission:{$uri}.manage");
    }

    Route::middleware('company_permission:departments.manage')->group(function () {
        Route::post('/departments/{department}/members', [DepartmentController::class, 'addMembers']);
        Route::delete('/departments/{department}/members/{employee}', [DepartmentController::class, 'removeMember']);
    });

    Route::middleware('company_permission:teams.manage')->group(function () {
        Route::post('/teams/{team}/members', [TeamController::class, 'addMembers']);
        Route::delete('/teams/{team}/members/{employee}', [TeamController::class, 'removeMember']);
    });

    Route::get('/dashboard/summary', [DashboardController::class, 'summary'])->middleware('company_permission:dashboard.view');

    Route::post('/schedules/bulk', [ScheduleController::class, 'bulk'])->middleware('company_permission:schedules.manage');

    Route::post('/holidays/import', [HolidayController::class, 'import'])->middleware('company_permission:holidays.manage');

    Route::middleware('company_permission:work_locations.manage')->group(function () {
        Route::post('/work_locations/{work_location}/regenerate-qr', [WorkLocationController::class, 'regenerateQrCode']);
    });

    Route::get('/calendar', [CalendarController::class, 'index'])->middleware('company_permission:schedules.view');

    // Who follows which work schedule, and from when. Part of the roster, so the same permissions.
    Route::get('/schedule-assignments', [ScheduleAssignmentController::class, 'index'])->middleware('company_permission:schedules.view');
    Route::middleware('company_permission:schedules.manage')->group(function () {
        Route::post('/schedule-assignments', [ScheduleAssignmentController::class, 'store']);
        Route::post('/schedule-assignments/bulk', [ScheduleAssignmentController::class, 'bulk']);
        Route::put('/schedule-assignments/{schedule_assignment}', [ScheduleAssignmentController::class, 'update']);
        Route::delete('/schedule-assignments/{schedule_assignment}', [ScheduleAssignmentController::class, 'destroy']);
    });

    Route::middleware('company_permission:schedules.manage')->group(function () {
        Route::get('/calendar/team', [CalendarController::class, 'team']);
        Route::post('/days-off', [DayOffController::class, 'store']);
        Route::delete('/days-off/{day_off}', [DayOffController::class, 'destroy']);
    });

    Route::middleware('company_permission:employees.manage')->group(function () {
        Route::post('/employees/bulk-delete', [EmployeeController::class, 'bulkDestroy']);
        Route::post('/employees/{employee}/photo', [EmployeePhotoController::class, 'store']);
        Route::delete('/employees/{employee}/photo', [EmployeePhotoController::class, 'destroy']);
        Route::post('/employees/{employee}/login', [EmployeeController::class, 'createLogin']);
    });

    Route::middleware('company_permission:branches.manage')->group(function () {
        Route::post('/branches/{branch}/regenerate-qr', [BranchController::class, 'regenerateQrCode']);
    });

    Route::middleware(['module:id_cards', 'company_permission:employees.view'])->group(function () {
        Route::get('/employees/{employee}/card', [EmployeeCardController::class, 'show']);
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
            Route::get('/attendance/export', [AttendanceController::class, 'export']);
            Route::get('/attendance/today', [AttendanceController::class, 'today']);
            Route::post('/attendance/scan', [AttendanceController::class, 'scan']);
            // Older app versions: both are now a plain scan.
            Route::post('/attendance/check-in', [AttendanceController::class, 'checkIn']);
            Route::post('/attendance/check-out', [AttendanceController::class, 'checkOut']);
            Route::get('/attendance/corrections', [AttendanceCorrectionController::class, 'index']);
            Route::post('/attendance/corrections', [AttendanceCorrectionController::class, 'store']);
            // The employee withdraws their own; a manager can cancel one with a remark.
            Route::post('/attendance/corrections/{correction}/cancel', [AttendanceCorrectionController::class, 'cancel']);
            // Everyone gets their own row; managers get everyone's.
            Route::get('/attendance/summary', [AttendanceReviewController::class, 'summary']);
            Route::get('/attendance/periods', [AttendanceReviewController::class, 'periods']);
        });

        Route::middleware('company_permission:attendance.manage')->group(function () {
            Route::post('/attendance/corrections/{correction}/approve', [AttendanceCorrectionController::class, 'approve']);
            Route::post('/attendance/corrections/{correction}/reject', [AttendanceCorrectionController::class, 'reject']);
            Route::post('/attendance/adjustments', [AttendanceController::class, 'adjust']);
            Route::post('/attendance/days/delete', [AttendanceController::class, 'destroyDays']);
            Route::post('/attendance/days/fill-missed', [AttendanceController::class, 'fillMissed']);
            Route::get('/attendance/overtime', [AttendanceReviewController::class, 'overtime']);
            Route::post('/attendance/days/{day}/overtime/approve', [AttendanceReviewController::class, 'approveOvertime']);
            Route::post('/attendance/days/{day}/overtime/reject', [AttendanceReviewController::class, 'rejectOvertime']);
            Route::post('/attendance/periods', [AttendanceReviewController::class, 'lock']);
            Route::delete('/attendance/periods/{month}', [AttendanceReviewController::class, 'unlock'])->where('month', '\d{4}-\d{2}');
        });

        // Leave and other requests. Sending and following your own needs only
        // requests.view; who may decide one is checked per request (a line
        // manager decides their team's without extra permissions).
        Route::middleware('company_permission:requests.view')->group(function () {
            Route::get('/leave-types', [LeaveController::class, 'types']);
            Route::get('/leave-balances', [LeaveController::class, 'balances']);
            Route::get('/request-settings/{type}', [LeaveController::class, 'settings']);
            Route::get('/requests', [EmployeeRequestController::class, 'index']);
            Route::get('/requests/waiting-count', [EmployeeRequestController::class, 'waitingCount']);
            Route::post('/requests/preview', [EmployeeRequestController::class, 'preview']);
            Route::post('/requests', [EmployeeRequestController::class, 'store']);
            Route::post('/requests/delete', [EmployeeRequestController::class, 'destroyMany'])->middleware('company_permission:requests.manage');
            Route::get('/requests/{employeeRequest}', [EmployeeRequestController::class, 'show'])->whereNumber('employeeRequest');
            Route::post('/requests/{employeeRequest}/approve', [EmployeeRequestController::class, 'approve'])->whereNumber('employeeRequest');
            Route::post('/requests/{employeeRequest}/reject', [EmployeeRequestController::class, 'reject'])->whereNumber('employeeRequest');
            Route::post('/requests/{employeeRequest}/cancel', [EmployeeRequestController::class, 'cancel'])->whereNumber('employeeRequest');
        });

        Route::middleware('company_permission:leave_policies.manage')->group(function () {
            Route::post('/leave-types', [LeaveController::class, 'storeType']);
            Route::put('/leave-types/{leaveType}', [LeaveController::class, 'updateType']);
            Route::get('/leave-adjustments', [LeaveController::class, 'adjustments']);
            Route::post('/leave-adjustments', [LeaveController::class, 'adjust']);
            Route::put('/request-settings/{type}', [LeaveController::class, 'updateSettings']);
        });
    });
});
