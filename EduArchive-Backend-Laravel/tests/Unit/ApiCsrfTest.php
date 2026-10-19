<?php

namespace Tests\Unit;

use App\Http\Middleware\VerifyApiCsrfToken;
use Illuminate\Cookie\CookieJar;
use Illuminate\Encryption\Encrypter;
use Illuminate\Http\Request;
use Illuminate\Session\ArraySessionHandler;
use Illuminate\Session\Store;
use Illuminate\Session\TokenMismatchException;
use PHPUnit\Framework\TestCase;

class ApiCsrfTest extends TestCase
{
    private function middleware(): VerifyApiCsrfToken
    {
        $app = new \Illuminate\Foundation\Application(dirname(__DIR__, 2));
        $app->instance('config', new \Illuminate\Config\Repository([
            'session' => ['lifetime' => 120, 'path' => '/', 'domain' => null, 'secure' => false, 'same_site' => 'lax'],
        ]));
        $app->instance('cookie', new CookieJar);
        return new VerifyApiCsrfToken($app, new Encrypter(random_bytes(32), 'AES-256-CBC'));
    }

    private function request(string $method, ?string $header): Request
    {
        $request = Request::create('/api/v1/login', $method);
        $session = new Store('test', new ArraySessionHandler(120));
        $session->start();
        $session->put('_token', str_repeat('a', 40));
        $request->setLaravelSession($session);
        if ($header !== null) $request->headers->set('X-CSRF-TOKEN', $header);
        return $request;
    }

    public function test_missing_and_forged_tokens_are_rejected_even_under_phpunit(): void
    {
        foreach ([null, str_repeat('b', 40)] as $token) {
            try {
                $this->middleware()->handle($this->request('POST', $token), fn () => new \Illuminate\Http\Response('unexpected'));
                self::fail('Unsafe API request bypassed CSRF.');
            } catch (TokenMismatchException) {
                self::assertTrue(true);
            }
        }
    }

    public function test_session_bound_header_is_accepted(): void
    {
        $response = $this->middleware()->handle($this->request('POST', str_repeat('a', 40)),
            fn () => new \Illuminate\Http\Response('accepted'));
        self::assertSame('accepted', $response->getContent());
    }
}
