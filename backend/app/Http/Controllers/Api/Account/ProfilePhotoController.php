<?php

namespace App\Http\Controllers\Api\Account;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\Employees\EmployeePhotoService;
use Illuminate\Http\Request;

/**
 * Your own profile photo. Any signed-in person linked to an employee record
 * can set or remove it — no HR permission needed. It only ever touches the
 * caller's own record, never one picked by id.
 */
class ProfilePhotoController extends Controller
{
    public function __construct(private EmployeePhotoService $photos) {}

    public function store(Request $request)
    {
        $employee = $this->ownEmployee($request);
        $request->validate(EmployeePhotoService::RULES);

        $this->photos->replace($employee, $request->file('photo'));

        return ['photo_url' => $employee->fresh()->photo_url];
    }

    public function destroy(Request $request)
    {
        $this->photos->remove($this->ownEmployee($request));

        return response()->noContent();
    }

    /** Owners and admins may have no employee record — there is no photo to set then. */
    private function ownEmployee(Request $request): Employee
    {
        $employee = Employee::query()->where('user_id', $request->user()->id)->first();

        abort_if($employee === null, response()->json([
            'message' => __('Your account is not linked to an employee record, so it has no profile photo.'),
            'code' => 'no_employee_record',
        ], 404));

        return $employee;
    }
}
