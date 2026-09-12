<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

/**
 * Add author_details JSON column to capstones table.
 *
 * Shape: [{"name":"Juan Dela Cruz","email":"juan@example.com","contact":"09171234567"}, ...]
 * Null for existing capstones without contact info extracted.
 */
return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->json('author_details')->nullable()->after('author');
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropColumn('author_details');
        });
    }
};
