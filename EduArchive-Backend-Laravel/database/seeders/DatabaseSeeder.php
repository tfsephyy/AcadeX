<?php

namespace Database\Seeders;

use App\Models\Role;
use Illuminate\Database\Seeder;

class DatabaseSeeder extends Seeder
{
    public function run(): void
    {
        foreach (['admin', 'student', 'faculty', 'visitor'] as $name) {
            Role::firstOrCreate(['name' => $name]);
        }
        // Create the administrator explicitly: php artisan acadex:bootstrap-admin
    }
}
