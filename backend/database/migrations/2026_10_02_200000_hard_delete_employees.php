<?php

use App\Models\User;
use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\Storage;

return new class extends Migration
{
    /**
     * Employees are now deleted for good (see EmployeeRemover). Finish off the
     * ones that were only soft-deleted, so their employee IDs and logins can
     * be used again, then drop the column.
     */
    public function up(): void
    {
        $trashed = DB::table('employees')->whereNotNull('deleted_at')->get(['id', 'user_id', 'photo_path']);

        foreach ($trashed as $employee) {
            // Their attendance, schedules and assignments cascade with the row.
            DB::table('employees')->where('id', $employee->id)->delete();

            if ($employee->photo_path) {
                Storage::disk('local')->delete($employee->photo_path);
            }

            // Their login was deactivated when they were removed. One that was
            // switched back on since is someone's working account: leave it.
            if ($employee->user_id === null
                || ! DB::table('users')->where('id', $employee->user_id)->where('is_active', false)->exists()) {
                continue;
            }

            // Corrections they filed for others still point at the account, so
            // keep it locked but free its employee ID.
            if (DB::table('attendance_corrections')->where('requested_by', $employee->user_id)->exists()) {
                DB::table('company_memberships')->where('user_id', $employee->user_id)->update(['login_id' => null]);

                continue;
            }

            DB::table('personal_access_tokens')
                ->where('tokenable_type', User::class)
                ->where('tokenable_id', $employee->user_id)
                ->delete();
            DB::table('users')->where('id', $employee->user_id)->delete();
        }

        Schema::table('employees', fn (Blueprint $table) => $table->dropSoftDeletes());
    }

    public function down(): void
    {
        Schema::table('employees', fn (Blueprint $table) => $table->softDeletes());
    }
};
