<?php

namespace App\Models;

use Illuminate\Database\Eloquent\Model;

class DocumentUpload extends Model
{
    public const STATUS_QUEUED = 'queued';
    public const STATUS_PROCESSING = 'processing';
    public const STATUS_COMPLETED = 'completed';
    public const STATUS_FAILED = 'failed';
    public const STATUS_SKIPPED = 'skipped';

    public $incrementing = false;
    protected $keyType = 'string';
    protected $fillable = [
        'id',
        'user_id',
        'purpose',
        'path',
        'capstone_id',
        'expires_at',
        'processing_status',
        'original_name',
        'extraction_result',
        'processing_error',
        'processing_started_at',
        'processing_completed_at',
    ];
    protected $hidden = ['path'];
    protected $casts = [
        'expires_at' => 'datetime',
        'extraction_result' => 'array',
        'processing_started_at' => 'datetime',
        'processing_completed_at' => 'datetime',
    ];

    public function reference(): string
    {
        return 'upload:'.$this->id;
    }

    public function isTerminal(): bool
    {
        return in_array($this->processing_status, [
            self::STATUS_COMPLETED,
            self::STATUS_FAILED,
            self::STATUS_SKIPPED,
        ], true);
    }

    /** Payload stored by the metadata job. Keeps scope next to the metadata. */
    public static function resultPayload(array $metadata, string $scope, array $notes = []): array
    {
        return [
            'data' => $metadata,
            'scope' => $scope,
            'notes' => $notes,
        ];
    }

    public function extractedMetadata(): array
    {
        return is_array($this->extraction_result['data'] ?? null)
            ? $this->extraction_result['data']
            : [];
    }

    public function extractionScope(): string
    {
        return (string) ($this->extraction_result['scope'] ?? 'full_document');
    }
}
