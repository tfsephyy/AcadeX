<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Http\Requests\GoogleRegisterRequest;
use App\Http\Requests\LoginRequest;
use App\Http\Requests\RegisterRequest;
use App\Models\AuditLog;
use App\Models\LoginAudit;
use App\Models\Notification;
use App\Models\Role;
use App\Models\StudentProfile;
use App\Models\User;
use App\Services\EmailVerificationService;
use App\Services\GoogleIdentityService;
use App\Services\RegistrationGuardService;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Carbon;
use Illuminate\Support\Facades\Auth;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\DB;
use Illuminate\Support\Str;

class AuthController extends Controller
{
    use ApiResponses;

    private const MAX_LOGIN_ATTEMPTS = 5;
    private const LOCKOUT_MINUTES    = 15;

    /* ────────────────────────────────────────────────────
     *  REGISTER
     * ──────────────────────────────────────────────────── */
    public function register(RegisterRequest $request): JsonResponse
    {
        app(RegistrationGuardService::class)->verify($request);
        $validated = $request->validated();

        app(EmailVerificationService::class)->consume($request, $validated['email']);

        $role = Role::where('name', $validated['role'])->firstOrFail();

        $user = User::create([
            'name'      => $validated['name'],
            'username'  => $validated['username'],
            'email'     => strtolower($validated['email']),
            'id_number' => $validated['id_number'] ?? null,
            'role_id'   => $role->id,
            'password'  => $validated['password'],
        ]);
        $user->forceFill(['email_verified_at' => now()])->save();

        $this->provisionProfile($user, $validated, $role->name);
        $user->load('role', 'studentProfile');
        $this->notifyAdminsOfRegistration($user, $role->name);

        // Audit log for account creation
        AuditLog::log(
            'register',
            null,
            User::class,
            $user->id,
            null,
            ['name' => $user->name, 'email' => $user->email, 'role' => $role->name]
        );

        return $this->successResponse([
            'user' => $this->formatUser($user),
        ], 'Registration successful.', 201);
    }

    /* ────────────────────────────────────────────────────
     *  REGISTRATION BOT CHALLENGE
     * ──────────────────────────────────────────────────── */
    public function registrationChallenge(): JsonResponse
    {
        return $this->successResponse(
            app(RegistrationGuardService::class)->challenge(),
            'Registration challenge issued.'
        )->header('Cache-Control', 'no-store');
    }

    /* ────────────────────────────────────────────────────
     *  GOOGLE REGISTRATION
     * ──────────────────────────────────────────────────── */
    public function googleRegistrationIdentity(Request $request): JsonResponse
    {
        $request->validate(['credential' => ['required', 'string', 'max:8192']]);
        $service = app(GoogleIdentityService::class);
        if (!$service->configured()) return $this->errorResponse('Google registration is not configured.', 503);
        $identity = $service->verifyCredential((string) $request->input('credential'));
        if (!$identity) return $this->errorResponse('Google could not verify your email. Choose Google again or use email registration.', 422);
        if (User::where('email', $identity['email'])->exists() || User::where('google_id', $identity['google_id'])->exists()) {
            return $this->errorResponse('This Google account already has an Acadex account. Use Google on the sign-in page instead.', 409);
        }
        // This previews verified identity only. Final registration revalidates
        // the signed credential and enforces uniqueness and approval rules.
        return $this->successResponse(['email' => $identity['email'], 'name' => $identity['name']], 'Google email verified.')
            ->header('Cache-Control', 'no-store');
    }

