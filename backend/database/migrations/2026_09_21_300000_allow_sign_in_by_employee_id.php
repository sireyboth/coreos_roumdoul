<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // An account can now sign in with an employee ID instead of an email, so
        // an email is no longer guaranteed. (A unique index still allows many NULLs.)
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable()->change();
        });

        Schema::table('company_memberships', function (Blueprint $table) {
            // The employee ID this person signs in with (stored lower-case). Only
            // unique within one company: two companies can both have an "E-001",
            // which is why signing in by ID also asks for the company code.
            $table->string('login_id', 50)->nullable();
            $table->unique(['company_id', 'login_id'], 'uniq_memberships_company_login');
        });
    }

    public function down(): void
    {
        Schema::table('company_memberships', function (Blueprint $table) {
            $table->dropUnique('uniq_memberships_company_login');
            $table->dropColumn('login_id');
        });

        // Only possible while every account still has an email.
        Schema::table('users', function (Blueprint $table) {
            $table->string('email')->nullable(false)->change();
        });
    }
};
