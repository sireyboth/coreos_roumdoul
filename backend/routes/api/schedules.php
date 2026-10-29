<?php

// Rosters: schedules, schedule assignments, days off and the calendar.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Schedules\CalendarController;
use App\Http\Controllers\Api\Schedules\DayOffController;
use App\Http\Controllers\Api\Schedules\ScheduleAssignmentController;
use App\Http\Controllers\Api\Schedules\ScheduleController;
use Illuminate\Support\Facades\Route;

Route::post('/schedules/bulk', [ScheduleController::class, 'bulk'])->middleware('company_permission:schedules.manage');

Route::get('/calendar', [CalendarController::class, 'index'])->middleware('company_permission:schedules.view');
// Just the days something happens (holidays, days off, leave, absences) over up to a year.
Route::get('/calendar/events', [CalendarController::class, 'events'])->middleware('company_permission:schedules.view');

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