    public function googleRegister(GoogleRegisterRequest $request): JsonResponse
    {
        app(RegistrationGuardService::class)->verify($request);

        $identityService = app(GoogleIdentityService::class);
        if (!$identityService->configured()) {
            return $this->errorResponse('Google sign-in is not configured on this server. Use the standard registration form.', 503, [
                'google_configured' => false,
            ]);
        }

        $identity = $identityService->verifyCredential((string) $request->input('credential'));
        if (!$identity) {
            return $this->errorResponse('Google could not verify this account. Try again or use the standard registration form.', 422, [
                'google_configured' => true,
            ]);
        }

        // Never link or take over an existing account based on an email match.
        $existing = User::where('email', $identity['email'])->first();
        if ($existing) {
            $this->auditGoogleAttempt($request, $identity['email'], 'existing_account');
            return $this->errorResponse(
                $existing->google_id
                    ? 'This email already has a Google-linked account. Sign in with Google instead.'
                    : ($existing->email_verified_at
                        ? 'This email already belongs to an Acadex account. Return to Sign in and choose Google to access it.'
                        : 'This email already belongs to an Acadex account, but it has not been verified. Sign in with your Acadex password and complete email verification first.'),
                409,
                ['account_exists' => true, 'google_linked' => (bool) $existing->google_id]
            );
        }

        if (User::where('google_id', $identity['google_id'])->exists()) {
            return $this->errorResponse(
                'This Google account is already linked to another user. Sign in with Google instead.',
                409
            );
        }

        $validated = $request->validated();
        $role = Role::where('name', $validated['role'])->firstOrFail();

        $user = User::create([
            'name' => $validated['name'] ?: ($identity['name'] ?? 'Google user'),
            'username' => $validated['username'],
            'email' => $identity['email'],
            'id_number' => $validated['id_number'] ?? null,
            'role_id' => $role->id,
            // An unguessable random password keeps password login unavailable
            // for a Google-only account until the user explicitly sets one.
            'password' => Str::random(64),
        ]);
        $user->forceFill([
            'email_verified_at' => now(),
            'google_id' => $identity['google_id'],
        ])->save();

        $this->provisionProfile($user, $validated, $role->name);
        $user->load('role', 'studentProfile');
        $this->notifyAdminsOfRegistration($user, $role->name);

        AuditLog::log('register_google', null, User::class, $user->id, null, [
            'name' => $user->name,
            'email' => $user->email,
            'role' => $role->name,
        ]);

        return $this->successResponse([
            'user' => $this->formatUser($user),
            'google_linked' => true,
            'email_verified' => true,
        ], 'Registration successful. Your account still follows the normal administrator approval rules.', 201);
    }

    /* ────────────────────────────────────────────────────
     *  GOOGLE SIGN-IN (existing Google-linked accounts only)
     * ──────────────────────────────────────────────────── */
    public function googleLogin(Request $request): JsonResponse
    {
        $request->validate(['credential' => ['required', 'string']]);

        $identityService = app(GoogleIdentityService::class);
        if (!$identityService->configured()) {
            return $this->errorResponse('Google sign-in is not configured on this server.', 503, [
                'google_configured' => false,
            ]);
        }

        $identity = $identityService->verifyCredential((string) $request->input('credential'));
        if (!$identity) {
            return $this->errorResponse('Google could not verify this account. Try again.', 422);
        }

        $user = User::with('role', 'studentProfile')->where('email', $identity['email'])->first();
        if (!$user) {
            return $this->errorResponse('No account is linked to this Google email. Create an account first.', 404);
        }
        if ($user->is_archived) {
            return $this->errorResponse('Account unavailable. Contact the administrator for restoration.', 423);
        }
        if (!$user->is_approved) {
            return $this->errorResponse('Your account is pending approval by an administrator.', 423);
        }
        if ($user->is_locked) {
            return $this->errorResponse('Account unavailable. Contact your administrator.', 423);
        }

        if (!$user->google_id) {
            // Both identity providers must have verified this same email before
            // a password account can be linked automatically. Unverified Acadex
            // accounts still need to complete their existing email verification.
            if (!$user->email_verified_at) {
                $this->auditGoogleAttempt($request, $identity['email'], 'unverified_password_account');
                return $this->errorResponse(
                    'This Acadex account has not verified its email yet. Sign in with your Acadex password and complete email verification, then try Google sign-in.',
                    409
                );
            }

            $linked = DB::transaction(function () use ($user, $identity) {
                $account = User::query()->whereKey($user->id)->lockForUpdate()->firstOrFail();
                if (
                    strtolower(trim((string) $account->email)) !== $identity['email']
                    || !$account->email_verified_at
                ) {
                    return false;
                }

                if ($account->google_id) {
                    return hash_equals((string) $account->google_id, $identity['google_id']);
                }

                if (User::query()->where('google_id', $identity['google_id'])->exists()) {
                    return false;
                }

                $account->forceFill(['google_id' => $identity['google_id']])->save();
                return true;
            });

            if (!$linked) {
                $this->auditGoogleAttempt($request, $identity['email'], 'google_auto_link_rejected');
                return $this->errorResponse('This Google identity could not be linked to the Acadex account.', 403);
            }

            $user = User::with('role', 'studentProfile')->findOrFail($user->id);
            AuditLog::log('google_account_auto_linked', $user->id, User::class, $user->id, null, [
                'email' => $identity['email'],
            ]);
        } elseif (!hash_equals((string) $user->google_id, $identity['google_id'])) {
            $this->auditGoogleAttempt($request, $identity['email'], 'google_id_mismatch');
            return $this->errorResponse('This Google account is not linked to that user.', 403);
        }

        $user->update(['login_attempts' => 0, 'is_locked' => false, 'locked_until' => null]);
        $user->tokens()->delete();

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('auth_version', (int) $user->auth_version);

        $this->auditLogin($user, $request, 'success');

        return $this->successResponse([
            'user' => $this->formatUser($user),
            'csrf_token' => $request->session()->token(),
        ], 'Login successful.');
    }

