<?php

namespace App\Services;

use Closure;
use RuntimeException;
use Symfony\Component\HttpFoundation\StreamedResponse;

/** Owns the locked ciphertext handle until response/copy completion. */
final class VerifiedDocument
{
    /** @param resource $source */
    public function __construct(private $source, private Closure $reader, private int $length) {}

    public function size(): int { return $this->length; }

    /** @param resource $output */
    public function copyTo($output): void
    {
        if (!is_resource($this->source)) throw new RuntimeException('Document is closed.');
        foreach (($this->reader)() as $chunk) self::writeAll($output, $chunk);
    }

    /** Compatibility helper for small callers only; large responses must stream. */
    public function contents(): string
    {
        if ($this->length > 64 * 1024 * 1024) throw new RuntimeException('Large documents must be streamed.');
        if (!is_resource($this->source)) throw new RuntimeException('Document is closed.');
        $contents = '';
        foreach (($this->reader)() as $chunk) $contents .= $chunk;
        return $contents;
    }

    public function response(array $headers): StreamedResponse
    {
        return response()->stream(function () {
            $output = fopen('php://output', 'wb');
            try {
                $this->copyTo($output);
            } finally {
                if (is_resource($output)) fclose($output);
                $this->close();
            }
        }, 200, array_merge($headers, [
            'Content-Length' => (string) $this->length,
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
            'X-Accel-Buffering' => 'no',
        ]));
    }

    /** @param resource $target */
    public static function writeAll($target, string $bytes): void
    {
        $offset = 0;
        while ($offset < strlen($bytes)) {
            $written = fwrite($target, substr($bytes, $offset));
            if ($written === false || $written === 0) throw new RuntimeException('Document write failed.');
            $offset += $written;
        }
    }

    public function close(): void
    {
        if (is_resource($this->source)) {
            flock($this->source, LOCK_UN);
            fclose($this->source);
        }
        // Release legacy plaintext/key captured by the reader as soon as possible.
        $this->reader = static function () { yield from []; };
    }

    public function __destruct() { $this->close(); }
}
