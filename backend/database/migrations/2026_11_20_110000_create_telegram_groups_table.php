<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * A company's Telegram group, linked to the one platform bot. The bot posts
 * the events the company ticked (`events`) — short, with no pay or private
 * reasons, since everyone in the group reads them.
 *
 * One group per company for now (unique company_id). branch_id is there so a
 * branch can get its own group later without changing this table.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::create('telegram_groups', function (Blueprint $table) {
            $table->id();
            $table->foreignId('company_id')->unique()->constrained()->cascadeOnDelete();
            $table->foreignId('branch_id')->nullable()->constrained()->nullOnDelete();
            // Telegram's chat id (a negative number for groups) — kept as text, it can exceed 32 bits.
            $table->string('chat_id', 32)->unique();
            $table->string('title')->nullable();
            $table->json('events');
            $table->foreignId('connected_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('telegram_groups');
    }
};
