<?php

namespace Tests\Feature;

use App\Models\PasswordResetCode;
use App\Models\Role;
use App\Models\User;
use App\Services\GoogleIdentityService;
use Tests\SecurityTestCase;

class FacultyRegistrationTest extends SecurityTestCase
{
    private function payload(): array
    {
        config(['acadex.registration_min_seconds' => 0]);
        Role::firstOrCreate(['name' => 'faculty']);
        $id = bin2hex(random_bytes(5));
        return ['name' => 'Synthetic Faculty', 'username' => 'faculty_'.$id, 'email' => $id.'@example.invalid',
            'id_number' => 'MBC2026-'.random_int(10000, 99999), 'role' => 'faculty', 'program' => 'BSIT',
            'password' => $this->password, 'password_confirmation' => $this->password,
            'registration_challenge' => $this->getJson('/api/v1/register/challenge')->assertOk()->json('data.challenge')];
    }

    private function verifyEmail(string $email): void
    {
        $code = 'AB12CD3';
        PasswordResetCode::create(['email' => $email, 'type' => 'email_verification',
            'code' => PasswordResetCode::hashCode($code), 'expires_at' => now()->addMinutes(10)]);
        $this->postJson('/api/v1/verify-email-code', ['email' => $email, 'code' => $code])->assertOk();
    }

    public function test_faculty_can_register_without_student_year_or_section_and_awaits_approval(): void
    {
        $payload = $this->payload();
        $payload['id_number'] = 'FAC / '.bin2hex(random_bytes(5));
        $this->verifyEmail($payload['email']);
        $this->postJson('/api/v1/register', $payload)->assertCreated()
            ->assertJsonPath('data.user.role', 'faculty')->assertJsonPath('data.user.program', 'BSIT');
        $user = User::where('email', $payload['email'])->firstOrFail();
        self::assertFalse($user->is_approved);
        self::assertNotNull($user->email_verified_at);
        self::assertSame('BSIT', $user->faculty_program);
        self::assertSame($payload['id_number'], $user->id_number);
        self::assertNull($user->studentProfile);
        $this->postJson('/api/v1/login', ['email' => $payload['email'], 'password' => $this->password])->assertStatus(423);
    }

    public function test_faculty_validation_is_actionable_and_email_verification_remains_required(): void
    {
        $payload = $this->payload();
        $before = User::count();
        $this->postJson('/api/v1/register', $payload)->assertUnprocessable()->assertJsonValidationErrors('email');
        $this->postJson('/api/v1/register', array_replace($payload, ['program' => 'invalid']))
            ->assertUnprocessable()->assertJsonValidationErrors('program');
        $this->postJson('/api/v1/register', array_replace($payload, ['id_number' => '   ']))
            ->assertUnprocessable()->assertJsonValidationErrors('id_number');
        self::assertSame($before, User::count());
        $this->verifyEmail($payload['email']);
        $this->postJson('/api/v1/register', $payload)->assertCreated();
        $this->postJson('/api/v1/register', $payload)->assertUnprocessable()->assertJsonValidationErrors(['email', 'username', 'id_number']);
        self::assertSame($before + 1, User::count());
    }

    public function test_google_faculty_registration_has_the_same_program_and_approval_rules(): void
    {
        $payload = $this->payload();
        $payload['id_number'] = 'Employee '.bin2hex(random_bytes(5));
        $payload['credential'] = 'synthetic-verified-google-token';
        $identity = \Mockery::mock(GoogleIdentityService::class);
        $identity->shouldReceive('configured')->once()->andReturnTrue();
        $identity->shouldReceive('verifyCredential')->once()->andReturn([
            'google_id' => 'synthetic-faculty-'.bin2hex(random_bytes(8)),
            'email' => $payload['email'], 'name' => 'Synthetic Faculty',
        ]);
        $this->app->instance(GoogleIdentityService::class, $identity);
        $this->postJson('/api/v1/auth/google/register', $payload)->assertCreated()
            ->assertJsonPath('data.user.role', 'faculty')->assertJsonPath('data.user.program', 'BSIT');
        $user = User::where('email', $payload['email'])->firstOrFail();
        self::assertNotNull($user->email_verified_at);
        self::assertFalse($user->is_approved);
        self::assertSame($payload['id_number'], $user->id_number);
        self::assertNull($user->studentProfile);
    }

    public function test_student_registration_accepts_a_different_id_format_and_keeps_required_unique_and_size_checks(): void
    {
        $payload = array_replace($this->payload(), ['role' => 'student', 'program' => 'BSIT', 'year' => '4', 'section' => 'A',
            'id_number' => '2026/'.bin2hex(random_bytes(5))]);
        Role::firstOrCreate(['name' => 'student']);
        $this->postJson('/api/v1/register', array_replace($payload, ['id_number' => '']))
            ->assertUnprocessable()->assertJsonValidationErrors('id_number');
        $this->postJson('/api/v1/register', array_replace($payload, ['id_number' => str_repeat('a', 256)]))
            ->assertUnprocessable()->assertJsonValidationErrors('id_number');
        $this->verifyEmail($payload['email']);
        $this->postJson('/api/v1/register', $payload)->assertCreated();
        self::assertFalse(User::where('email', $payload['email'])->firstOrFail()->is_approved);
        $this->postJson('/api/v1/register', $payload)->assertUnprocessable()->assertJsonValidationErrors('id_number');
    }
}
