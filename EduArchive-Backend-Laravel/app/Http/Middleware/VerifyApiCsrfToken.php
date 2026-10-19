<?php

namespace App\Http\Middleware;

use Illuminate\Foundation\Http\Middleware\ValidateCsrfToken;

class VerifyApiCsrfToken extends ValidateCsrfToken
{
    // Security tests exercise the same CSRF boundary as browser requests.
    protected function runningUnitTests()
    {
        return false;
    }
}
