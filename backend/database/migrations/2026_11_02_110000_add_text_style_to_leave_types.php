<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * The rest of a leave type's look in the attendance report, beside its code
 * and colour: the text colour (null = auto, the colour's own dark shade) and
 * whether the code is bold. Set with the day statuses in Attendance → Status codes.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->string('text_color', 16)->nullable()->after('color');
            $table->boolean('bold')->default(true)->after('text_color');
        });
    }

    public function down(): void
    {
        Schema::table('leave_types', function (Blueprint $table) {
            $table->dropColumn(['text_color', 'bold']);
        });
    }
};
