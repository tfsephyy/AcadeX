<?php

return [
    'ocr_service_url' => env('OCR_SERVICE_URL', 'http://127.0.0.1:8001'),
    'trusted_proxies' => array_values(array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))))),
    'private_temp_path' => env('PRIVATE_TEMP_PATH', storage_path('framework/private-tmp')),
    'max_pending_uploads' => (int) env('MAX_PENDING_UPLOADS', 20),
    'max_pending_upload_bytes' => (int) env('MAX_PENDING_UPLOAD_BYTES', 268435456),
    'min_free_storage_bytes' => (int) env('MIN_FREE_STORAGE_BYTES', 2147483648),
    // Explicitly opt into legacy plaintext only during an approved transition.
    'allow_legacy_plaintext' => (bool) env('ALLOW_LEGACY_PLAINTEXT_DOCUMENTS', false),
];
