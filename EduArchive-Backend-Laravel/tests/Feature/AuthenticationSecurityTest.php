<?php

namespace Tests\Feature;

use App\Models\PasswordResetCode;
use App\Models\User;
use Illuminate\Support\Facades\Auth;
use Tests\SecurityTestCase;

class AuthenticationSecurityTest extends SecurityTestCase
{
    public function test_stale_model_credential_changes_each_revoke_newer_sessions(): void
    {
        $user = $this->user('student');
        $first = $user->fresh();
        $stale = $user->fresh();
        $first->update(['password' => bin2hex(random_bytes(10)).'Aa!']);
        $version = $first->auth_version;
        $this->asUser($first);
        $this->getJson('/api/v1/user')->assertOk();
        $stale->update(['password' => bin2hex(random_bytes(10)).'Aa!']);
        self::assertGreaterThan($version, $stale->auth_version);
        Auth::forgetGuards();
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }

    public function test_actual_login_route_rejects_missing_and_forged_csrf_headers(): void
    {
        $user = $this->user('student');
        $this->withoutHeader('X-CSRF-TOKEN');
        $this->postJson('/api/v1/login', ['email' => $user->email, 'password' => $this->password])->assertStatus(419);
        $this->withHeader('X-CSRF-TOKEN', 'forged');
        $this->postJson('/api/v1/login', ['email' => $user->email, 'password' => $this->password])->assertStatus(419);
        $this->getJson('/api/v1/csrf-token')->assertOk()->assertJsonStructure(['csrf_token']);
    }

    public function test_password_change_invalidates_other_sessions_and_logout_invalidates_the_current_session(): void
    {
        $user = $this->user('student');
        $user->createToken('synthetic', ['*'], now()->addHour());
        $before = $user->auth_version;
        $this->asUser($user);
        $new = bin2hex(random_bytes(10)).'Aa!';
        $response = $this->postJson('/api/v1/change-password', ['current_password' => $this->password,
            'password' => $new, 'password_confirmation' => $new])->assertOk();
        self::assertGreaterThan($before, $user->fresh()->auth_version);
        self::assertSame(0, $user->tokens()->count());
        $this->withHeader('X-CSRF-TOKEN', $response->json('data.csrf_token'));
        $this->getJson('/api/v1/user')->assertOk();
        $this->postJson('/api/v1/logout')->assertOk();
        Auth::forgetGuards();
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }

    public function test_existing_unverified_account_can_verify_email_without_being_silently_approved(): void
    {
        $user = $this->user('student');
        $user->forceFill(['email_verified_at' => null, 'is_approved' => false])->save();
        $code = $this->code($user->email);
        $this->postJson('/api/v1/verify-email-code', ['email' => $user->email, 'code' => $code])->assertOk();
        self::assertNotNull($user->fresh()->email_verified_at);
        self::assertFalse($user->fresh()->is_approved);
        $this->postJson('/api/v1/login', ['email' => $user->email, 'password' => $this->password])->assertStatus(423);
    }

