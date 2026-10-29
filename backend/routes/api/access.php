<?php

// Who can do what: users, roles, the audit log and company settings.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Access\AuditLogController;
use App\Http\Controllers\Api\Access\CompanySettingsController;
use App\Http\Controllers\Api\Access\RoleController;
use App\Http\Controllers\Api\Access\UserController;
use Illuminate\Support\Facades\Route;

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

// Read-only. Limited to the viewer's branches and, for pay, to people who can see pay.
Route::middleware('company_permission:audit.view')->group(function () {
    Route::get('/audit-logs', [AuditLogController::class, 'index']);
    Route::get('/audit-logs/options', [AuditLogController::class, 'options']);
});

Route::put('/company/settings', [CompanySettingsController::class, 'update'])->middleware('company_permission:company.manage');

Route::middleware('company_permission:roles.view')->group(function () {
    Route::get('/roles', [RoleController::class, 'index']);
    Route::get('/permissions', [RoleController::class, 'permissions']);
});

Route::middleware('company_permission:roles.manage')->group(function () {
    Route::post('/roles', [RoleController::class, 'store']);
    Route::put('/roles/{role}', [RoleController::class, 'update']);
    Route::delete('/roles/{role}', [RoleController::class, 'destroy']);
});
