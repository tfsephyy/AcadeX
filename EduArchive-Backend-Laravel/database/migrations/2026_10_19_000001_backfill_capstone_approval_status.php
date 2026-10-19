<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Support\Facades\DB;

return new class extends Migration
{
    /**
     * The legacy capstones.status column was the only approval field before
     * approval_status was introduced. The column addition defaults every old
     * row to 'pending', which would remove already-approved projects from the
     * approved library and put them into the review queue.
     *
     * Backfill once from the legacy value. Rows already given an explicit
     * non-pending approval_status by the new workflow are not touched.
     */
    public function up(): void
    {
        DB::table('capstones')
            ->where('status', 'approved')
            ->where('approval_status', 'pending')
            ->update(['approval_status' => 'approved']);

        DB::table('capstones')
            ->where('status', 'rejected')
            ->where('approval_status', 'pending')
            ->update(['approval_status' => 'rejected']);
    }

    /**
     * Do not silently re-open or re-approve records on rollback. Approval is a
     * business decision, not a reversible schema default.
     */
    public function down(): void
    {
        //
    }
};
