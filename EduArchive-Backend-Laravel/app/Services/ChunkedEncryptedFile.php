<?php

namespace App\Services;

use Generator;
use Illuminate\Http\Request;
use RuntimeException;
use Symfony\Component\HttpFoundation\Response;

/**
 * Random-access authenticated document format.
 *
 * Each 1 MiB block is independently authenticated and bound to its file ID,
 * position, and plaintext length. An authenticated footer binds the total
 * length and block count, allowing PDF.js to request byte ranges without first
 * decrypting the complete file. V1 secretstream files remain supported by the
 * existing reader.
 */
final class ChunkedEncryptedFile
{
    public const MAGIC = "ACADEX-CHUNKED-AEAD-V2\0";
    public const FILE_ID_BYTES = 16;
    public const FOOTER_BYTES = 8 + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_ABYTES;
    private const KEY_CONTEXT = 'acadex-document-chunked-aead-v2';

    /** Encrypt a regular seekable input stream into a fixed-block container. */
    public static function encrypt($source, $target, string $applicationKey): int
    {
        return self::encryptChunks((static function () use ($source) {
            while (($block = self::readBlock($source)) !== null) yield $block;
        })(), $target, $applicationKey);
    }

    /** Encrypt an iterable of plaintext blocks without materializing the file. */
    public static function encryptChunks(iterable $sourceChunks, $target, string $applicationKey): int
    {
        $fileId = random_bytes(self::FILE_ID_BYTES);
        $key = self::deriveKey($applicationKey, $fileId);
        $total = 0;
        $chunks = 0;
        $buffer = '';

        try {
            VerifiedDocument::writeAll($target, self::MAGIC.$fileId);
            foreach ($sourceChunks as $input) {
                if (!is_string($input)) throw new RuntimeException('Document stream returned invalid data.');
                $offset = 0;
                while ($offset < strlen($input)) {
                    $needed = EncryptedFileStream::CHUNK_BYTES - strlen($buffer);
                    $piece = substr($input, $offset, $needed);
                    $buffer .= $piece;
                    $offset += strlen($piece);
                    if (strlen($buffer) === EncryptedFileStream::CHUNK_BYTES) {
                        $total += strlen($buffer);
                        if ($total > EncryptedFileStream::MAX_BYTES) {
                            throw new RuntimeException('Document exceeds the 128 MiB limit.');
                        }
                        self::writeChunk($target, $key, $fileId, $chunks++, $buffer);
                        $buffer = '';
                    }
                }
            }

            if ($buffer !== '') {
                $total += strlen($buffer);
                if ($total > EncryptedFileStream::MAX_BYTES) {
                    throw new RuntimeException('Document exceeds the 128 MiB limit.');
                }
                self::writeChunk($target, $key, $fileId, $chunks++, $buffer);
            }

            $manifest = pack('N2', $total, $chunks);
            $footer = sodium_crypto_aead_xchacha20poly1305_ietf_encrypt(
                $manifest,
                self::manifestAad($fileId),
                self::nonce($key, 'manifest'),
                $key,
            );
            VerifiedDocument::writeAll($target, $footer);
            return $total;
        } finally {
            sodium_memzero($key);
        }
    }

    /** Open a locked, seekable ciphertext stream and authenticate its footer. */
    public static function open($source, array $applicationKeys): self
    {
        if (!is_resource($source) || !self::isSeekable($source) || fseek($source, 0) !== 0) {
            throw new RuntimeException('Encrypted document is not seekable.');
        }
        if (self::readExactly($source, strlen(self::MAGIC)) !== self::MAGIC) {
            throw new RuntimeException('Invalid encrypted document version.');
        }

        $fileId = self::readExactly($source, self::FILE_ID_BYTES);
        $stat = fstat($source);
        $fileSize = (int) ($stat['size'] ?? 0);
        $minimumSize = strlen(self::MAGIC) + self::FILE_ID_BYTES + self::FOOTER_BYTES;
        if ($fileSize < $minimumSize || fseek($source, $fileSize - self::FOOTER_BYTES) !== 0) {
            throw new RuntimeException('Encrypted document footer is missing.');
        }

        $footer = self::readExactly($source, self::FOOTER_BYTES);
        foreach ($applicationKeys as $applicationKey) {
            $key = self::deriveKey((string) $applicationKey, $fileId);
            $manifest = sodium_crypto_aead_xchacha20poly1305_ietf_decrypt(
                $footer,
                self::manifestAad($fileId),
                self::nonce($key, 'manifest'),
                $key,
            );

            if ($manifest === false || strlen($manifest) !== 8) {
                sodium_memzero($key);
                continue;
            }

            $values = unpack('Nsize/Nchunks', $manifest);
            $size = (int) $values['size'];
            $chunks = (int) $values['chunks'];
            $expectedChunks = $size === 0
                ? 0
                : (int) ceil($size / EncryptedFileStream::CHUNK_BYTES);
            $expectedFileSize = strlen(self::MAGIC) + self::FILE_ID_BYTES
                + $size
                + ($chunks * SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_ABYTES)
                + self::FOOTER_BYTES;

            if ($size > EncryptedFileStream::MAX_BYTES || $chunks !== $expectedChunks || $fileSize !== $expectedFileSize) {
                sodium_memzero($key);
                continue;
            }

            return new self($source, $fileId, $key, $size, $chunks);
        }

        throw new RuntimeException('Encrypted document authentication failed.');
    }

