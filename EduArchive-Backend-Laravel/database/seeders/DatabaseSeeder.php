<?php

namespace Database\Seeders;

use App\Models\Role;
use App\Models\User;
use Illuminate\Database\Console\Seeds\WithoutModelEvents;
use Illuminate\Database\Seeder;
use Illuminate\Support\Facades\Hash;

class DatabaseSeeder extends Seeder
{
    use WithoutModelEvents;

    /**
     * Seed the application's database.
     */
    public function run(): void
    {
        // Create roles
        $admin   = Role::firstOrCreate(['name' => 'admin']);
        $student = Role::firstOrCreate(['name' => 'student']);
        $faculty = Role::firstOrCreate(['name' => 'faculty']);

        // Create default admin user
        User::firstOrCreate(
            ['email' => 'eduadmin9@gmail.com'],
            [
                'name'              => 'System Administrator',
                'username'          => 'admin',
                'id_number'         => 'MBC2024-00001',
                'role_id'           => $admin->id,
                'password'          => Hash::make('Admin123'),
                'email_verified_at' => now(),
                'is_approved'       => true,
            ]
        );
    }
}
