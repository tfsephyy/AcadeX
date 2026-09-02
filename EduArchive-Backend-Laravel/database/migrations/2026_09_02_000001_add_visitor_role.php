<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    /**
     * Run the migrations.
     */
    public function up(): void
    {
        // Insert visitor role if it doesn't exist yet
        DB::table('roles')->insertOrIgnore([
            'name'       => 'visitor',
            'created_at' => now(),
            'updated_at' => now(),
        ]);

        // Make id_number nullable so visitors don't need one
        Schema::table('users', function (Blueprint $table) {
            $table->string('id_number')->nullable()->change();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        DB::table('roles')->where('name', 'visitor')->delete();

        Schema::table('users', function (Blueprint $table) {
            $table->string('id_number')->nullable(false)->change();
        });
    }
};
