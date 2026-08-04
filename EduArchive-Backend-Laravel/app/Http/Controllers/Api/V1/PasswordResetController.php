<?php

namespace App\Http\Controllers\Api\V1;

use App\Http\Controllers\Controller;
use App\Models\PasswordResetCode;
use App\Models\User;
use App\Traits\ApiResponses;
use Illuminate\Http\JsonResponse;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Hash;
use Illuminate\Support\Facades\Mail;
use Illuminate\Support\Facades\Validator;
use Illuminate\Support\Str;

class PasswordResetController extends Controller
{
    use ApiResponses;

    private const CODE_LENGTH = 7;
    private const CODE_EXPIRY_MINUTES = 10;
    private const RESEND_COOLDOWN_SECONDS = 60;

    /* ─────────────────────────────────────────────────────
     * FORGOT PASSWORD — Send verification code via email
     * ───────────────────────────────────────────────────── */
    public function sendCode(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $email = strtolower($request->email);
        $user = User::where('email', $email)->first();

        if (! $user) {
            return $this->errorResponse('No account found with this email address.', 404);
        }

        // Check cooldown — prevent spam
        $recent = PasswordResetCode::where('email', $email)
            ->where('type', 'password_reset')
            ->where('created_at', '>', now()->subSeconds(self::RESEND_COOLDOWN_SECONDS))
            ->first();

        if ($recent) {
            $secondsLeft = self::RESEND_COOLDOWN_SECONDS - now()->diffInSeconds($recent->created_at);
            return $this->errorResponse(
                "Please wait {$secondsLeft} seconds before requesting a new code.",
                429
            );
        }

        // Invalidate old codes
        PasswordResetCode::where('email', $email)
            ->where('type', 'password_reset')
            ->where('used', false)
            ->update(['used' => true]);

        // Generate new code
        $code = strtoupper(Str::random(self::CODE_LENGTH));

        PasswordResetCode::create([
            'email'      => $email,
            'code'       => $code,
            'type'       => 'password_reset',
            'expires_at' => now()->addMinutes(self::CODE_EXPIRY_MINUTES),
        ]);

        // Send email
        try {
            Mail::send([], [], function ($message) use ($email, $code, $user) {
                $message->to($email)
                    ->subject('EduArchive - Password Reset Code')
                    ->html(
                        "<div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;'>" .
                        "<div style='background: #1B5E20; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;'>" .
                        "<h1 style='color: #fff; margin: 0; font-size: 24px;'>Edu<span style='color: #8BC34A;'>Archive</span></h1>" .
                        "</div>" .
                        "<div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0; border-top: 0;'>" .
                        "<p style='color: #333; font-size: 16px;'>Hi <strong>{$user->name}</strong>,</p>" .
                        "<p style='color: #555; font-size: 14px;'>You requested a password reset. Use the code below to verify your identity:</p>" .
                        "<div style='background: #1B5E20; color: #fff; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 16px; border-radius: 8px; margin: 20px 0;'>{$code}</div>" .
                        "<p style='color: #999; font-size: 12px; text-align: center;'>This code expires in " . self::CODE_EXPIRY_MINUTES . " minutes.</p>" .
                        "<p style='color: #999; font-size: 12px; text-align: center;'>If you did not request this, please ignore this email.</p>" .
                        "</div></div>"
                    );
            });
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to send email. Please try again later.', 500);
        }

        return $this->successResponse(null, 'Verification code sent to your email.');
    }

    /* ─────────────────────────────────────────────────────
     * VERIFY CODE
     * ───────────────────────────────────────────────────── */
    public function verifyCode(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'code'  => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $email = strtolower($request->email);
        $code = strtoupper(trim($request->code));

        $record = PasswordResetCode::where('email', $email)
            ->where('code', $code)
            ->where('type', 'password_reset')
            ->where('used', false)
            ->latest()
            ->first();

        if (! $record || ! $record->isValid()) {
            return $this->errorResponse('Invalid or expired verification code.', 400);
        }

        return $this->successResponse(null, 'Code verified successfully.');
    }

