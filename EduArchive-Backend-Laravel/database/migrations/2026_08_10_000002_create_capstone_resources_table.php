<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capstone_resources', function (Blueprint $table) {
            $table->id();
            $table->foreignId('capstone_id')
                  ->constrained('capstones')
                  ->onDelete('cascade');
            $table->string('name');
            $table->string('file_path');
            $table->string('file_original_name')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capstone_resources');
    }
};
