<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A company can link several Telegram groups (e.g. head-office management,
 * one HR group per branch, an all-staff group), each with its own reach:
 *
 *  - branch_ids: null = every branch; otherwise only posts about employees
 *    whose current branch is in the list. (Replaces the unused branch_id.)
 *  - detail: "full" = name, Khmer name, ID code, job, department, branch;
 *    "basic" = name and branch only — for groups that many people read.
 *
 * So company_id is no longer unique. chat_id stays unique: one Telegram
 * group is linked once.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('telegram_groups', function (Blueprint $table) {
            $table->dropUnique(['company_id']);
            $table->index('company_id');
            $table->json('branch_ids')->nullable()->after('company_id');
            $table->string('detail', 10)->default('full')->after('events');
        });

        Schema::table('telegram_groups', function (Blueprint $table) {
            $table->dropConstrainedForeignId('branch_id');
        });
    }

    public function down(): void
    {
        Schema::table('telegram_groups', function (Blueprint $table) {
            $table->foreignId('branch_id')->nullable()->after('company_id')->constrained()->nullOnDelete();
        });

        Schema::table('telegram_groups', function (Blueprint $table) {
            $table->dropColumn(['branch_ids', 'detail']);
            $table->dropIndex(['company_id']);
            $table->unique('company_id');
        });
    }
};
