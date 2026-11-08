<?php

namespace Tests\Unit;

use Fruitcake\Cors\CorsService;
use Symfony\Component\HttpFoundation\Request;
use Tests\TestCase;

class CorsConfigurationTest extends TestCase
{
    private function configuration(string $environment): array
    {
        $saved = [];
        foreach (['APP_ENV' => $environment, 'FRONTEND_URL' => 'https://app.example.invalid',
            'SANCTUM_STATEFUL_DOMAINS' => 'app.example.invalid'] as $key => $value) {
            $saved[$key] = [$_ENV[$key] ?? null, $_SERVER[$key] ?? null, getenv($key)];
            $_ENV[$key] = $_SERVER[$key] = $value;
            putenv($key.'='.$value);
        }
        try {
            return ['cors' => require config_path('cors.php'), 'sanctum' => require config_path('sanctum.php')];
        } finally {
            foreach ($saved as $key => [$env, $server, $process]) {
                if ($env === null) unset($_ENV[$key]); else $_ENV[$key] = $env;
                if ($server === null) unset($_SERVER[$key]); else $_SERVER[$key] = $server;
                putenv($process === false ? $key : $key.'='.$process);
            }
        }
    }

    public function test_both_local_vite_ports_receive_matching_credentialed_preflight_headers(): void
    {
        $config = $this->configuration('local');
        $cors = new CorsService($config['cors']);
        foreach ([5173, 5174] as $port) {
            $origin = 'http://localhost:'.$port;
            $response = $cors->handlePreflightRequest(Request::create('/api/v1/csrf-token', 'OPTIONS', server: [
                'HTTP_ORIGIN' => $origin, 'HTTP_ACCESS_CONTROL_REQUEST_METHOD' => 'GET',
                'HTTP_ACCESS_CONTROL_REQUEST_HEADERS' => 'content-type,x-csrf-token',
            ]));
            self::assertSame($origin, $response->headers->get('Access-Control-Allow-Origin'));
            self::assertSame('true', $response->headers->get('Access-Control-Allow-Credentials'));
            self::assertStringContainsString('Origin', $response->headers->get('Vary'));
            self::assertContains('localhost:'.$port, $config['sanctum']['stateful']);
        }
        self::assertFalse($cors->isOriginAllowed(Request::create('/', server: ['HTTP_ORIGIN' => 'https://untrusted.example.invalid'])));
        self::assertFalse($cors->isOriginAllowed(Request::create('/', server: ['HTTP_ORIGIN' => 'http://localhost:9999'])));
    }

    public function test_development_origins_are_never_added_outside_local_environment(): void
    {
        foreach (['production', 'staging', 'testing'] as $environment) {
            $config = $this->configuration($environment);
            self::assertSame(['https://app.example.invalid'], $config['cors']['allowed_origins']);
            self::assertSame(['app.example.invalid'], $config['sanctum']['stateful']);
            self::assertTrue($config['cors']['supports_credentials']);
            self::assertSame([], $config['cors']['allowed_origins_patterns']);
        }
    }
}
