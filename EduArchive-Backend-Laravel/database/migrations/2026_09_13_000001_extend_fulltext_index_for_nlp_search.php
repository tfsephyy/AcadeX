<?php

use Illuminate\Database\Migrations\Migration;
use Illuminate\Database\Schema\Blueprint;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

/**
 * Extend FULLTEXT search coverage on the capstones table:
 *  - Drop the old FULLTEXT index (title, author, abstract)
 *  - Add a new FULLTEXT index (title, author, abstract, category)
 *
 * Also add a FULLTEXT index on keywords.name for direct keyword search.
 */
return new class extends Migration
{
    public function up(): void
    {
        // ── capstones: rebuild FULLTEXT to include category ────────────────
        // Drop old index first (created in the original migration)
        try {
            DB::statement('ALTER TABLE capstones DROP INDEX capstones_title_author_abstract_fulltext');
        } catch (\Throwable) {
            // Index may have a different auto-generated name; try common variants
            try {
                DB::statement('ALTER TABLE capstones DROP INDEX capstones_fulltext');
            } catch (\Throwable) {
                // Already gone or never existed — safe to continue
            }
        }

        // Add expanded FULLTEXT index including category
        DB::statement(
            'ALTER TABLE capstones ADD FULLTEXT INDEX capstones_nlp_fulltext (title, author, abstract, category)'
        );

        // ── keywords: add FULLTEXT on name for fast keyword search ─────────
        Schema::table('keywords', function (Blueprint $table) {
            $table->fullText('name', 'keywords_name_fulltext');
        });
    }

    public function down(): void
    {
        // Restore original index
        try {
            DB::statement('ALTER TABLE capstones DROP INDEX capstones_nlp_fulltext');
        } catch (\Throwable) {}

        DB::statement(
            'ALTER TABLE capstones ADD FULLTEXT INDEX capstones_title_author_abstract_fulltext (title, author, abstract)'
        );

        Schema::table('keywords', function (Blueprint $table) {
            $table->dropFullText('keywords_name_fulltext');
        });
    }
};
