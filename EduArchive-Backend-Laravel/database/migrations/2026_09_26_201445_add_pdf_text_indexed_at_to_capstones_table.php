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
            $table->timestamp('pdf_text_indexed_at')->nullable()->after('pdf_text');
            $table->index('pdf_text_indexed_at');
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropIndex(['pdf_text_indexed_at']);
            $table->dropColumn('pdf_text_indexed_at');
        });
    }
};