    /** @param resource $source @return Generator<int, string> */
    public function chunks(): Generator
    {
        for ($index = 0; $index < $this->chunkCount; $index++) {
            yield $this->readChunk($index);
        }
    }

    /**
     * Respond to a full or single-range HTTP request. Every plaintext block is
     * authenticated before any bytes from that block are written to the client.
     */
    public function response(Request $request, array $headers): Response
    {
        $range = $request->headers->get('Range');
        if ($request->headers->has('If-Range')) $range = null;
        $resolved = $range === null ? [0, max(0, $this->plaintextSize - 1)] : $this->parseRange($range);

        $baseHeaders = array_merge($headers, [
            'Accept-Ranges' => 'bytes',
            'Cache-Control' => 'no-store, no-cache, must-revalidate, max-age=0',
            'Pragma' => 'no-cache',
            'X-Content-Type-Options' => 'nosniff',
            'X-Accel-Buffering' => 'no',
        ]);

        if ($resolved === null) {
            $this->close();
            return response('', 416, array_merge($baseHeaders, [
                'Content-Range' => 'bytes */'.$this->plaintextSize,
                'Content-Length' => '0',
            ]));
        }

        [$start, $end] = $resolved;
        $partial = $range !== null;
        $length = $this->plaintextSize === 0 ? 0 : ($end - $start + 1);
        $status = $partial ? 206 : 200;
        $responseHeaders = array_merge($baseHeaders, [
            'Content-Length' => (string) $length,
        ]);
        if ($partial) $responseHeaders['Content-Range'] = "bytes {$start}-{$end}/{$this->plaintextSize}";

        if ($request->isMethod('HEAD') || $length === 0) {
            $this->close();
            return response('', $status, $responseHeaders);
        }

        return response()->stream(function () use ($start, $end) {
            $output = fopen('php://output', 'wb');
            try {
                $this->copyRangeTo($start, $end, $output);
            } finally {
                if (is_resource($output)) fclose($output);
                $this->close();
            }
        }, $status, $responseHeaders);
    }

    public function size(): int
    {
        return $this->plaintextSize;
    }

    public function close(): void
    {
        if (is_resource($this->source)) {
            flock($this->source, LOCK_UN);
            fclose($this->source);
        }
        if ($this->key !== '') {
            $key = $this->key;
            sodium_memzero($key);
            $this->key = '';
        }
    }

    public function __destruct()
    {
        $this->close();
    }

    private function __construct(
        private $source,
        private string $fileId,
        private string $key,
        private int $plaintextSize,
        private int $chunkCount,
    ) {}

    /** @param resource $output */
    private function copyRangeTo(int $start, int $end, $output): void
    {
        $cursor = $start;
        while ($cursor <= $end) {
            $index = intdiv($cursor, EncryptedFileStream::CHUNK_BYTES);
            $chunk = $this->readChunk($index);
            $offset = $cursor - ($index * EncryptedFileStream::CHUNK_BYTES);
            $amount = min(strlen($chunk) - $offset, $end - $cursor + 1);
            if ($amount <= 0) throw new RuntimeException('Encrypted document range is invalid.');
            VerifiedDocument::writeAll($output, substr($chunk, $offset, $amount));
            $cursor += $amount;
        }
    }

