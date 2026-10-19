<?php

namespace App\Services;

use App\Models\PasswordResetCode;
use Illuminate\Http\Request;
use Illuminate\Validation\ValidationException;

class EmailVerificationService
{
    public function consume(Request $request, string $email): void
    {
        $email = strtolower(trim($email));
        $proofs = $request->session()->get('verified_emails', []);
        $proof = $proofs[$email] ?? null;
        unset($proofs[$email]);
        $request->session()->put('verified_emails', $proofs);

        if (!$proof || ($proof['expires_at'] ?? 0) <= now()->timestamp ||
            !PasswordResetCode::whereKey($proof['id'])->where('email', $email)
                ->where('type', 'email_verification')->where('used', true)
                ->where('expires_at', '>', now())->delete()) {
            throw ValidationException::withMessages(['email' => 'Verify this email address before continuing.']);
        }
    }
}
