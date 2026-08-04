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
        Schema::create('notifications', function (Blueprint $table) {
            $table->id();
            $table->foreignId('admin_id')->constrained('users')->onDelete('cascade');
            $table->string('type'); // new_account, capstone_uploaded, capstone_edited, capstone_deleted
            $table->string('title');
            $table->text('message');
            $table->unsignedBigInteger('related_user_id')->nullable(); // User who triggered the notification
            $table->unsignedBigInteger('related_capstone_id')->nullable(); // Capstone if applicable
            $table->boolean('is_read')->default(false);
            $table->timestamps();
        });
    }

    /**
     * Reverse the migrations.
     */
    public function down(): void
    {
        Schema::dropIfExists('notifications');
    }
};
