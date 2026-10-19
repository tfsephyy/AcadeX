<?php

namespace App\Console\Commands;

use Illuminate\Console\Command;

class CheckProduction extends Command
{
    protected $signature = 'acadex:check-production';
    protected $description = 'Validate deployment configuration without displaying secrets or accessing records.';

    public function handle(): int
    {
        $key = (string) config('app.key');
        if (str_starts_with($key, 'base64:')) $key = base64_decode(substr($key, 7), true) ?: '';
        $checks = [
            'APP_ENV' => app()->environment('production'),
            'APP_DEBUG' => config('app.debug') === false,
            'APP_KEY' => \Illuminate\Encryption\Encrypter::supported($key, config('app.cipher')),
            'APP_URL' => $this->httpsOrigin(config('app.url')),
            'FRONTEND_URL' => $this->httpsOrigin(config('cors.allowed_origins.0')),
            'DB_CONNECTION' => config('database.default') === 'mysql',
            'SESSION_SECURE_COOKIE' => config('session.secure') === true,
            'SESSION_HTTP_ONLY' => config('session.http_only') === true,
            'SESSION_DRIVER' => !in_array(config('session.driver'), ['array', 'null'], true),
            'ALLOW_LEGACY_PLAINTEXT_DOCUMENTS' => config('acadex.allow_legacy_plaintext') === false,
        ];
        $connection = config('queue.default');
        if (in_array($connection, ['database', 'redis', 'beanstalkd'], true)) {
            $checks['QUEUE_RETRY_AFTER'] = config("queue.connections.$connection.retry_after") > 600;
        }
        $url = parse_url(config('acadex.ocr_service_url'));
        $checks['OCR_SERVICE_URL'] = is_array($url) && in_array($url['host'] ?? '', ['127.0.0.1', '::1', 'localhost'], true)
            && in_array($url['scheme'] ?? '', ['http', 'https'], true);
        foreach ($checks as $name => $passed) $this->line($name.': '.($passed ? 'PASSED' : 'FAILED'));
        $this->line('This check does not prove provider, browser, file permissions, database migrations or restore readiness.');
        return in_array(false, $checks, true) ? self::FAILURE : self::SUCCESS;
    }

    private function httpsOrigin(?string $value): bool
    {
        $url = parse_url($value ?? '');
        return is_array($url) && ($url['scheme'] ?? '') === 'https' && !empty($url['host']) &&
            !in_array($url['host'], ['localhost', '127.0.0.1', '::1'], true) &&
            !isset($url['user']) && !isset($url['pass']) && !isset($url['query']) && !isset($url['fragment']) &&
            in_array($url['path'] ?? '', ['', '/'], true);
    }
}
