<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A plan's monthly and yearly prices as separate rows, so a tier's
        // feature/module set never has to be duplicated just to offer both
        // billing intervals.
        Schema::create('plan_prices', function (Blueprint $table) {
            $table->id();
            $table->foreignId('plan_id')->constrained()->cascadeOnDelete();
            $table->enum('interval', ['monthly', 'yearly']);
            $table->unsignedInteger('price_cents');
            $table->string('currency', 3)->default('USD');
            $table->timestamps();

            $table->unique(['plan_id', 'interval']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('plan_prices');
    }
};
