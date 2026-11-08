<?php

$origins = [env('FRONTEND_URL', 'http://localhost:5173')];
// Vite uses 5174 when another local development server already owns 5173.
// Never add development origins to a production/staging configuration.
if (env('APP_ENV') === 'local') {
    $origins = array_values(array_unique(array_merge($origins, [
        'http://localhost:5173',
        'http://localhost:5174',
    ])));
}

return [

    /*
    |--------------------------------------------------------------------------
    | Cross-Origin Resource Sharing (CORS) Configuration
    |--------------------------------------------------------------------------
    */

    'paths' => ['api/*', 'sanctum/csrf-cookie'],

    'allowed_methods' => ['*'],

    'allowed_origins' => $origins,

    'allowed_origins_patterns' => [],

    'allowed_headers' => ['*'],

    // PDF.js needs to read these cross-origin response headers to detect and
    // use authenticated byte-range responses for large documents.
    'exposed_headers' => ['Accept-Ranges', 'Content-Range', 'Content-Length', 'ETag'],

    'max_age' => 0,

    'supports_credentials' => true,

];
