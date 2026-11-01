<?php

return [
    'ocr_service_url' => env('OCR_SERVICE_URL', 'http://127.0.0.1:8001'),
    'trusted_proxies' => array_values(array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))))),
    'private_temp_path' => env('PRIVATE_TEMP_PATH', storage_path('framework/private-tmp')),
    'max_pending_uploads' => (int) env('MAX_PENDING_UPLOADS', 20),
    'max_pending_upload_bytes' => (int) env('MAX_PENDING_UPLOAD_BYTES', 268435456),
    // 0 means automatic 128 MiB ceiling with bounded stream encryption.
    // A positive value can only lower the automatic ceiling, never exceed it.
    'max_upload_bytes' => (int) env('ACADEX_MAX_UPLOAD_BYTES', 0),
    // Bounds automatic parser/OCR work independently of accepted document size.
    'max_automatic_extraction_bytes' => (int) env('MAX_AUTOMATIC_EXTRACTION_BYTES', 20971520),
    'min_free_storage_bytes' => (int) env('MIN_FREE_STORAGE_BYTES', 2147483648),
    // Explicitly opt into legacy plaintext only during an approved transition.
    'allow_legacy_plaintext' => (bool) env('ALLOW_LEGACY_PLAINTEXT_DOCUMENTS', false),
    // Inter-process cache store for upload concurrency locking across PHP-FPM workers.
    // Defaults to null (resolving to cache.default). In production, must be an
    // inter-process atomic store (database, file, redis, etc.); process-local stores (array, null) are rejected.
    'upload_lock_store' => env('UPLOAD_LOCK_STORE', null),
];
