<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('password_reset_codes', function (Blueprint $table) {
            $table->string('ip_hash', 64)->nullable()->after('type');
            $table->index(['type', 'created_at'], 'password_reset_codes_type_created_idx');
        });
    }

    public function down(): void
    {
        Schema::table('password_reset_codes', function (Blueprint $table) {
            $table->dropIndex('password_reset_codes_type_created_idx');
            $table->dropColumn('ip_hash');
        });
    }
};
