<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::create('upload_transfers', function (Blueprint $table) {
            $table->uuid('id')->primary();
            $table->foreignId('user_id')->constrained()->cascadeOnDelete();
            $table->string('original_name');
            $table->unsignedBigInteger('size');
            $table->unsignedBigInteger('received_bytes')->default(0);
            $table->json('chunks');
            $table->uuid('upload_id')->nullable();
            $table->foreign('upload_id')->references('id')->on('document_uploads')->cascadeOnDelete();
            $table->timestamp('expires_at')->index();
            $table->timestamps();
            $table->index(['user_id', 'upload_id']);
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Keep resumable transfer records and encrypted chunks during code rollback.');
    }
};
