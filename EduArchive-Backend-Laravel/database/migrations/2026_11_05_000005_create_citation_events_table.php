<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::create('citation_events', function (Blueprint $table) {
            $table->id();
            $table->foreignId('capstone_id')->constrained()->cascadeOnDelete();
            $table->foreignId('user_id')->nullable()->constrained()->nullOnDelete();
            $table->string('format', 10);
            $table->string('action', 20)->default('copy');
            $table->string('ip_hash', 64)->nullable();
            $table->timestamps();
            $table->index(['capstone_id', 'created_at'], 'citation_events_capstone_created_idx');
            $table->index('user_id');
        });
    }

    public function down(): void
    {
        Schema::dropIfExists('citation_events');
    }
};
