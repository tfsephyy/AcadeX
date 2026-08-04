<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('keywords', function (Blueprint $table) {
            $table->id();
            $table->string('name')->unique();
            $table->index('name');
            $table->timestamps();
        });

        Schema::create('capstone_keyword', function (Blueprint $table) {
            $table->id();
            $table->foreignId('capstone_id')->constrained('capstones')->onDelete('cascade');
            $table->foreignId('keyword_id')->constrained('keywords')->onDelete('cascade');
            $table->unique(['capstone_id', 'keyword_id']);
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capstone_keyword');
        Schema::dropIfExists('keywords');
    }
};
