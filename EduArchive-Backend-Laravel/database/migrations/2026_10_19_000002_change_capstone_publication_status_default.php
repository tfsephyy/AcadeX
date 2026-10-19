<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Change the MySQL column default for publication_status to 'unpublished'.
     * Preserves existing enum values ('published', 'unpublished', 'in_progress')
     * and does not rewrite existing publication_status values.
     */
    public function up(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE `capstones` ALTER COLUMN `publication_status` SET DEFAULT 'unpublished'");
        } else {
            Schema::table('capstones', function (Blueprint $table) {
                $table->enum('publication_status', ['published', 'unpublished', 'in_progress'])
                      ->default('unpublished')
                      ->change();
            });
        }
    }

    /**
     * Restore the former 'published' column default on rollback without modifying rows.
     */
    public function down(): void
    {
        $driver = Schema::getConnection()->getDriverName();
        if ($driver === 'mysql') {
            DB::statement("ALTER TABLE `capstones` ALTER COLUMN `publication_status` SET DEFAULT 'published'");
        } else {
            Schema::table('capstones', function (Blueprint $table) {
                $table->enum('publication_status', ['published', 'unpublished', 'in_progress'])
                      ->default('published')
                      ->change();
            });
        }
    }
};