    /** Link a verified Google identity to the currently authenticated account. */
    public function linkGoogle(Request $request): JsonResponse
    {
        $request->validate([
            'credential' => ['required', 'string', 'max:8192'],
            'current_password' => ['required', 'string', 'max:255'],
        ]);

        $identityService = app(GoogleIdentityService::class);
        if (!$identityService->configured()) {
            return $this->errorResponse('Google sign-in is not configured on this server.', 503);
        }

        $identity = $identityService->verifyCredential((string) $request->input('credential'));
        if (!$identity) {
            return $this->errorResponse('Google could not verify this account. Try again.', 422);
        }

        $userId = (int) $request->user()->id;
        $result = DB::transaction(function () use ($identity, $userId, $request) {
            $user = User::query()->whereKey($userId)->lockForUpdate()->firstOrFail();

            // Require a fresh authenticated session for an active account. A
            // verified email alone never links an existing password account.
            if ($user->is_archived || !$user->is_approved || $user->is_locked) {
                return ['error' => 'This account cannot link a Google identity right now.', 'status' => 423];
            }
            if (!Hash::check((string) $request->input('current_password'), (string) $user->password)) {
                return ['error' => 'Enter your current Acadex password to link Google.', 'status' => 422];
            }
            if (strtolower(trim((string) $user->email)) !== $identity['email']) {
                return ['error' => 'Choose the Google account that uses your Acadex email address.', 'status' => 422];
            }
            if ($user->google_id && !hash_equals((string) $user->google_id, $identity['google_id'])) {
                return ['error' => 'A different Google account is already linked. Contact an administrator for help.', 'status' => 409];
            }

            $used = User::query()->where('google_id', $identity['google_id'])
                ->where('id', '<>', $user->id)->exists();
            if ($used) {
                return ['error' => 'This Google account is already linked to another Acadex account.', 'status' => 409];
            }

            if (!$user->google_id) {
                $user->forceFill(['google_id' => $identity['google_id']])->save();
            }

            return ['user' => $user->load('role', 'studentProfile')];
        });

        if (isset($result['error'])) {
            $this->auditGoogleAttempt($request, $identity['email'], 'link_rejected');
            return $this->errorResponse($result['error'], $result['status']);
        }

        AuditLog::log('google_account_linked', $userId, User::class, $userId, null, [
            'email' => $identity['email'],
        ]);

        return $this->successResponse([
            'user' => $this->formatUser($result['user']),
            'google_linked' => true,
        ], 'Google account linked. You can now use Google to sign in.');
    }

    private function provisionProfile(User $user, array $validated, string $roleName): void
    {
        if ($roleName === 'student') {
            StudentProfile::create([
                'user_id' => $user->id,
                'program' => $validated['program'],
                'year' => $validated['year'],
                'section' => $validated['section'],
            ]);
        } elseif ($roleName === 'faculty' && !empty($validated['program'])) {
            $user->update(['faculty_program' => $validated['program']]);
        }
    }

