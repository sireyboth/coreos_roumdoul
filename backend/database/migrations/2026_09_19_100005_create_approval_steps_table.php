<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('approval_steps', function (Blueprint $table) {
            $table->id();
            $table->foreignId('approval_request_id')->constrained()->cascadeOnDelete();
            $table->unsignedInteger('step_number');
            // Either a specific approver, or a role code to route to
            // whoever holds that role (e.g. "manager") — exactly one should
            // be set.
            $table->foreignId('approver_user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->string('approver_role_code')->nullable();
            $table->string('status')->default('pending');
            $table->string('comment')->nullable();
            $table->timestamp('acted_at')->nullable();
            $table->timestamps();

            $table->unique(['approval_request_id', 'step_number']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('approval_steps');
    }
};
