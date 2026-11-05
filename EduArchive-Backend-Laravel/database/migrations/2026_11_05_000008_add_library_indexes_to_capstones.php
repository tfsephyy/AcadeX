<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            // Repository filters group by year and program. The combined
            // approval/archive index already exists; these support the common
            // "approved library, newest first" and program/year facets.
            $table->index('year', 'capstones_year_idx');
            $table->index('program', 'capstones_program_idx');
            $table->index(['approval_status', 'is_archived', 'created_at'], 'capstones_library_recent_idx');
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropIndex('capstones_year_idx');
            $table->dropIndex('capstones_program_idx');
            $table->dropIndex('capstones_library_recent_idx');
        });
    }
};
