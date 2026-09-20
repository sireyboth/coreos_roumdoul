<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Zero rows for a membership = unrestricted (full access to every
        // branch in the company). Rows are only ever added to *restrict*
        // someone to a subset of branches.
        Schema::create('membership_branch_access', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_membership_id')->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->unique(['company_membership_id', 'branch_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_branch_access');
    }
};
