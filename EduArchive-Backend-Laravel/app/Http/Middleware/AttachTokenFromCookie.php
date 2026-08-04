<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Symfony\Component\HttpFoundation\Response;

class AttachTokenFromCookie
{
    /**
     * If the request has an `auth_token` cookie but no Authorization header,
     * attach the cookie value as a Bearer token so Sanctum can authenticate.
     */
    public function handle(Request $request, Closure $next): Response
    {
        $token = $request->cookie('auth_token');

        if ($token && ! $request->hasHeader('Authorization')) {
            $request->headers->set('Authorization', 'Bearer ' . $token);
        }

        return $next($request);
    }
}
