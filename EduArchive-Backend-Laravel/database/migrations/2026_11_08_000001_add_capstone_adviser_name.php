<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->string('adviser_name')->nullable();
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Retain adviser names during code rollback; this migration is additive.');
    }
};
