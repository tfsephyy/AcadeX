<?php

// This runner has no archive-database fallback and never clears its config cache.
$base = dirname(__DIR__);
chdir($base);
require $base.'/vendor/autoload.php';
try {
$file = $base.'/.env.testing';
if (!is_file($file)) throw new RuntimeException('A privately provisioned .env.testing is required.');
$values = Dotenv\Dotenv::parse(file_get_contents($file));
$database = $values['DB_DATABASE'] ?? '';
$archive = is_file($base.'/.env') ? Dotenv\Dotenv::parse(file_get_contents($base.'/.env')) : [];
if (($values['APP_ENV'] ?? '') !== 'testing' || ($values['DB_CONNECTION'] ?? '') !== 'mysql' ||
    !in_array($values['DB_HOST'] ?? '', ['localhost', '127.0.0.1', '::1'], true) ||
    !empty($values['DB_URL']) ||
    !preg_match('/^acadex_remediation_test_[a-f0-9]{10}$/D', $database) ||
    $database === ($archive['DB_DATABASE'] ?? null)) {
    throw new RuntimeException('Refusing non-disposable or archive database configuration.');
}
// A process-level connection URL must never override the dedicated test DB.
putenv('DB_URL');
unset($_ENV['DB_URL'], $_SERVER['DB_URL']);
foreach ($values as $name => $value) {
    putenv($name.'='.$value);
    $_ENV[$name] = $_SERVER[$name] = $value;
}
if (is_file($values['APP_CONFIG_CACHE'] ?? $base.'/bootstrap/cache/config.php')) {
    throw new RuntimeException('Refusing cached test configuration; inspect its origin privately.');
}
$pdo = new PDO('mysql:host='.$values['DB_HOST'].';port='.$values['DB_PORT'].';dbname='.$database.';charset=utf8mb4',
    $values['DB_USERNAME'], $values['DB_PASSWORD'], [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION]);
if ($pdo->query('SELECT DATABASE()')->fetchColumn() !== $database) throw new RuntimeException('Connection guard failed.');
foreach ($pdo->query('SHOW GRANTS')->fetchAll(PDO::FETCH_COLUMN) as $grant) {
    if (!str_starts_with($grant, 'GRANT USAGE ON *.* ') && !str_contains($grant, ' ON `'.$database.'`.* ')) {
        throw new RuntimeException('Test credentials must be scoped exclusively to the disposable schema.');
    }
}
echo 'Verified disposable MySQL connection: '.$database.PHP_EOL;
chdir($base);
if (in_array($argv[1] ?? '', ['--migrate', '--inspect', '--http-check', '--ocr-check'], true)) {
    $app = require $base.'/bootstrap/app.php';
    $kernel = $app->make(Illuminate\Contracts\Console\Kernel::class);
    $kernel->bootstrap();
    if (config('database.connections.mysql.database') !== $database || config('database.default') !== 'mysql' ||
        config('database.connections.mysql.url')) {
        throw new RuntimeException('Laravel database guard failed.');
    }
    if ($argv[1] === '--migrate') exit($kernel->call('migrate', ['--force' => true], new Symfony\Component\Console\Output\ConsoleOutput));
    if ($argv[1] === '--http-check') {
        require __DIR__.'/http-security-probe.php';
        exit(0);
    }
    if ($argv[1] === '--ocr-check') {
        config(['acadex.ocr_service_url' => 'http://127.0.0.1:18882']);
        $file = realpath($base.'/../.local/remediation-test/synthetic-scan.pdf');
        if (!$file) throw new RuntimeException('The synthetic OCR probe must create its fixture first.');
        $service = app(App\Services\PdfExtractorService::class);
        $method = new ReflectionMethod($service, 'extractPagesViaPaddleOcr');
        $pages = $method->invoke($service, $file);
        if (!str_contains(strtoupper(implode(' ', $pages)), 'SYNTHETIC')) throw new RuntimeException('Laravel/Python OCR connector failed.');
        $metadata = $service->extract(new Illuminate\Http\UploadedFile($file, 'synthetic-scan.pdf', 'application/pdf', null, true));
        if (!str_contains(strtoupper($metadata['title'] ?? ''), 'SYNTHETIC')) throw new RuntimeException('Scanned PDF metadata extraction failed.');
        echo 'Live Laravel to private Uvicorn scanned-PDF connector and metadata: PASSED'.PHP_EOL;
        exit(0);
    }
    $path = $app->getCachedConfigPath();
    $allowed = realpath($base.'/../.local/remediation-test');
    if (realpath(dirname($path)) !== $allowed || !$allowed || is_file($path)) throw new RuntimeException('Unsafe cache target.');
    try {
        if ($kernel->call('config:cache') !== 0) throw new RuntimeException('Config cache generation failed.');
        $cached = require $path;
        if ($cached['database']['connections']['mysql']['database'] !== $database ||
            $cached['acadex']['ocr_service_url'] !== config('acadex.ocr_service_url')) throw new RuntimeException('Cached configuration mismatch.');
        echo 'Isolated config cache and OCR configuration: PASSED'.PHP_EOL;
        echo 'Routes: '.count($app['router']->getRoutes()).PHP_EOL;
        $routePath = $app->getCachedRoutesPath();
        if (realpath(dirname($routePath)) !== $allowed || is_file($routePath)) throw new RuntimeException('Unsafe route cache target.');
        try {
            if ($kernel->call('route:cache') !== 0 || !is_file($routePath)) throw new RuntimeException('Route cache failed.');
            echo 'Isolated route cache: PASSED'.PHP_EOL;
        } finally {
            if (is_file($routePath)) unlink($routePath);
        }
        $kernel->call('migrate:status', [], new Symfony\Component\Console\Output\ConsoleOutput);
    } finally {
        if (is_file($path)) unlink($path); // Only this run's isolated cache; never application cache.
    }
    exit(0);
}
$args = array_slice($argv, 1);
$command = array_merge([PHP_BINARY, $base.'/vendor/phpunit/phpunit/phpunit', '--do-not-cache-result'], $args);
$process = proc_open($command, [0 => STDIN, 1 => STDOUT, 2 => STDERR], $pipes, $base);
exit(proc_close($process));
} catch (Throwable $error) {
    // Never let Laravel's console exception handler turn a failed probe into exit 0,
    // or disclose a password-bearing connection string/account in the diagnostic.
    fwrite(STDERR, 'Guarded validation FAILED: '.get_class($error).'. Inspect the isolated test configuration and probe logs privately.'.PHP_EOL);
    exit(1);
}
