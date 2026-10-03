<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Turns a notification into an actionable, auditable alert:
        //  - actor: who caused it (the requester, the reviewer);
        //  - subject: what it is about (a correction request…), so every alert
        //    about one item can be found and resolved together;
        //  - dedupe_key: one alert per recipient per event, even on a retry;
        //  - resolved_*: once one admin decides, the others' alerts say so
        //    instead of inviting a second decision. Content is never edited.
        Schema::table('notifications', function (Blueprint $table) {
            $table->foreignId('actor_user_id')->nullable()->after('recipient_user_id')->constrained('users')->nullOnDelete();
            $table->string('subject_type')->nullable()->after('notification_type');
            $table->unsignedBigInteger('subject_id')->nullable()->after('subject_type');
            $table->string('link')->nullable()->after('data');
            $table->string('dedupe_key')->nullable()->unique()->after('link');
            $table->timestamp('resolved_at')->nullable()->after('read_at');
            $table->foreignId('resolved_by_user_id')->nullable()->after('resolved_at')->constrained('users')->nullOnDelete();
            $table->string('resolution')->nullable()->after('resolved_by_user_id');

            $table->index(['subject_type', 'subject_id']);
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropIndex(['subject_type', 'subject_id']);
            $table->dropUnique(['dedupe_key']);
            $table->dropConstrainedForeignId('actor_user_id');
            $table->dropConstrainedForeignId('resolved_by_user_id');
            $table->dropColumn(['subject_type', 'subject_id', 'link', 'dedupe_key', 'resolved_at', 'resolution']);
        });
    }
};
