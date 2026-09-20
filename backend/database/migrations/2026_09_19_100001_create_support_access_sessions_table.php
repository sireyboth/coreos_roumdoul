<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A record of a platform admin getting time-boxed access to a
        // tenant's data for support purposes. Stage 1 only tracks the
        // start/end of a session (audited) — no actual impersonation/view-as
        // wiring yet.
        Schema::create('support_access_sessions', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->foreignId('platform_admin_id')->constrained()->cascadeOnDelete();
            $table->string('reason');
            $table->timestamp('started_at');
            $table->timestamp('expires_at');
            $table->timestamp('ended_at')->nullable();
            $table->timestamps();

            $table->index(['company_id', 'ended_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('support_access_sessions');
    }
};
