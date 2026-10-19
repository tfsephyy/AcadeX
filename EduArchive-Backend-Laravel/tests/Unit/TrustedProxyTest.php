<?php

namespace Tests\Unit;

use App\Http\Middleware\TrustConfiguredProxies;
use Illuminate\Http\Request;
use Tests\TestCase;

class TrustedProxyTest extends TestCase
{
    public function test_only_explicit_proxies_can_supply_https_and_client_ip(): void
    {
        config(['acadex.trusted_proxies' => ['192.0.2.0/24']]);
        foreach (['198.51.100.1' => false, '192.0.2.1' => true] as $source => $trusted) {
            $request = Request::create('http://api.example.invalid/up', 'GET', [], [], [],
                ['REMOTE_ADDR' => $source, 'HTTP_X_FORWARDED_PROTO' => 'https', 'HTTP_X_FORWARDED_FOR' => '203.0.113.5']);
            (new TrustConfiguredProxies)->handle($request, function ($request) use ($trusted, $source) {
                self::assertSame($trusted, $request->isSecure());
                self::assertSame($trusted ? '203.0.113.5' : $source, $request->ip());
            });
        }
    }
}