    /* ─────────────────────────────────────────────────────
     * RESET PASSWORD
     * ───────────────────────────────────────────────────── */
    public function resetPassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email'                 => 'required|email',
            'code'                  => 'required|string',
            'password'              => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/',
            ],
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $email = strtolower($request->email);
        $code = strtoupper(trim($request->code));

        // Common password check
        $commonPasswords = [
            'password', 'password1', 'password123', '12345678', '123456789',
            'qwerty123', 'admin123', 'letmein12', 'welcome1', 'iloveyou',
            'sunshine1', 'princess1', 'football1', 'charlie1', 'monkey123',
        ];
        if (in_array(strtolower($request->password), $commonPasswords)) {
            return $this->errorResponse('This password is too common. Please choose a stronger password.', 422);
        }

        $record = PasswordResetCode::where('email', $email)
            ->where('code', $code)
            ->where('type', 'password_reset')
            ->where('used', false)
            ->latest()
            ->first();

        if (! $record || ! $record->isValid()) {
            return $this->errorResponse('Invalid or expired verification code.', 400);
        }

        $user = User::where('email', $email)->first();
        if (! $user) {
            return $this->errorResponse('User not found.', 404);
        }

        // Update password
        $user->update([
            'password' => $request->password,
        ]);

        // Mark code as used
        $record->update(['used' => true]);

        // Send confirmation email (non-critical, don't block on failure)
        try {
            Mail::send([], [], function ($message) use ($email, $user) {
                $message->to($email)
                    ->subject('EduArchive - Password Reset Successful')
                    ->html(
                        "<div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;'>" .
                        "<div style='background: #1B5E20; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;'>" .
                        "<h1 style='color: #fff; margin: 0; font-size: 24px;'>Edu<span style='color: #8BC34A;'>Archive</span></h1>" .
                        "</div>" .
                        "<div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0; border-top: 0;'>" .
                        "<p style='color: #333; font-size: 16px;'>Hi <strong>{$user->name}</strong>,</p>" .
                        "<p style='color: #555; font-size: 14px;'>Your password has been successfully reset.</p>" .
                        "<p style='color: #555; font-size: 14px;'>If you did not make this change, please contact your administrator immediately.</p>" .
                        "</div></div>"
                    );
            });
        } catch (\Exception $e) {
            // Non-critical — password was already reset, just log the failure
            \Log::warning('Failed to send password reset confirmation email: ' . $e->getMessage());
        }

        return $this->successResponse(null, 'Password reset successfully.');
    }

    /* ─────────────────────────────────────────────────────
     * SEND EMAIL VERIFICATION CODE (for signup)
     * ───────────────────────────────────────────────────── */
    public function sendVerificationCode(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $email = strtolower($request->email);

        // Check if email already registered
        if (User::where('email', $email)->exists()) {
            return $this->errorResponse('This email is already registered.', 409);
        }

        // Check cooldown
        $recent = PasswordResetCode::where('email', $email)
            ->where('type', 'email_verification')
            ->where('created_at', '>', now()->subSeconds(self::RESEND_COOLDOWN_SECONDS))
            ->first();

        if ($recent) {
            $secondsLeft = self::RESEND_COOLDOWN_SECONDS - now()->diffInSeconds($recent->created_at);
            return $this->errorResponse(
                "Please wait {$secondsLeft} seconds before requesting a new code.",
                429
            );
        }

        // Invalidate old codes
        PasswordResetCode::where('email', $email)
            ->where('type', 'email_verification')
            ->where('used', false)
            ->update(['used' => true]);

        // Generate new code
        $code = strtoupper(Str::random(self::CODE_LENGTH));

        PasswordResetCode::create([
            'email'      => $email,
            'code'       => $code,
            'type'       => 'email_verification',
            'expires_at' => now()->addMinutes(self::CODE_EXPIRY_MINUTES),
        ]);

        // Send email
        try {
            Mail::send([], [], function ($message) use ($email, $code) {
                $message->to($email)
                    ->subject('EduArchive - Email Verification Code')
                    ->html(
                        "<div style='font-family: Arial, sans-serif; max-width: 500px; margin: 0 auto; padding: 20px;'>" .
                        "<div style='background: #1B5E20; padding: 20px; border-radius: 12px 12px 0 0; text-align: center;'>" .
                        "<h1 style='color: #fff; margin: 0; font-size: 24px;'>Edu<span style='color: #8BC34A;'>Archive</span></h1>" .
                        "</div>" .
                        "<div style='background: #f9f9f9; padding: 30px; border-radius: 0 0 12px 12px; border: 1px solid #e0e0e0; border-top: 0;'>" .
                        "<p style='color: #333; font-size: 16px;'>Welcome to EduArchive!</p>" .
                        "<p style='color: #555; font-size: 14px;'>Use the code below to verify your email address:</p>" .
                        "<div style='background: #1B5E20; color: #fff; font-size: 28px; font-weight: bold; letter-spacing: 6px; text-align: center; padding: 16px; border-radius: 8px; margin: 20px 0;'>{$code}</div>" .
                        "<p style='color: #999; font-size: 12px; text-align: center;'>This code expires in " . self::CODE_EXPIRY_MINUTES . " minutes.</p>" .
                        "</div></div>"
                    );
            });
        } catch (\Exception $e) {
            return $this->errorResponse('Failed to send verification email. Please try again later.', 500);
        }

        return $this->successResponse(null, 'Verification code sent to your email.');
    }

    /* ─────────────────────────────────────────────────────
     * VERIFY EMAIL CODE (for signup)
     * ───────────────────────────────────────────────────── */
    public function verifyEmailCode(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'email' => 'required|email',
            'code'  => 'required|string',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $email = strtolower($request->email);
        $code = strtoupper(trim($request->code));

        $record = PasswordResetCode::where('email', $email)
            ->where('code', $code)
            ->where('type', 'email_verification')
            ->where('used', false)
            ->latest()
            ->first();

        if (! $record || ! $record->isValid()) {
            return $this->errorResponse('Invalid or expired verification code.', 400);
        }

        // Mark as used
        $record->update(['used' => true]);

        return $this->successResponse(null, 'Email verified successfully.');
    }

    /* ─────────────────────────────────────────────────────
     * CHANGE PASSWORD (authenticated user)
     * ───────────────────────────────────────────────────── */
    public function changePassword(Request $request): JsonResponse
    {
        $validator = Validator::make($request->all(), [
            'current_password' => 'required|string',
            'password'         => [
                'required',
                'string',
                'min:8',
                'confirmed',
                'regex:/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d).+$/',
            ],
        ], [
            'password.regex' => 'Password must contain at least one uppercase letter, one lowercase letter, and one number.',
        ]);

        if ($validator->fails()) {
            return $this->errorResponse('Validation failed.', 422, $validator->errors());
        }

        $user = $request->user();

        if (! Hash::check($request->current_password, $user->password)) {
            return $this->errorResponse('Current password is incorrect.', 400);
        }

        if (Hash::check($request->password, $user->password)) {
            return $this->errorResponse('New password must be different from the current password.', 400);
        }

        $user->update([
            'password' => $request->password,
        ]);

        return $this->successResponse(null, 'Password changed successfully.');
    }
}
