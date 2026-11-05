<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->string('dedupe_key', 120)->nullable()->unique()->after('type');
            $table->uuid('related_upload_id')->nullable()->after('related_capstone_id');
            $table->timestamp('email_sent_at')->nullable()->after('is_read');
            $table->index(['admin_id', 'is_read', 'created_at'], 'notifications_recipient_read_idx');
        });
    }

    public function down(): void
    {
        Schema::table('notifications', function (Blueprint $table) {
            $table->dropUnique(['dedupe_key']);
            $table->dropIndex('notifications_recipient_read_idx');
            $table->dropColumn(['dedupe_key', 'related_upload_id', 'email_sent_at']);
        });
    }
};
