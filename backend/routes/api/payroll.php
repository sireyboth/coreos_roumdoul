<?php

// Payroll module: employee pay setup, settings, pay runs, payslips, adjustments.
// Loaded by routes/api.php inside the signed-in, active-company group.

use App\Http\Controllers\Api\Payroll\EmployeePayController;
use App\Http\Controllers\Api\Payroll\PayGroupController;
use App\Http\Controllers\Api\Payroll\PayrollAdjustmentController;
use App\Http\Controllers\Api\Payroll\PayrollSettingsController;
use App\Http\Controllers\Api\Payroll\PayRunController;
use Illuminate\Support\Facades\Route;

Route::middleware('module:payroll')->group(function () {
    // One person's pay setup: pay group, salary history, tax/NSSF profile, recurring items.
    Route::get('/employees/{employee}/pay', [EmployeePayController::class, 'show'])->middleware('company_permission:salary.view');
    // Everyone's pay setup today, for the employee Excel export.
    Route::get('/payroll/employee-pay', [EmployeePayController::class, 'index'])->middleware('company_permission:salary.view');
    Route::get('/payroll/item-options', [EmployeePayController::class, 'itemOptions'])->middleware('company_permission:salary.view');
    // The groups to choose from on an employee (names only), for people who set pay but not payroll.
    Route::get('/payroll/group-options', [PayGroupController::class, 'options'])->middleware('company_permission:salary.view');
    Route::middleware('company_permission:salary.manage')->group(function () {
        Route::post('/employees/{employee}/pay-groups', [EmployeePayController::class, 'storePayGroup']);
        Route::delete('/employees/{employee}/pay-groups/{assignment}', [EmployeePayController::class, 'destroyPayGroup']);
        Route::post('/employees/{employee}/salaries', [EmployeePayController::class, 'storeSalary']);
        Route::delete('/employees/{employee}/salaries/{salary}', [EmployeePayController::class, 'destroySalary']);
        Route::put('/employees/{employee}/pay-profile', [EmployeePayController::class, 'updateProfile']);
        Route::post('/employees/{employee}/pay-items', [EmployeePayController::class, 'storeItem']);
        Route::put('/employees/{employee}/pay-items/{item}', [EmployeePayController::class, 'updateItem']);
        Route::delete('/employees/{employee}/pay-items/{item}', [EmployeePayController::class, 'destroyItem']);
    });

    Route::middleware('company_permission:payroll.view')->group(function () {
        Route::get('/payroll/settings', [PayrollSettingsController::class, 'show']);
        Route::get('/payroll/groups', [PayGroupController::class, 'index']);
        Route::get('/payroll/groups/{group}/periods', [PayGroupController::class, 'periods']);
        Route::get('/payroll/runs', [PayRunController::class, 'index']);
        Route::get('/payroll/runs/{run}', [PayRunController::class, 'show']);
        Route::get('/payroll/runs/{run}/export', [PayRunController::class, 'export']);
        Route::get('/payroll/runs/{run}/report', [PayRunController::class, 'report']);
        Route::get('/payroll/payslips/{payslip}', [PayRunController::class, 'payslip']);
        Route::get('/payroll/adjustments', [PayrollAdjustmentController::class, 'index']);
    });

    Route::middleware('company_permission:payroll.manage')->group(function () {
        Route::put('/payroll/policy', [PayrollSettingsController::class, 'updatePolicy']);
        Route::post('/payroll/presets', [PayrollSettingsController::class, 'applyPreset']);
        Route::post('/payroll/components', [PayrollSettingsController::class, 'storeComponent']);
        Route::put('/payroll/components/{component}', [PayrollSettingsController::class, 'updateComponent']);
        Route::delete('/payroll/components/{component}', [PayrollSettingsController::class, 'destroyComponent']);
        Route::post('/payroll/preview', [PayrollSettingsController::class, 'preview']);

        Route::post('/payroll/groups', [PayGroupController::class, 'store']);
        Route::put('/payroll/groups/{group}', [PayGroupController::class, 'update']);
        Route::delete('/payroll/groups/{group}', [PayGroupController::class, 'destroy']);

        Route::post('/payroll/runs', [PayRunController::class, 'store']);
        Route::post('/payroll/runs/{run}/calculate', [PayRunController::class, 'calculate']);
        Route::post('/payroll/runs/{run}/employees/{employee}/calculate', [PayRunController::class, 'calculateEmployee'])->whereNumber('employee');
        Route::post('/payroll/runs/{run}/paid', [PayRunController::class, 'markPaid']);
        Route::delete('/payroll/runs/{run}', [PayRunController::class, 'destroy']);

        Route::post('/payroll/adjustments', [PayrollAdjustmentController::class, 'store']);
        Route::post('/payroll/adjustments/import', [PayrollAdjustmentController::class, 'import']);
        Route::post('/payroll/adjustments/bulk', [PayrollAdjustmentController::class, 'bulk']);
        Route::put('/payroll/adjustments/{adjustment}', [PayrollAdjustmentController::class, 'update']);
        Route::delete('/payroll/adjustments/{adjustment}', [PayrollAdjustmentController::class, 'destroy']);
    });

    // Its own right: HR prepares runs with payroll.manage, a manager signs them off.
    Route::post('/payroll/runs/{run}/approve', [PayRunController::class, 'approve'])->middleware('company_permission:payroll.approve');
    // Undoing a sign-off is the approver's call too.
    Route::post('/payroll/runs/{run}/reopen', [PayRunController::class, 'reopen'])->middleware('company_permission:payroll.approve');
});
