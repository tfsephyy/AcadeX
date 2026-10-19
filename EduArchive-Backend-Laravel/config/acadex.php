<?php

return [
    'ocr_service_url' => env('OCR_SERVICE_URL', 'http://127.0.0.1:8001'),
    'trusted_proxies' => array_values(array_filter(array_map('trim', explode(',', (string) env('TRUSTED_PROXIES', ''))))),
    'private_temp_path' => env('PRIVATE_TEMP_PATH', storage_path('framework/private-tmp')),
    'max_pending_uploads' => (int) env('MAX_PENDING_UPLOADS', 20),
    'max_pending_upload_bytes' => (int) env('MAX_PENDING_UPLOAD_BYTES', 268435456),
    // Application upload ceiling in bytes. 0 means automatic memory-safe ceiling
    // (capped at 64 MiB under current whole-file encryption with 512M memory_limit).
    // A positive value can only lower the automatic ceiling, never exceed it.
    // Supporting a genuine 128 MiB limit requires a reviewed streaming/chunked encryption
    // design or separately validated server capacity; not supported by current whole-file encryption.
    'max_upload_bytes' => (int) env('ACADEX_MAX_UPLOAD_BYTES', 0),
    'min_free_storage_bytes' => (int) env('MIN_FREE_STORAGE_BYTES', 2147483648),
    // Explicitly opt into legacy plaintext only during an approved transition.
    'allow_legacy_plaintext' => (bool) env('ALLOW_LEGACY_PLAINTEXT_DOCUMENTS', false),
    // Inter-process cache store for upload concurrency locking across PHP-FPM workers.
    // Defaults to null (resolving to cache.default). In production, must be an
    // inter-process atomic store (database, file, redis, etc.); process-local stores (array, null) are rejected.
    'upload_lock_store' => env('UPLOAD_LOCK_STORE', null),
];
