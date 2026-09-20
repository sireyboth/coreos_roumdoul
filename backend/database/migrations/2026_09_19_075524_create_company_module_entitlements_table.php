<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Explicit per-company override of module access, taking precedence over
        // whatever the company's plan grants. Absence of a row means "use the plan".
        Schema::create('company_module_entitlements', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('module_id')->constrained()->cascadeOnDelete();
            $table->foreignId('subscription_id')->nullable()->constrained()->nullOnDelete();
            $table->boolean('is_enabled')->default(true);
            // "plan" = implied by the subscription's plan (the default, no
            // row needed for this in practice); "override" = an explicit
            // platform-owner decision recorded here regardless of plan.
            $table->string('source')->default('override');
            $table->string('note')->nullable();
            $table->string('override_reason')->nullable();
            $table->timestamp('starts_at')->nullable();
            $table->timestamp('ends_at')->nullable();
            $table->foreignId('changed_by_platform_admin_id')->nullable()->constrained('platform_admins')->nullOnDelete();
            $table->timestamps();

            $table->unique(['company_id', 'module_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_module_entitlements');
    }
};
