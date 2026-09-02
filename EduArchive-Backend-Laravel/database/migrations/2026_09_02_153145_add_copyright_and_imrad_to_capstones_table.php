<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            // Copyright status: copyrighted | pending | unprotected
            $table->enum('copyright_status', ['copyrighted', 'pending', 'unprotected'])
                  ->nullable()
                  ->after('publication_status');

            // IMRAD file (optional supplementary document)
            $table->string('imrad_path')->nullable()->after('copyright_status');
            $table->string('imrad_original_name')->nullable()->after('imrad_path');
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropColumn(['copyright_status', 'imrad_path', 'imrad_original_name']);
        });
    }
};
