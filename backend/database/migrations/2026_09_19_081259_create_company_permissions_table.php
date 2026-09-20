<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // A single global catalog shared by every company — not per-company
        // rows. What differs per company is which permissions each of its
        // own roles is granted (company_role_permission), not the catalog
        // itself. module_code lets a permission be tied to a module (e.g.
        // "attendance.view" -> module_code "attendance") even before that
        // module has any real functionality built.
        Schema::create('company_permissions', function (Blueprint $table) {
            $table->id();
            $table->string('code')->unique();
            $table->string('name');
            $table->string('description')->nullable();
            $table->string('module_code')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('company_permissions');
    }
};
