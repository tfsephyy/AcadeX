<?php

namespace App\Providers;

use Illuminate\Support\ServiceProvider;
use Illuminate\Cache\RateLimiting\Limit;
use Illuminate\Http\Request;
use Illuminate\Support\Facades\RateLimiter;

class AppServiceProvider extends ServiceProvider
{
    /**
     * Register any application services.
     */
    public function register(): void
    {
        //
    }

    /**
     * Bootstrap any application services.
     */
    public function boot(): void
    {
        RateLimiter::for('uploads', fn (Request $request) =>
            Limit::perHour(30)->by('uploads:'.$request->user()->id));

        $email = fn (Request $request) => mb_strtolower(trim((string) $request->input('email')));

        // Registration: per-IP burst, per-IP daily cap and per-email hourly cap.
        RateLimiter::for('register', fn (Request $request) => [
            Limit::perMinute(5)->by('register-ip:'.$request->ip()),
            Limit::perDay(20)->by('register-ip-day:'.$request->ip()),
            Limit::perHour(5)->by('register-email:'.$email($request)),
        ]);

        // Login keeps the existing account lockout; these limits slow
        // distributed password guessing without blocking a shared campus IP.
        RateLimiter::for('login', fn (Request $request) => [
            Limit::perMinute(10)->by('login-ip:'.$request->ip()),
            Limit::perMinute(5)->by('login-pair:'.$request->ip().'|'.$email($request)),
        ]);

        RateLimiter::for('forgot-password', fn (Request $request) => [
            Limit::perMinute(3)->by('forgot-pair:'.$request->ip().'|'.$email($request)),
            Limit::perHour(10)->by('forgot-email:'.$email($request)),
            Limit::perDay(20)->by('forgot-email-day:'.$email($request)),
        ]);

        RateLimiter::for('reset-password', fn (Request $request) => [
            Limit::perMinute(5)->by('reset-pair:'.$request->ip().'|'.$email($request)),
        ]);

        RateLimiter::for('verification-send', fn (Request $request) => [
            Limit::perMinute(2)->by('verify-send-email:'.$email($request)),
            Limit::perHour(8)->by('verify-send-email-hour:'.$email($request)),
            Limit::perDay(20)->by('verify-send-email-day:'.$email($request)),
            Limit::perMinute(10)->by('verify-send-ip:'.$request->ip()),
        ]);

        RateLimiter::for('verification-check', fn (Request $request) => [
            Limit::perMinute(10)->by('verify-check:'.$request->ip().'|'.$email($request)),
        ]);

        RateLimiter::for('google-auth', fn (Request $request) => [
            Limit::perMinute(10)->by('google-ip:'.$request->ip()),
            Limit::perMinute(5)->by('google-pair:'.$request->ip().'|'.$email($request)),
        ]);
    }
}
