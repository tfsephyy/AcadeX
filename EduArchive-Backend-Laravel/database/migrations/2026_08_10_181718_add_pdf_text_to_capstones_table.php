<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            // Full extracted plain-text from the uploaded PDF.
            // Used by EduBot (chatbot) so it can answer from real content,
            // not just metadata. Populated at upload time; never sent to frontend.
            $table->longText('pdf_text')->nullable()->after('pdf_original_name');
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropColumn('pdf_text');
        });
    }
};
