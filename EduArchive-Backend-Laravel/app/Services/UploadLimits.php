<?php

namespace App\Services;

/**
 * Reads the PHP request/upload ceilings and calculates memory-safe upload limits
 * for whole-file encryption.
 */
class UploadLimits
{
    public const CURRENT_ENCRYPTION_MAX_BYTES = 64 * 1024 * 1024; // 64 MiB maximum for whole-file encryption
    public const MEMORY_BASELINE_BYTES = 96 * 1024 * 1024;         // 96 MiB framework/runtime baseline overhead
    public const WHOLE_FILE_ENCRYPTION_FACTOR = 6.0;               // Conservative ratio of peak memory to file size

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
     * Pure calculation of the memory-safe upload ceiling from a given memory_limit (in bytes).
     *
     * - If memory_limit is unlimited (<= 0), returns at most 64 MiB.
     * - If memory_limit is above baseline, calculates floor((memoryLimit - baseline) / factor) clamped to 64 MiB.
     * - Does not force a 10 MiB minimum.
     * - If memory_limit is at or below baseline, returns 0 (fails closed, no safe capacity).
     */
    public static function calculateMemorySafeCeiling(int $memoryLimitBytes): int
    {
        if ($memoryLimitBytes <= 0) {
            return self::CURRENT_ENCRYPTION_MAX_BYTES;
        }

        if ($memoryLimitBytes <= self::MEMORY_BASELINE_BYTES) {
            return 0;
        }

        $available = $memoryLimitBytes - self::MEMORY_BASELINE_BYTES;
        $calculated = (int) floor($available / self::WHOLE_FILE_ENCRYPTION_FACTOR);

        return min($calculated, self::CURRENT_ENCRYPTION_MAX_BYTES);
    }

    /**
     * Calculate a conservative maximum upload ceiling from the configured memory_limit
     * so that uploads never exceed the server's memory budget or trigger OOM kills.
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