    private function notifyAdminsOfRegistration(User $user, string $roleName): void
    {
        $admins = User::whereHas('role', function ($query) {
            $query->where('name', 'admin');
        })->get();

        foreach ($admins as $admin) {
            Notification::create([
                'admin_id' => $admin->id,
                'type' => 'new_account',
                'title' => 'New Account Registration',
                'message' => "New {$roleName} account registered: {$user->name} ({$user->email})",
                'related_user_id' => $user->id,
                'is_read' => false,
            ]);
        }
    }

    private function auditGoogleAttempt(Request $request, string $email, string $reason): void
    {
        AuditLog::log('google_auth_rejected', null, User::class, null, null, [
            'reason' => $reason,
            'ip_hash' => hash('sha256', (string) $request->ip()),
        ]);
    }

    /* ────────────────────────────────────────────────────
     *  LOGIN
     * ──────────────────────────────────────────────────── */
    public function login(LoginRequest $request): JsonResponse
    {
        $validated = $request->validated();

        $user = User::where('email', strtolower($validated['email']))->first();

        // ── Check lockout ───────────────────────────────
        if ($user && $user->is_locked) {
            if ($user->locked_until && Carbon::now()->lt($user->locked_until)) {
                $this->auditLogin($user, $request, 'locked');

                return $this->errorResponse(
                    'Account is temporarily locked. Try again after ' . $user->locked_until->diffForHumans() . '.',
                    423
                );
            }
            // Lockout expired — reset
            $user->update([
                'is_locked'      => false,
                'login_attempts' => 0,
                'locked_until'   => null,
            ]);
        }

        // ── Validate credentials (prevent user enumeration) ─
        if (! $user || ! Hash::check($validated['password'], $user->password)) {
            if ($user) {
                $attempts = $user->login_attempts + 1;
                $update   = ['login_attempts' => $attempts];

                if ($attempts >= self::MAX_LOGIN_ATTEMPTS) {
                    $update['is_locked']    = true;
                    $update['locked_until'] = Carbon::now()->addMinutes(self::LOCKOUT_MINUTES);
                }

                $user->update($update);
                $this->auditLogin($user, $request, $attempts >= self::MAX_LOGIN_ATTEMPTS ? 'locked' : 'failed');
            }

            return $this->errorResponse('The provided credentials are incorrect.', 401);
        }

        if ($user->is_archived) {
            $this->auditLogin($user, $request, 'failed');
            return $this->errorResponse('Account unavailable. Contact the administrator for restoration.', 423);
        }
        if (!$user->email_verified_at) {
            return response()->json(['success' => false, 'message' => 'Verify your email address before signing in.',
                'email_verification_required' => true], 423);
        }

        if (! $user->is_approved) {
            // Audit as failed login without incrementing attempts
            $this->auditLogin($user, $request, 'failed');

            return $this->errorResponse(
                'Your account is pending approval by an administrator.',
                423
            );
        }

        // ── Success ─────────────────────────────────────
        $user->update(['login_attempts' => 0, 'is_locked' => false, 'locked_until' => null]);

        // Revoke old tokens
        $user->tokens()->delete();

        Auth::guard('web')->login($user);
        $request->session()->regenerate();
        $request->session()->put('auth_version', (int) $user->auth_version);

        $this->auditLogin($user, $request, 'success');

        $user->load('role', 'studentProfile');

        return $this->successResponse([
            'user' => $this->formatUser($user),
            'csrf_token' => $request->session()->token(),
        ], 'Login successful.')->withCookie(cookie()->forget('auth_token', '/', config('session.domain')));
    }

    /* ────────────────────────────────────────────────────
     *  LOGOUT
     * ──────────────────────────────────────────────────── */
    public function logout(Request $request): JsonResponse
    {
        $request->user()->tokens()->delete();
        Auth::guard('web')->logout();
        $request->session()->invalidate();
        $request->session()->regenerateToken();

        return $this->successResponse(['csrf_token' => $request->session()->token()], 'Logged out successfully.')
            ->withCookie(cookie()->forget('auth_token', '/', config('session.domain')));
    }

