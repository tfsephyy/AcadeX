<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;
use Illuminate\Support\Str;

return new class extends Migration
{
    public function up(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->string('slug', 191)->nullable()->unique()->after('title');
            $table->string('processing_status', 20)->default('completed')->after('approval_status');
            $table->text('processing_error')->nullable()->after('processing_status');
            $table->timestamp('processing_started_at')->nullable()->after('processing_error');
            $table->timestamp('processing_completed_at')->nullable()->after('processing_started_at');
            $table->index(['adviser_id', 'approval_status'], 'capstones_adviser_approval_idx');
            $table->index(['uploaded_by', 'created_at'], 'capstones_uploader_created_idx');
            $table->index(['approval_status', 'is_archived'], 'capstones_approval_archived_idx');
            $table->index('processing_status', 'capstones_processing_status_idx');
        });

        // Backfill deterministic, unique slugs without rewriting any capstone.
        $used = [];
        DB::table('capstones')->orderBy('id')->select(['id', 'title'])->chunkById(200, function ($rows) use (&$used) {
            foreach ($rows as $row) {
                $base = Str::slug((string) $row->title);
                $base = $base !== '' ? Str::limit($base, 170, '') : 'capstone-'.$row->id;
                // Route binding reserves all-numeric path segments for
                // backwards-compatible numeric capstone IDs.
                if (ctype_digit($base)) $base = 'capstone-'.$base;
                $slug = $base;
                $suffix = 2;
                // The new column starts NULL for every row, so the in-memory
                // set is sufficient and avoids one extra query per record.
                while (isset($used[$slug])) {
                    $slug = $base.'-'.$suffix++;
                }
                DB::table('capstones')->where('id', $row->id)->update(['slug' => $slug]);
                $used[$slug] = true;
            }
        });
    }

    public function down(): void
    {
        Schema::table('capstones', function (Blueprint $table) {
            $table->dropUnique(['slug']);
            $table->dropIndex('capstones_adviser_approval_idx');
            $table->dropIndex('capstones_uploader_created_idx');
            $table->dropIndex('capstones_approval_archived_idx');
            $table->dropIndex('capstones_processing_status_idx');
            $table->dropColumn([
                'slug',
                'processing_status',
                'processing_error',
                'processing_started_at',
                'processing_completed_at',
            ]);
        });
    }
};
