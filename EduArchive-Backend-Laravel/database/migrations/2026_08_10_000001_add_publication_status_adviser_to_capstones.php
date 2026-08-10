<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->enum('publication_status', ['published', 'unpublished', 'in_progress'])
                  ->default('published')
                  ->after('is_archived');
            $table->foreignId('adviser_id')
                  ->nullable()
                  ->after('publication_status')
                  ->constrained('users')
                  ->nullOnDelete();
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropForeign(['adviser_id']);
            $table->dropColumn(['publication_status', 'adviser_id']);
        });
    }
};
