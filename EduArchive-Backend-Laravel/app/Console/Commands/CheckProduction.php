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

        // Upload concurrency lock store checks (must implement LockProvider and be inter-process)
        $lockStore = config('acadex.upload_lock_store') ?: config('cache.default', 'database');
        $driver = config("cache.stores.{$lockStore}.driver", $lockStore);
        $isLockProvider = false;
        try {
            $isLockProvider = \Illuminate\Support\Facades\Cache::store($lockStore)->getStore() instanceof \Illuminate\Contracts\Cache\LockProvider;
        } catch (\Throwable) {
            $isLockProvider = false;
        }
        $isInterProcess = !in_array($driver, ['array', 'null'], true) &&
            in_array($driver, ['database', 'file', 'redis', 'memcached', 'dynamodb'], true);

        $checks['UPLOAD_LOCK_STORE_LOCK_PROVIDER'] = $isLockProvider;
        $checks['UPLOAD_LOCK_STORE_INTER_PROCESS'] = $isInterProcess;

        $limits = app(\App\Services\UploadLimits::class);
        foreach ($checks as $name => $passed) $this->line($name.': '.($passed ? 'PASSED' : 'FAILED'));

        $this->line('UPLOAD_LOCK_STORE: '.$lockStore);
        $this->line('UPLOAD_LOCK_PROVIDER_CONTRACT: '.($isLockProvider ? 'PASSED' : 'FAILED'));
        $this->line('UPLOAD_LOCK_INTER_PROCESS: '.($isInterProcess ? 'PASSED' : 'FAILED'));

        // CLI and PHP-FPM read different ini files, so these are informational.
        // Verify the deployed web limit with an authenticated test upload, not
        // with the CLI value printed here.
        $this->line('CLI_UPLOAD_MAX_FILESIZE: '.$limits->humanBytes($limits->fileMaxBytes()));
        $this->line('CLI_POST_MAX_SIZE: '.$limits->humanBytes($limits->postMaxBytes()));
        $this->line('CLI_MEMORY_LIMIT: '.$limits->memoryLimitSummary());
        $this->line('CALCULATED_MEMORY_SAFE_CEILING: '.$limits->humanBytes($limits->memorySafeUploadCeiling()));
        $this->line('CONFIGURED_APPLICATION_CEILING: '.$limits->humanBytes($limits->configuredAppMaxBytes()));
        $this->line('EFFECTIVE_APPLICATION_CEILING: '.$limits->humanBytes($limits->effectiveMaxBytes()));
        $this->line('WARNING: CLI php.ini values are informational and do not prove PHP-FPM/web-SAPI values. PHP-FPM upload limits may differ from CLI; public/.user.ini or the FPM conf.d file is authoritative.');
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
