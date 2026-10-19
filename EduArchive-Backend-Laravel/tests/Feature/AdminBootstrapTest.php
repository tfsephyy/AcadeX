<?php

namespace Tests\Feature;

use App\Models\User;
use Tests\SecurityTestCase;

class AdminBootstrapTest extends SecurityTestCase
{
    public function test_default_seeder_creates_roles_without_accounts(): void
    {
        $count = User::count();
        $this->artisan('db:seed', ['--class' => 'DatabaseSeeder'])->assertSuccessful();
        self::assertSame($count, User::count());
        self::assertSame(4, \App\Models\Role::whereIn('name', ['admin', 'faculty', 'student', 'visitor'])->count());
    }

    public function test_bootstrap_creates_a_verified_admin_once_without_defaults(): void
    {
        $email = bin2hex(random_bytes(5)).'@example.invalid';
        $this->artisan('acadex:bootstrap-admin')
            ->expectsQuestion('Administrator name', 'Synthetic Administrator')
            ->expectsQuestion('Administrator username', 'synthetic_'.bin2hex(random_bytes(5)))
            ->expectsQuestion('Verified administrator email', $email)
            ->expectsQuestion('Institutional ID', 'TEST-'.bin2hex(random_bytes(5)))
            ->expectsQuestion('Password (at least 12 characters, upper/lower case, number and symbol)', $this->password)
            ->expectsQuestion('Confirm password', $this->password)
            ->expectsConfirmation('Have you verified this operator identity and email through the university-approved process?', 'yes')
            ->assertSuccessful();
        $admin = User::where('email', $email)->firstOrFail();
        self::assertTrue($admin->isAdmin());
        self::assertTrue($admin->is_approved);
        self::assertNotNull($admin->email_verified_at);
        $this->artisan('acadex:bootstrap-admin')->assertFailed();
    }
}
