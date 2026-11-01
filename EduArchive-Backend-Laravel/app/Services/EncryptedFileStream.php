<?php

namespace App\Services;

use Generator;
use RuntimeException;

/** Versioned, authenticated file encryption. Only ciphertext is written to disk. */
final class EncryptedFileStream
{
    public const MAGIC = "ACADEX-SECRETSTREAM-V1\0";
    public const CHUNK_BYTES = 1048576;
    public const MAX_BYTES = 134217728;

    public static function key(string $applicationKey): string
    {
        return hash_hkdf('sha256', $applicationKey, 32, 'acadex-document-secretstream-v1');
    }

    /** @param resource $source @param resource $target */
    public static function encrypt($source, $target, string $key): void
    {
        [$state, $header] = sodium_crypto_secretstream_xchacha20poly1305_init_push($key);
        VerifiedDocument::writeAll($target, self::MAGIC.$header);
        $total = 0;
        while (!feof($source)) {
            $chunk = fread($source, self::CHUNK_BYTES);
            if ($chunk === false) throw new RuntimeException('Could not read uploaded document.');
            if ($chunk === '') {
                if (!feof($source)) throw new RuntimeException('Uploaded document read stalled.');
                break;
            }
            $total += strlen($chunk);
            if ($total > self::MAX_BYTES) throw new RuntimeException('Document exceeds the 128 MiB limit.');
            $ciphertext = sodium_crypto_secretstream_xchacha20poly1305_push($state, $chunk, self::MAGIC);
            VerifiedDocument::writeAll($target, pack('N', strlen($ciphertext)).$ciphertext);
        }
        // A separate empty FINAL frame authenticates EOF, including exact chunk boundaries.
        $final = sodium_crypto_secretstream_xchacha20poly1305_push($state, '', self::MAGIC, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL);
        VerifiedDocument::writeAll($target, pack('N', strlen($final)).$final);
        sodium_memzero($state);
    }

    /** @param resource $source @return Generator<int, string> */
    public static function chunks($source, string $key): Generator
    {
        if (!rewind($source) || self::readExactly($source, strlen(self::MAGIC)) !== self::MAGIC) {
            throw new RuntimeException('Invalid encrypted document version.');
        }
        $header = self::readExactly($source, SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_HEADERBYTES);
        $state = sodium_crypto_secretstream_xchacha20poly1305_init_pull($header, $key);
        $total = 0;
        while (true) {
            $length = unpack('Nlength', self::readExactly($source, 4))['length'];
            if ($length < SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_ABYTES ||
                $length > self::CHUNK_BYTES + SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_ABYTES) {
                throw new RuntimeException('Invalid encrypted document frame.');
            }
            $result = sodium_crypto_secretstream_xchacha20poly1305_pull($state, self::readExactly($source, $length), self::MAGIC);
            if ($result === false) throw new RuntimeException('Document authentication failed.');
            [$plaintext, $tag] = $result;
            if ($tag === SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_FINAL) {
                if ($plaintext !== '' || fread($source, 1) !== '') throw new RuntimeException('Invalid encrypted document ending.');
                sodium_memzero($state);
                return;
            }
            if ($tag !== SODIUM_CRYPTO_SECRETSTREAM_XCHACHA20POLY1305_TAG_MESSAGE || $plaintext === '') {
                throw new RuntimeException('Invalid encrypted document message.');
            }
            $total += strlen($plaintext);
            if ($total > self::MAX_BYTES) throw new RuntimeException('Encrypted document exceeds its size limit.');
            yield $plaintext;
        }
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
}
