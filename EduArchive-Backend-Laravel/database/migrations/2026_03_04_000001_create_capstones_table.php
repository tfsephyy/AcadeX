<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capstones', function (Blueprint $table) {
            $table->id();
            $table->string('title');
            $table->year('year')->nullable();
            $table->string('author');
            $table->string('program')->nullable(); // BSIT, BSCpE
            $table->text('abstract')->nullable();
            $table->string('pdf_path'); // storage path
            $table->string('pdf_original_name')->nullable();
            $table->enum('status', ['pending', 'approved', 'rejected'])->default('pending');
            $table->boolean('is_published')->default(false);
            $table->boolean('is_archived')->default(false);

            $table->foreignId('uploaded_by')->constrained('users')->onDelete('cascade');
            $table->foreignId('approved_by')->nullable()->constrained('users')->nullOnDelete();
            $table->timestamp('approved_at')->nullable();

            $table->unsignedInteger('view_count')->default(0);
            $table->unsignedInteger('download_count')->default(0);
            $table->unsignedInteger('bookmark_count')->default(0);

            $table->index('status');
            $table->index('year');
            $table->index('program');
            $table->index('is_published');
            $table->index('is_archived');
            $table->fullText(['title', 'author', 'abstract']);

            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capstones');
    }
};
