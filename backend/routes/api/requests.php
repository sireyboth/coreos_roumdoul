<?php

// Leave and other requests, plus leave policies. Part of the attendance module.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Requests\EmployeeRequestController;
use App\Http\Controllers\Api\Requests\LeaveController;
use Illuminate\Support\Facades\Route;

Route::middleware('module:attendance')->group(function () {
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
        Route::post('/requests/{employeeRequest}/paid-days', [EmployeeRequestController::class, 'editPay'])->whereNumber('employeeRequest');
        Route::post('/requests/{employeeRequest}/change-type', [EmployeeRequestController::class, 'changeType'])->whereNumber('employeeRequest');
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
