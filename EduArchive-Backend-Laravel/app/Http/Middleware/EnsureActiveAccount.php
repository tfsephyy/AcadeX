<?php

namespace App\Http\Middleware;

use Closure;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\Auth;
use Symfony\Component\HttpFoundation\Response;

class EnsureActiveAccount
{
    public function handle(Request $request, Closure $next): Response
    {
        $user = $request->user();
        $sessionAuthenticated = Auth::guard('web')->check();
        $token = $user?->currentAccessToken();
        $validSession = !$sessionAuthenticated ||
            (int) $request->session()->get('auth_version', -1) === (int) $user->auth_version;
        $validToken = $sessionAuthenticated || ($token?->expires_at && $token->expires_at->isFuture());

        if (!$user || !$user->is_approved || $user->is_archived ||
            !$user->email_verified_at || !$validSession || !$validToken) {
            if ($sessionAuthenticated) {
                Auth::guard('web')->logout();
                $request->session()->invalidate();
                $request->session()->regenerateToken();
            }

            return response()->json(['success' => false, 'message' => 'Authentication required.'], 401);
        }

        return $next($request);
    }
}
