<?php

namespace App\Services;

use Google\Client as GoogleClient;
use GuzzleHttp\Client as GuzzleClient;
use Illuminate\Support\Facades\Log;

/**
 * Verifies Google Identity Services ID tokens without trusting any client
 * supplied profile fields. Google's maintained PHP client verifies the JWT
 * signature against Google's rotating public keys and enforces this app's
 * configured OAuth audience.
 */
class GoogleIdentityService
{
    public function configured(): bool
    {
        return trim((string) config('services.google.client_id')) !== '';
    }

    /**
     * @return array{google_id: string, email: string, name: ?string}|null
     *         Null means the credential was not accepted. Look at lastError for
     *         the user-safe reason category.
     */
    public function verifyCredential(string $credential): ?array
    {
        $this->lastError = 'invalid_or_expired';
        if (!$this->configured()) {
            $this->lastError = 'not_configured';
            return null;
        }

        try {
            $client = new GoogleClient([
                'client_id' => (string) config('services.google.client_id'),
            ]);
            $client->setHttpClient(new GuzzleClient([
                'timeout' => 10,
                'connect_timeout' => 3,
                'http_errors' => false,
            ]));
            $claims = $client->verifyIdToken($credential);
        } catch (\Throwable $error) {
            // Never log the credential or provider response; both may contain
            // identifying information. A transient key-fetch problem is safe
            // to retry by the caller as a fresh sign-in attempt.
            Log::warning('Google ID token verification failed.', [
                'type' => get_class($error),
            ]);
            $this->lastError = 'verification_unavailable';
            return null;
        }

        if (!is_array($claims)) {
            $this->lastError = 'invalid_or_expired';
            return null;
        }

        $audience = (string) ($claims['aud'] ?? '');
        $issuer = (string) ($claims['iss'] ?? '');
        $subject = trim((string) ($claims['sub'] ?? ''));
        $email = strtolower(trim((string) ($claims['email'] ?? '')));
        $verified = filter_var($claims['email_verified'] ?? false, FILTER_VALIDATE_BOOLEAN);

        if (
            $audience !== (string) config('services.google.client_id')
            || !in_array($issuer, ['accounts.google.com', 'https://accounts.google.com'], true)
            || $subject === ''
            || $email === ''
            || !$verified
        ) {
            $this->lastError = 'unverified';
            return null;
        }

        $expiresAt = filter_var($claims['exp'] ?? null, FILTER_VALIDATE_INT);
        if ($expiresAt === false || $expiresAt === null || $expiresAt <= now()->timestamp) {
            $this->lastError = 'expired';
            return null;
        }

        return [
            'google_id' => $subject,
            'email' => $email,
            'name' => trim((string) ($claims['name'] ?? '')) ?: null,
        ];
    }

    public function lastError(): string
    {
        return $this->lastError;
    }

    private string $lastError = 'unknown';
}
