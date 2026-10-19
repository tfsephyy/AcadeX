<?php

namespace Tests\Feature;

use Tests\SecurityTestCase;

class ProductionConfigurationTest extends SecurityTestCase
{
    public function test_deployment_check_rejects_development_and_accepts_safe_synthetic_settings(): void
    {
        $this->artisan('acadex:check-production')->assertFailed();
        app()->detectEnvironment(fn () => 'production');
        config(['app.debug' => false, 'app.url' => 'https://api.example.invalid',
            'cors.allowed_origins' => ['https://app.example.invalid'], 'session.secure' => true,
            'session.driver' => 'database', 'cache.default' => 'database',
            'acadex.upload_lock_store' => 'database', 'queue.default' => 'database',
            'queue.connections.database.retry_after' => 660]);
        $this->artisan('acadex:check-production')->assertSuccessful();

        // Must reject process-local upload lock store in production
        config(['acadex.upload_lock_store' => 'array']);
        $this->artisan('acadex:check-production')->assertFailed();
        config(['acadex.upload_lock_store' => 'database']);

        config(['queue.connections.database.retry_after' => 90]);
        $this->artisan('acadex:check-production')->assertFailed();
    }
}
