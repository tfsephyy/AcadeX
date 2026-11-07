<?php

namespace Tests\Feature;

use Illuminate\Support\Facades\DB;
use Illuminate\Support\Facades\Route;
use Tests\SecurityTestCase;

class UploadFailureMessagesTest extends SecurityTestCase
{
    public function test_database_upload_failures_return_readable_json_without_sql_even_in_debug_mode(): void
    {
        config(['app.debug' => true]);
        Route::get('/api/v1/uploads/synthetic-schema-failure', function () {
            return DB::table('synthetic_missing_'.bin2hex(random_bytes(5)))->get();
        });
        $response = $this->getJson('/api/v1/uploads/synthetic-schema-failure')->assertStatus(503)
            ->assertJsonPath('success', false)
            ->assertJsonPath('message', 'Uploads are temporarily unavailable. Please try again shortly or contact the administrator.');
        self::assertStringNotContainsString('SQLSTATE', $response->getContent());
        self::assertStringNotContainsString('synthetic_missing_', $response->getContent());
        self::assertStringNotContainsString('trace', $response->getContent());
    }
}
