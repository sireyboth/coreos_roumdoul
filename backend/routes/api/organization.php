<?php

// Company structure and people: branches, departments, teams, work locations,
// employees, holidays, the dashboard, birthdays and ID cards.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Organization\BirthdayController;
use App\Http\Controllers\Api\Organization\BranchController;
use App\Http\Controllers\Api\Organization\DashboardController;
use App\Http\Controllers\Api\Organization\DepartmentController;
use App\Http\Controllers\Api\Organization\EmployeeCardController;
use App\Http\Controllers\Api\Organization\EmployeeController;
use App\Http\Controllers\Api\Organization\EmployeePhotoController;
use App\Http\Controllers\Api\Organization\HolidayController;
use App\Http\Controllers\Api\Organization\ProbationController;
use App\Http\Controllers\Api\Organization\TeamController;
use App\Http\Controllers\Api\Organization\WorkLocationController;
use App\Http\Controllers\Api\Schedules\ScheduleController;
use App\Http\Controllers\Api\Schedules\WorkScheduleController;
use Illuminate\Support\Facades\Route;

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

Route::post('/holidays/import', [HolidayController::class, 'import'])->middleware('company_permission:holidays.manage');

Route::middleware('company_permission:work_locations.manage')->group(function () {
    Route::post('/work_locations/{work_location}/regenerate-qr', [WorkLocationController::class, 'regenerateQrCode']);
});

Route::middleware('company_permission:employees.manage')->group(function () {
    Route::post('/employees/bulk-delete', [EmployeeController::class, 'bulkDestroy']);
    Route::post('/employees/{employee}/photo', [EmployeePhotoController::class, 'store']);
    Route::delete('/employees/{employee}/photo', [EmployeePhotoController::class, 'destroy']);
    Route::post('/employees/{employee}/login', [EmployeeController::class, 'createLogin']);
    Route::put('/probation/settings', [ProbationController::class, 'updateSettings']);
    Route::post('/employees/{employee}/probation/pass', [ProbationController::class, 'pass']);
    Route::post('/employees/{employee}/probation/extend', [ProbationController::class, 'extend']);
});

Route::middleware('company_permission:branches.manage')->group(function () {
    Route::post('/branches/{branch}/regenerate-qr', [BranchController::class, 'regenerateQrCode']);
});

Route::middleware(['module:birthdays', 'company_permission:employees.view'])->group(function () {
    Route::get('/birthdays', [BirthdayController::class, 'index']);
});

Route::middleware(['module:id_cards', 'company_permission:employees.view'])->group(function () {
    Route::get('/employees/{employee}/card', [EmployeeCardController::class, 'show']);
});
