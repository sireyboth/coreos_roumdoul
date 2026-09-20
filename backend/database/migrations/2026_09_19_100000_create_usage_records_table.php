<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Append-only: each row is a point-in-time reading of a metric for a
        // company (e.g. "employees_count" = 12), not a running total that
        // gets overwritten — so usage-over-time can be reconstructed later.
        Schema::create('usage_records', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('metric');
            $table->unsignedInteger('value');
            $table->timestamp('recorded_at');
            $table->timestamps();

            $table->index(['company_id', 'metric', 'recorded_at']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('usage_records');
    }
};
