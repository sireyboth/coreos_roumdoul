<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('company_role_permission', function (Blueprint $table) {
            $table->foreignId('company_role_id')->constrained()->cascadeOnDelete();
            $table->foreignId('company_permission_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->nullable();

            $table->primary(['company_role_id', 'company_permission_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_role_permission');
    }
};
