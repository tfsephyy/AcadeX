<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            // Existing faculty remain selectable; administrators can turn this off.
            $table->boolean('adviser_available')->default(true)->after('faculty_program');
            $table->index(['role_id', 'adviser_available'], 'users_role_adviser_idx');
        });
    }

    public function down(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->dropIndex('users_role_adviser_idx');
            $table->dropColumn('adviser_available');
        });
    }
};
