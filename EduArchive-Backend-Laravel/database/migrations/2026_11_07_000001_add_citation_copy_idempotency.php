<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\Schema;

return new class extends Migration {
    public function up(): void
    {
        Schema::table('citation_events', function (Blueprint $table) {
            $table->uuid('event_key')->nullable();
            $table->unique(['user_id', 'event_key'], 'citation_copy_event_unique');
        });
    }

    public function down(): void
    {
        throw new RuntimeException('Keep citation idempotency keys when rolling back application code.');
    }
};
