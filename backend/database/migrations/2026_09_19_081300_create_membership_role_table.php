<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('membership_role', function (Blueprint $table) {
            $table->foreignId('company_membership_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_role_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->primary(['company_membership_id', 'company_role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('membership_role');
    }
};
