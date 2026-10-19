<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('users', function (Blueprint $table) {
            $table->unsignedInteger('auth_version')->default(0);
        });
        Schema::table('password_reset_codes', function (Blueprint $table) {
            $table->string('code', 64)->change();
        });
    }

    public function down(): void
    {
        // Do not truncate hashed codes or undo session invalidation automatically.
        throw new RuntimeException('Security state migration requires an explicitly reviewed rollback plan.');
    }
};