    private function readChunk(int $index): string
    {
        if (!is_resource($this->source) || $index < 0 || $index >= $this->chunkCount) {
            throw new RuntimeException('Encrypted document chunk is unavailable.');
        }

        $plainOffset = $index * EncryptedFileStream::CHUNK_BYTES;
        $plainLength = min(EncryptedFileStream::CHUNK_BYTES, $this->plaintextSize - $plainOffset);
        $cipherLength = $plainLength + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_ABYTES;
        $cipherOffset = strlen(self::MAGIC) + self::FILE_ID_BYTES
            + ($index * (EncryptedFileStream::CHUNK_BYTES + SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_ABYTES));

        if (fseek($this->source, $cipherOffset) !== 0) throw new RuntimeException('Encrypted document seek failed.');
        $ciphertext = self::readExactly($this->source, $cipherLength);
        $plaintext = sodium_crypto_aead_xchacha20poly1305_ietf_decrypt(
            $ciphertext,
            self::chunkAad($this->fileId, $index, $plainLength),
            self::nonce($this->key, 'chunk:'.$index),
            $this->key,
        );
        if ($plaintext === false || strlen($plaintext) !== $plainLength) {
            throw new RuntimeException('Encrypted document chunk authentication failed.');
        }

        return $plaintext;
    }

    /** @return array{0:int,1:int}|null */
    private function parseRange(string $header): ?array
    {
        if ($this->plaintextSize < 1 || !preg_match('/^bytes=(\d*)-(\d*)$/D', trim($header), $match)) return null;
        if ($match[1] === '' && $match[2] === '') return null;

        if ($match[1] === '') {
            $suffix = (int) $match[2];
            if ($suffix < 1) return null;
            return [max(0, $this->plaintextSize - $suffix), $this->plaintextSize - 1];
        }

        $start = (int) $match[1];
        $end = $match[2] === '' ? $this->plaintextSize - 1 : (int) $match[2];
        if ($start >= $this->plaintextSize || $end < $start) return null;
        return [$start, min($end, $this->plaintextSize - 1)];
    }

    private static function writeChunk($target, string $key, string $fileId, int $index, string $plaintext): void
    {
        $ciphertext = sodium_crypto_aead_xchacha20poly1305_ietf_encrypt(
            $plaintext,
            self::chunkAad($fileId, $index, strlen($plaintext)),
            self::nonce($key, 'chunk:'.$index),
            $key,
        );
        VerifiedDocument::writeAll($target, $ciphertext);
    }

    private static function deriveKey(string $applicationKey, string $fileId): string
    {
        return hash_hkdf('sha256', $applicationKey, 32, self::KEY_CONTEXT, $fileId);
    }

    private static function nonce(string $key, string $label): string
    {
        return substr(hash_hmac('sha256', 'acadex-v2:'.$label, $key, true), 0,
            SODIUM_CRYPTO_AEAD_XCHACHA20POLY1305_IETF_NPUBBYTES);
    }

    private static function manifestAad(string $fileId): string
    {
        return self::MAGIC.$fileId.'manifest';
    }

    private static function chunkAad(string $fileId, int $index, int $length): string
    {
        return self::MAGIC.$fileId.pack('N2', $index, $length);
    }

    /** @param resource $stream */
    private static function readBlock($stream): ?string
    {
        $block = '';
        while (strlen($block) < EncryptedFileStream::CHUNK_BYTES) {
            $part = fread($stream, EncryptedFileStream::CHUNK_BYTES - strlen($block));
            if ($part === false) throw new RuntimeException('Could not read document stream.');
            if ($part === '') {
                if (!feof($stream)) throw new RuntimeException('Document stream read stalled.');
                return $block === '' ? null : $block;
            }
            $block .= $part;
        }
        return $block;
    }

    /** @param resource $stream */
    private static function readExactly($stream, int $length): string
    {
        $bytes = '';
        while (strlen($bytes) < $length) {
            $part = fread($stream, $length - strlen($bytes));
            if ($part === false || $part === '') throw new RuntimeException('Truncated encrypted document.');
            $bytes .= $part;
        }
        return $bytes;
    }

    /** @param resource $stream */
    private static function isSeekable($stream): bool
    {
        return (bool) (stream_get_meta_data($stream)['seekable'] ?? false);
    }
}
