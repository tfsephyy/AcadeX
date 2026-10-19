<?php

namespace Tests;

use App\Models\Capstone;
use App\Models\Role;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Storage;

abstract class SecurityTestCase extends TestCase
{
    protected string $password;
    protected string $csrf;
    private bool $transactionStarted = false;

    protected function setUp(): void
    {
        parent::setUp();
        $expected = \Dotenv\Dotenv::parse(file_get_contents(base_path('.env.testing')));
        if (!app()->environment('testing') || config('database.default') !== 'mysql' ||
            config('database.connections.mysql.database') !== $expected['DB_DATABASE'] ||
            !preg_match('/^acadex_remediation_test_[a-f0-9]{10}$/D', $expected['DB_DATABASE'])) {
            throw new \RuntimeException('Security tests require the guarded disposable MySQL runner.');
        }
        if (DB::selectOne('SELECT DATABASE() AS name')->name !== $expected['DB_DATABASE']) {
            throw new \RuntimeException('Active database differs from approved disposable database.');
        }
        DB::beginTransaction();
        $this->transactionStarted = true;
        config(['session.driver' => 'array', 'mail.default' => 'array', 'cache.default' => 'array']);
        Storage::fake('local');
        $this->password = bin2hex(random_bytes(10)).'Aa!';
        $this->csrf = bin2hex(random_bytes(20));
        $this->withSession(['_token' => $this->csrf]);
        $this->withHeader('X-CSRF-TOKEN', $this->csrf);
    }

    protected function tearDown(): void
    {
        if ($this->transactionStarted) DB::rollBack();
        parent::tearDown();
    }

    protected function user(string $role): User
    {
        $id = bin2hex(random_bytes(5));
        $user = User::create(['name' => 'Synthetic '.$role, 'username' => 'test_'.$id,
            'email' => $id.'@example.invalid', 'id_number' => 'TEST-'.$id,
            'role_id' => Role::firstOrCreate(['name' => $role])->id,
            'password' => $this->password, 'is_approved' => true])
            ->forceFill(['email_verified_at' => now()]);
        $user->save();
        return $user;
    }

    protected function asUser(User $user): void
    {
        Auth::forgetGuards();
        $this->actingAs($user, 'web');
        $this->withSession(['auth_version' => (int) $user->auth_version, '_token' => $this->csrf]);
    }

    protected function capstone(User $owner, array $attributes = []): Capstone
    {
        return Capstone::create($attributes + ['title' => 'Synthetic '.bin2hex(random_bytes(5)),
            'author' => 'Synthetic Author', 'year' => 2026, 'pdf_path' => 'capstones/'.bin2hex(random_bytes(5)).'.enc',
            'uploaded_by' => $owner->id, 'status' => 'pending', 'approval_status' => 'pending',
            'publication_status' => 'unpublished', 'pdf_text' => 'PRIVATE EXTRACTED TEXT',
            'author_details' => [['name' => 'Synthetic', 'email' => 'private@example.invalid', 'contact' => 'private']]]);
    }
}
