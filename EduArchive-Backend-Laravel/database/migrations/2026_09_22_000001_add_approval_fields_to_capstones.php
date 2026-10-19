<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            // approved_by and approved_at belong to the original create migration.
            // Check the new column and index separately to resume partial MySQL DDL.
            if (! Schema::hasColumn('capstones', 'approval_status')) {
                $table->enum('approval_status', ['pending', 'approved', 'rejected'])->default('pending')->after('status');
            }
            if (! Schema::hasIndex('capstones', 'capstones_approval_status_index')) {
                $table->index('approval_status');
            }
            // rejection_reason belongs to the subsequent September 26 migration.
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropIndex(['approval_status']);
            $table->dropColumn('approval_status');
        });
    }
};
