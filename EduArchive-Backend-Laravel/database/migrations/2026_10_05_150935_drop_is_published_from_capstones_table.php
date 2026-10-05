<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        // Sync publication_status from is_published before dropping the column.
        // Any row with is_published = 1 that still has 'unpublished' gets promoted to 'published'.
        DB::statement("
            UPDATE capstones
            SET publication_status = 'published'
            WHERE is_published = 1
              AND (publication_status IS NULL OR publication_status != 'published')
        ");

        // Rows with is_published = 0 that have no meaningful publication_status default to 'unpublished'.
        DB::statement("
            UPDATE capstones
            SET publication_status = 'unpublished'
            WHERE is_published = 0
              AND (publication_status IS NULL)
        ");

        Schema::table('capstones', function (Blueprint $table) {
            $table->dropIndex(['is_published']);   // drop the index first
            $table->dropColumn('is_published');
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->boolean('is_published')->default(false)->after('is_archived');
            $table->index('is_published');
        });

        // Restore is_published from publication_status
        DB::statement("
            UPDATE capstones
            SET is_published = CASE WHEN publication_status = 'published' THEN 1 ELSE 0 END
        ");
    }
};
