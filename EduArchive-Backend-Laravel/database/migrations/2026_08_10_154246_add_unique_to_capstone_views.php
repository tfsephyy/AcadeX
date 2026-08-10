<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    public function up(): void
    {
        // MySQL workaround: wrap subquery in extra alias to avoid "can't specify target table" error
        DB::statement('
            DELETE FROM capstone_views
            WHERE user_id IS NOT NULL
              AND id NOT IN (
                SELECT min_id FROM (
                    SELECT MIN(id) AS min_id
                    FROM capstone_views
                    WHERE user_id IS NOT NULL
                    GROUP BY user_id, capstone_id
                ) AS keep_ids
            )
        ');

        Schema::table('capstone_views', function (Blueprint $table) {
            // Add unique constraint so each user can only have one view per capstone
            $table->unique(['user_id', 'capstone_id'], 'capstone_views_user_capstone_unique');
        });
    }

    public function down(): void
    {
        Schema::table('capstone_views', function (Blueprint $table) {
            $table->dropUnique('capstone_views_user_capstone_unique');
        });
    }
};
