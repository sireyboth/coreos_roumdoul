<?php

namespace App\Http\Controllers\Api\Organization;

use App\Http\Controllers\Controller;
use App\Models\Employee;
use App\Services\Employees\EmployeePhotoService;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Storage;

/**
 * Employee profile photos, changed by HR (employees.manage). Employees can
 * also change their own from their profile (Account\ProfilePhotoController).
 * Storage and image handling live in EmployeePhotoService.
 */
class EmployeePhotoController extends Controller
{
    public function __construct(private EmployeePhotoService $photos) {}

    public function store(Request $request, Employee $employee)
    {
        $request->validate(EmployeePhotoService::RULES);

        $this->photos->replace($employee, $request->file('photo'));

        return ['photo_url' => $employee->fresh()->photo_url];
    }

    public function destroy(Employee $employee)
    {
        $this->photos->remove($employee);

        return response()->noContent();
    }

    /**
     * Reached through a signed link (no login header — an <img> tag can't send
     * one). The `v` value ties the link to one specific photo, so a link to a
     * replaced or removed photo stops working straight away.
     */
    public function show(Request $request, int $employee)
    {
        // Explicitly unscoped: there is no logged-in user here; the signature is the proof.
        $employee = Employee::query()->withoutGlobalScopes()->findOrFail($employee);
        $disk = Storage::disk(config('filesystems.uploads'));

        abort_unless(
            $employee->photo_path
                && hash_equals(basename($employee->photo_path, '.jpg'), (string) $request->query('v'))
                && $disk->exists($employee->photo_path),
            404,
        );

        return $disk->response($employee->photo_path, null, [
            'Content-Type' => 'image/jpeg',
            'Cache-Control' => 'private, max-age=3600',
            'X-Content-Type-Options' => 'nosniff',
        ]);
    }
}
