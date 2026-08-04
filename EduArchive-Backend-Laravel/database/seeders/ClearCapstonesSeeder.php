<?php

namespace Database\Seeders;

use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Schema;

class ClearCapstonesSeeder extends Seeder
{
    public function run(): void
    {
        Schema::disableForeignKeyConstraints();

        DB::table('capstone_views')->truncate();
        DB::table('downloads')->truncate();
        DB::table('bookmarks')->truncate();
        DB::table('capstone_keyword')->truncate();
        DB::table('capstones')->truncate();

        Schema::enableForeignKeyConstraints();
    }
}