    /* ────────────────────────────────────────────────────
     *  GET AUTHENTICATED USER
     * ──────────────────────────────────────────────────── */
    public function user(Request $request): JsonResponse
    {
        $user = $request->user()->load('role', 'studentProfile');

        return $this->successResponse([
            'user' => $this->formatUser($user),
        ]);
    }

    /* ────────────────────────────────────────────────────
     *  HELPERS
     * ──────────────────────────────────────────────────── */
    private function formatUser(User $user): array
    {
        $data = [
            'id'         => $user->id,
            'name'       => $user->name,
            'username'   => $user->username,
            'email'      => $user->email,
            'id_number'  => $user->id_number,
            'role'       => $user->role?->name,
            'created_at' => $user->created_at,
            'google_linked' => (bool) $user->google_id,
        ];

        if ($user->studentProfile) {
            $data['student_profile'] = [
                'program' => $user->studentProfile->program,
                'year'    => $user->studentProfile->year,
                'section' => $user->studentProfile->section,
            ];
        }

        // Include faculty program if user is faculty
        if ($user->role?->name === 'faculty' && $user->faculty_program) {
            $data['program'] = $user->faculty_program;
        }

        return $data;
    }

    private function auditLogin(?User $user, Request $request, string $status): void
    {
        LoginAudit::create([
            'user_id'      => $user?->id,
            'email'        => $request->input('email'),
            'ip_address'   => $request->ip(),
            'user_agent'   => $request->userAgent(),
            'status'       => $status === 'locked' ? 'locked' : ($status === 'success' ? 'success' : 'failed'),
            'attempted_at' => now(),
        ]);
    }

    /* ────────────────────────────────────────────────────
     *  UPDATE PROFILE
     * ──────────────────────────────────────────────────── */
    public function updateProfile(Request $request): JsonResponse
    {
        $user = $request->user();

        // Determine what's being updated
        $isEmailChange = $request->has('email');

        $rules = [
            'current_password' => 'required|string',
            'name'             => 'sometimes|string|max:255',
            'username'         => 'sometimes|string|max:255|unique:users,username,' . $user->id,
        ];

        if ($isEmailChange) {
            $rules['email'] = 'required|email|unique:users,email';
            $rules['email_code'] = 'required|string';
        }

        $validator = \Illuminate\Support\Facades\Validator::make($request->all(), $rules);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        if (! Hash::check($request->current_password, $user->password)) {
            return $this->errorResponse('Current password is incorrect.', 400);
        }

        // Handle email change with verification
        if ($isEmailChange) {
            $newEmail = strtolower($request->email);
            $code = $request->email_code;

            app(EmailVerificationService::class)->consume($request, $newEmail);
        }

        $updates = [];
        if ($request->has('name')) $updates['name'] = $request->name;
        if ($request->has('username')) $updates['username'] = $request->username;
        if ($isEmailChange) $updates['email'] = strtolower($request->email);

        if (! empty($updates)) {
            $user->update($updates);
        }
        if ($isEmailChange) {
            $user->forceFill(['email_verified_at' => now()])->save();
            $request->session()->regenerate();
            $request->session()->put('auth_version', (int) $user->auth_version);
        }

        // Update student profile fields if applicable
        if ($user->studentProfile && ($request->has('program') || $request->has('year') || $request->has('section'))) {
            $profileUpdates = [];
            if ($request->has('program')) $profileUpdates['program'] = $request->program;
            if ($request->has('year')) $profileUpdates['year'] = $request->year;
            if ($request->has('section')) $profileUpdates['section'] = $request->section;
            $user->studentProfile->update($profileUpdates);
        }

        // Update faculty program if applicable
        if ($user->role->name === 'faculty' && $request->has('program')) {
            $user->update(['faculty_program' => $request->program]);
        }

        $user->load('role', 'studentProfile');

        return $this->successResponse([
            'user' => $this->formatUser($user),
            'csrf_token' => $request->session()->token(),
        ], 'Profile updated successfully.');
    }
}
