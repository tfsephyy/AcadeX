<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('document_uploads', function (Blueprint $table) {
            $table->string('processing_status', 20)->default('completed')->after('path');
            $table->string('original_name')->nullable()->after('processing_status');
            $table->json('extraction_result')->nullable()->after('original_name');
            $table->text('processing_error')->nullable()->after('extraction_result');
            $table->timestamp('processing_started_at')->nullable()->after('processing_error');
            $table->timestamp('processing_completed_at')->nullable()->after('processing_started_at');
            $table->index(['user_id', 'processing_status'], 'document_uploads_owner_status_idx');
        });
    }

    public function down(): void
    {
        Schema::table('document_uploads', function (Blueprint $table) {
            $table->dropIndex('document_uploads_owner_status_idx');
            $table->dropColumn([
                'processing_status',
                'original_name',
                'extraction_result',
                'processing_error',
                'processing_started_at',
                'processing_completed_at',
            ]);
        });
    }
};
