<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('bookmarks', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->constrained('users')->onDelete('cascade');
            $table->foreignId('capstone_id')->constrained('capstones')->onDelete('cascade');
            $table->unique(['user_id', 'capstone_id']);
            $table->timestamps();
        });

        Schema::create('downloads', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('capstone_id')->constrained('capstones')->onDelete('cascade');
            $table->ipAddress('ip_address')->nullable();
            $table->timestamps();
        });

        Schema::create('capstone_views', function (Blueprint $table) {
            $table->id();
            $table->foreignId('user_id')->nullable()->constrained('users')->nullOnDelete();
            $table->foreignId('capstone_id')->constrained('capstones')->onDelete('cascade');
            $table->ipAddress('ip_address')->nullable();
            $table->timestamps();
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('capstone_views');
        Schema::dropIfExists('downloads');
        Schema::dropIfExists('bookmarks');
    }
};
