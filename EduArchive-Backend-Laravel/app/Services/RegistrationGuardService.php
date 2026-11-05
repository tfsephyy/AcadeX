<?php

namespace App\Services;

use Illuminate\Http\Request;
use Illuminate\Support\Facades\Log;
use Illuminate\Support\Facades\Http;
use Illuminate\Validation\ValidationException;

/**
 * Bot protection for the public registration endpoints.
 *
 * Layer 1: a honeypot field that real users never see.
 * Layer 2: a signed, time-limited challenge token. Registration must happen
 *          after a minimum completion time; there is no server session state.
 * Layer 3: optional Cloudflare Turnstile, enforced only when a secret exists.
 */
class RegistrationGuardService
{
    public const HONEYPOT_FIELD = 'website';

    public function challenge(): array
    {
        $issuedAt = now()->timestamp;
        $nonce = bin2hex(random_bytes(16));
        $payload = $this->encode($issuedAt.'.'.$nonce);
        $signature = hash_hmac('sha256', $payload, (string) config('app.key'));

        return [
            'challenge' => $payload.'.'.$signature,
            'min_seconds' => max(0, (int) config('acadex.registration_min_seconds', 4)),
            'turnstile_site_key' => config('acadex.turnstile_site_key'),
            'turnstile_required' => trim((string) config('acadex.turnstile_secret')) !== '',
        ];
    }

    public function verify(Request $request): void
    {
        if (!$this->honeypotPassed($request) || !$this->challengePassed($request) || !$this->turnstilePassed($request)) {
            Log::warning('Registration bot check rejected a request.', [
                'ip_hash' => hash('sha256', (string) $request->ip()),
                'reason' => $this->lastReason,
            ]);

            throw ValidationException::withMessages([
                'registration' => 'Registration could not be completed. Refresh the page and try again.',
            ]);
        }
    }

    private function honeypotPassed(Request $request): bool
    {
        $value = trim((string) $request->input(self::HONEYPOT_FIELD, ''));
        if ($value !== '') {
            $this->lastReason = 'honeypot';
            return false;
        }
        return true;
    }

    private function challengePassed(Request $request): bool
    {
        if (!config('acadex.registration_challenge', true)) {
            return true;
        }

        $token = (string) $request->input('registration_challenge', '');
        $parts = explode('.', $token);
        if (count($parts) !== 2) {
            $this->lastReason = 'challenge_missing';
            return false;
        }

        [$payload, $signature] = $parts;
        $expected = hash_hmac('sha256', $payload, (string) config('app.key'));
        if (!hash_equals($expected, $signature)) {
            $this->lastReason = 'challenge_signature';
            return false;
        }

        $decoded = $this->decode($payload);
        if ($decoded === null || !str_contains($decoded, '.')) {
            $this->lastReason = 'challenge_payload';
            return false;
        }

        [$issuedAt] = explode('.', $decoded, 2);
        if (!ctype_digit($issuedAt)) {
            $this->lastReason = 'challenge_time';
            return false;
        }

        $age = now()->timestamp - (int) $issuedAt;
        $minimum = max(0, (int) config('acadex.registration_min_seconds', 4));
        if ($age < $minimum || $age > 3600) {
            $this->lastReason = $age < $minimum ? 'challenge_too_fast' : 'challenge_expired';
            return false;
        }

        return true;
    }

    private function turnstilePassed(Request $request): bool
    {
        $secret = trim((string) config('acadex.turnstile_secret'));
        if ($secret === '') {
            return true;
        }

        $responseToken = (string) $request->input('cf-turnstile-response', '');
        if ($responseToken === '') {
            $this->lastReason = 'turnstile_missing';
            return false;
        }

        try {
            $response = Http::asForm()->timeout(10)->post(
                (string) config('acadex.turnstile_verify_url'),
                [
                    'secret' => $secret,
                    'response' => $responseToken,
                    'remoteip' => $request->ip(),
                ]
            );

            if ($response->successful() && filter_var($response->json('success', false), FILTER_VALIDATE_BOOLEAN)) {
                return true;
            }
        } catch (\Throwable $error) {
            // Fail closed for configured Turnstile; otherwise a network outage
            // would silently disable bot protection.
            Log::warning('Turnstile verification failed.', ['type' => get_class($error)]);
        }

        $this->lastReason = 'turnstile_failed';
        return false;
    }

    private function encode(string $value): string
    {
        return rtrim(strtr(base64_encode($value), '+/', '-_'), '=');
    }

    private function decode(string $value): ?string
    {
        $padded = str_pad(strtr($value, '-_', '+/'), (int) (ceil(strlen($value) / 4) * 4), '=');
        $decoded = base64_decode($padded, true);
        return $decoded === false ? null : $decoded;
    }

    private string $lastReason = 'unknown';
}
