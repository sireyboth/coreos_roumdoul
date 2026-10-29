<?php

// Attendance module: scans, corrections, adjustments, overtime and month close.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Attendance\AttendanceController;
use App\Http\Controllers\Api\Attendance\AttendanceCorrectionController;
use App\Http\Controllers\Api\Attendance\AttendanceReviewController;
use Illuminate\Support\Facades\Route;

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

});
