<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->string('gender', 20)->nullable()->after('phone');
            $table->date('date_of_birth')->nullable()->after('gender');
            $table->text('address')->nullable()->after('date_of_birth');
            // A plain string checked by the app (not a DB enum) so adding a
            // type later doesn't need a schema change.
            $table->string('employment_type', 50)->nullable()->after('employment_status');
            $table->text('notes')->nullable()->after('termination_date');
        });
    }

    public function down(): void
    {
        Schema::table('employees', function (Blueprint $table) {
            $table->dropColumn(['gender', 'date_of_birth', 'address', 'employment_type', 'notes']);
        });
    }
};