    public function test_explicit_expiring_bearer_reads_work_but_legacy_unbounded_tokens_do_not(): void
    {
        $user = $this->user('student');
        $valid = $user->createToken('synthetic', ['*'], now()->addDay());
        $valid->accessToken->forceFill(['created_at' => now()->subHours(3)])->save();
        Auth::guard('web')->logout();
        $this->app['session']->invalidate();
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$valid->plainTextToken);
        $this->getJson('/api/v1/user')->assertOk();
        $legacy = $user->createToken('legacy');
        Auth::forgetGuards();
        $this->withHeader('Authorization', 'Bearer '.$legacy->plainTextToken);
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }

    private function code(string $email, string $type = 'email_verification', bool $expired = false): string
    {
        $code = strtoupper(substr(bin2hex(random_bytes(8)), 0, 7));
        PasswordResetCode::create(['email' => $email, 'type' => $type, 'code' => PasswordResetCode::hashCode($code),
            'expires_at' => $expired ? now()->subMinute() : now()->addMinutes(10)]);
        return $code;
    }

    public function test_registration_requires_verified_single_use_email_proof(): void
    {
        $email = bin2hex(random_bytes(5)).'@example.invalid';
        $payload = ['name' => 'Synthetic Visitor', 'username' => 'synthetic_'.bin2hex(random_bytes(5)),
            'email' => $email, 'role' => 'visitor', 'password' => $this->password, 'password_confirmation' => $this->password];
        $this->postJson('/api/v1/register', $payload)->assertUnprocessable();
        $code = $this->code($email);
        $this->postJson('/api/v1/verify-email-code', ['email' => $email, 'code' => $code])->assertOk();
        $this->postJson('/api/v1/register', $payload)->assertCreated();
        self::assertNotNull(User::where('email', $email)->firstOrFail()->email_verified_at);
        $this->postJson('/api/v1/verify-email-code', ['email' => $email, 'code' => $code])->assertStatus(400);
        $expiredEmail = bin2hex(random_bytes(5)).'@example.invalid';
        $expired = $this->code($expiredEmail, 'email_verification', true);
        $this->postJson('/api/v1/verify-email-code', ['email' => $expiredEmail, 'code' => $expired])->assertStatus(400);
    }

    public function test_login_uses_session_and_rejects_unapproved_archived_or_unverified_accounts(): void
    {
        $user = $this->user('student');
        $response = $this->postJson('/api/v1/login', ['email' => $user->email, 'password' => $this->password])->assertOk();
        self::assertNotEmpty($response->json('data.csrf_token'));
        self::assertSame(0, $user->tokens()->count());
        $response->assertCookieExpired('auth_token');
        foreach (['is_approved' => false, 'is_archived' => true, 'email_verified_at' => null] as $field => $value) {
            $candidate = $this->user('student');
            $candidate->forceFill([$field => $value])->save();
            Auth::forgetGuards();
            $this->withSession(['_token' => $this->csrf]);
            $this->postJson('/api/v1/login', ['email' => $candidate->email, 'password' => $this->password])->assertStatus(423);
        }
    }

    public function test_email_change_rejects_forged_or_cross_email_proof_and_invalidates_old_credentials(): void
    {
        $user = $this->user('student');
        $this->asUser($user);
        $oldToken = $user->createToken('synthetic', ['*'], now()->addHour());
        $email = bin2hex(random_bytes(5)).'@example.invalid';
        $this->putJson('/api/v1/profile', ['email' => $email, 'email_code' => 'forged',
            'current_password' => $this->password, 'email_verified_at' => true])->assertUnprocessable();
        self::assertNotSame($email, $user->fresh()->email);
        $code = $this->code($email);
        $this->postJson('/api/v1/verify-email-code', ['email' => $email, 'code' => $code])->assertOk();
        $this->putJson('/api/v1/profile', ['email' => bin2hex(random_bytes(5)).'@example.invalid',
            'email_code' => $code, 'current_password' => $this->password])->assertUnprocessable();
        $before = $user->auth_version;
        $response = $this->putJson('/api/v1/profile', ['email' => $email, 'email_code' => $code,
            'current_password' => $this->password])->assertOk();
        self::assertSame($email, $user->fresh()->email);
        self::assertGreaterThan($before, $user->fresh()->auth_version);
        self::assertSame(0, $user->tokens()->count());
        self::assertNotEmpty($response->json('data.csrf_token'));
    }

    public function test_password_reset_consumes_code_and_revokes_tokens_and_old_session_versions(): void
    {
        $user = $this->user('student');
        $user->createToken('synthetic', ['*'], now()->addHour());
        $before = $user->auth_version;
        $code = $this->code($user->email, 'password_reset');
        $newPassword = bin2hex(random_bytes(10)).'Aa!';
        $payload = ['email' => $user->email, 'code' => $code, 'password' => $newPassword,
            'password_confirmation' => $newPassword];
        $this->postJson('/api/v1/reset-password', $payload)->assertOk();
        $this->postJson('/api/v1/reset-password', $payload)->assertStatus(400);
        self::assertSame(0, $user->tokens()->count());
        self::assertGreaterThan($before, $user->fresh()->auth_version);
        $this->asUser($user->fresh());
        $this->withSession(['auth_version' => $before, '_token' => $this->csrf]);
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }

    public function test_archival_approval_changes_and_expired_tokens_cannot_preserve_access(): void
    {
        foreach (['is_archived' => true, 'is_approved' => false] as $field => $value) {
            $user = $this->user('student');
            $user->createToken('synthetic', ['*'], now()->addHour());
            $user->update([$field => $value]);
            self::assertSame(0, $user->tokens()->count());
            $this->asUser($user->fresh());
            $this->getJson('/api/v1/user')->assertUnauthorized();
        }
        $user = $this->user('student');
        $token = $user->createToken('expired', ['*'], now()->subMinute());
        Auth::forgetGuards();
        $this->withSession(['auth_version' => -1]);
        $this->withHeader('Authorization', 'Bearer '.$token->plainTextToken);
        $this->getJson('/api/v1/user')->assertUnauthorized();
    }
}
