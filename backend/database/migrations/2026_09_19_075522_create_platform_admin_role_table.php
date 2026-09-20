<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('platform_admin_role', function (Blueprint $table) {
            $table->foreignId('platform_admin_id')->constrained()->cascadeOnDelete();
            $table->foreignId('platform_role_id')->constrained()->cascadeOnDelete();
            $table->timestamp('created_at')->useCurrent();

            $table->primary(['platform_admin_id', 'platform_role_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('platform_admin_role');
    }
};
