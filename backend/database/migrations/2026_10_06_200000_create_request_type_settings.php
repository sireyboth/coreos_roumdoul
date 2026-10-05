<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Each company's rules for request types other than leave (leave has its
 * own leave_types). First: late arrival / early leave permission
 * (type "late_early") — whether the excused time is paid, and how many a
 * person may ask for in a month. A company without a row gets the defaults
 * (see RequestTypeSetting::DEFAULTS).
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('request_type_settings', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->constrained()->cascadeOnDelete();
            $table->string('type', 30);
            $table->boolean('is_active')->default(true);
            // 100 = the excused time is paid as worked; 0 = deducted.
            $table->unsignedTinyInteger('pay_percent')->default(100);
            // Requests per person per calendar month (cancelled / rejected don't count); null = no limit.
            $table->unsignedSmallInteger('monthly_limit')->nullable();
            $table->timestamps();

            $table->unique(['company_id', 'type']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('request_type_settings');
    }
};
