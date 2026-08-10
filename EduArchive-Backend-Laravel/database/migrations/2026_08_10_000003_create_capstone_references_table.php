<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('capstone_references', function (Blueprint $table) {
            $table->id();
            $table->foreignId('capstone_id')
                  ->constrained('capstones')
                  ->onDelete('cascade');
            $table->foreignId('referenced_capstone_id')
                  ->constrained('capstones')
                  ->onDelete('cascade');
            $table->timestamps();
            $table->unique(['capstone_id', 'referenced_capstone_id']);
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capstone_references');
    }
};
