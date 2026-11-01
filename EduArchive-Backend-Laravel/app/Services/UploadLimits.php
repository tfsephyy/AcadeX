<?php

namespace App\Services;

/**
 * Reads PHP ceilings and enforces the bounded-stream file limit.
 */
class UploadLimits
{
    public const CURRENT_ENCRYPTION_MAX_BYTES = 128 * 1024 * 1024;
    public const MEMORY_BASELINE_BYTES = 96 * 1024 * 1024;         // 96 MiB framework/runtime baseline overhead
    public const STREAM_MEMORY_HEADROOM_BYTES = 32 * 1024 * 1024;

    /**
     * Convert a PHP ini shorthand size (64M, 1G, 512K, -1) to bytes.
     * Returns 0 for unlimited/disabled values so callers can opt out.
     */
    public static function bytesFromIni(string|false|null $value): int
    {
        if ($value === false || $value === null) return 0;
        $value = trim((string) $value);
        if ($value === '') return 0;

        if (is_numeric($value)) {
            $bytes = (float) $value;
        } else {
            $unit = strtolower(substr($value, -1));
            $number = (float) substr($value, 0, -1);
            $bytes = match ($unit) {
                'k' => $number * 1024,
                'm' => $number * 1024 * 1024,
                'g' => $number * 1024 * 1024 * 1024,
                't' => $number * 1024 * 1024 * 1024 * 1024,
                default => 0,
            };
        }

        return $bytes > 0 ? (int) round($bytes) : 0;
    }

    public function fileMaxBytes(): int
    {
        return self::bytesFromIni(ini_get('upload_max_filesize'));
    }

    public function postMaxBytes(): int
    {
        return self::bytesFromIni(ini_get('post_max_size'));
    }

    public function configuredAppMaxBytes(): int
    {
        return max(0, (int) config('acadex.max_upload_bytes', 0));
    }

    public function memoryLimitBytes(): int
    {
        return self::bytesFromIni(ini_get('memory_limit'));
    }

    public function rawMemoryLimit(): string
    {
        $val = ini_get('memory_limit');
        return $val === false || $val === '' ? 'unset' : (string) $val;
    }

    /**
     * Diagnostic representation separating unconstrained memory (-1) from zero safe capacity.
     */
    public function memoryLimitSummary(): string
    {
        $raw = $this->rawMemoryLimit();
        if ($raw === '-1') {
            return '-1 (unlimited)';
        }

        $bytes = $this->memoryLimitBytes();
        if ($bytes <= 0) {
            return $raw.' (0 bytes / no safe capacity)';
        }

        return $this->humanBytes($bytes).' (raw: '.$raw.')';
    }

    /**
     * Streaming needs fixed headroom instead of a multiple of the file size.
     * Never bypass the application limit, including with unlimited PHP memory.
     */
    public static function calculateMemorySafeCeiling(int $memoryLimitBytes): int
    {
        if ($memoryLimitBytes <= 0) {
            return self::CURRENT_ENCRYPTION_MAX_BYTES;
        }

        if ($memoryLimitBytes < self::MEMORY_BASELINE_BYTES + self::STREAM_MEMORY_HEADROOM_BYTES) {
            return 0;
        }

        return self::CURRENT_ENCRYPTION_MAX_BYTES;
    }

    /**
     * Check the fixed memory envelope needed by streamed upload processing.
     */
    public function memorySafeUploadCeiling(): int
    {
        return self::calculateMemorySafeCeiling($this->memoryLimitBytes());
    }

    /**
     * Returns true if the environment has sufficient memory to process uploads safely.
     * If false, uploads must fail closed.
     */
    public function hasSafeUploadMemory(?int $memoryLimitBytes = null): bool
    {
        $bytes = $memoryLimitBytes ?? $this->memoryLimitBytes();
        if ($bytes <= 0) {
            return true;
        }

        return $bytes > self::MEMORY_BASELINE_BYTES && self::calculateMemorySafeCeiling($bytes) > 0;
    }

    /**
     * Pure calculation of the effective application ceiling:
     * - ACADEX_MAX_UPLOAD_BYTES=0 means automatic safe application ceiling.
     * - A positive value can only lower the automatic ceiling, never raise or bypass it.
     * - If safe ceiling is 0, effective is 0 (fails closed).
     */
    public static function calculateEffectiveAppMaxBytes(int $safeCeiling, int $configuredMaxBytes): int
    {
        if ($safeCeiling <= 0) {
            return 0;
        }

        if ($configuredMaxBytes > 0) {
            return min($configuredMaxBytes, $safeCeiling);
        }

        return $safeCeiling;
    }

    /**
     * Effective application ceiling.
     * - ACADEX_MAX_UPLOAD_BYTES=0 means automatic safe application ceiling.
     * - A positive ACADEX_MAX_UPLOAD_BYTES may lower the automatic ceiling.
     * - A positive configured value must never raise or bypass the automatic memory-safe ceiling.
     */
    public function appMaxBytes(): int
    {
        $safe = $this->memorySafeUploadCeiling();
        $configured = $this->configuredAppMaxBytes();

        return self::calculateEffectiveAppMaxBytes($safe, $configured);
    }

    /**
     * The smallest positive ceiling that applies to a single upload.
     * If there is no safe upload memory (safe capacity is 0), returns 0.
     */
    public function effectiveMaxBytes(): int
    {
        if (!$this->hasSafeUploadMemory()) {
            return 0;
        }

        $appMax = $this->appMaxBytes();
        if ($appMax <= 0) {
            return 0;
        }

        $limits = array_filter([
            $this->fileMaxBytes(),
            $this->postMaxBytes(),
            $appMax,
        ], fn (int $bytes) => $bytes > 0);

        return $limits === [] ? $appMax : min($limits);
    }

    public function humanBytes(int $bytes): string
    {
        if ($bytes === 0) return '0 bytes';
        if ($bytes < 0) return 'unlimited';
        if ($bytes >= 1024 * 1024 * 1024) return rtrim(rtrim(number_format($bytes / (1024 * 1024 * 1024), 1), '0'), '.').' GB';
        if ($bytes >= 1024 * 1024) return rtrim(rtrim(number_format($bytes / (1024 * 1024), 1), '0'), '.').' MB';
        if ($bytes >= 1024) return rtrim(rtrim(number_format($bytes / 1024, 1), '0'), '.').' KB';
        return $bytes.' bytes';
    }

    public function serverSummary(): string
    {
        return $this->humanBytes($this->fileMaxBytes()).' per file / '
            .$this->humanBytes($this->postMaxBytes()).' per request';
    }
}
