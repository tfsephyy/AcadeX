<?php

namespace App\Services;

class PrivateTemp
{
    private static function root(): string
    {
        $root = config('acadex.private_temp_path', storage_path('framework/private-tmp'));
        if (is_link($root)) throw new \RuntimeException('Private temp root cannot be a symlink.');
        if (!is_dir($root) && !mkdir($root, 0700, true) && !is_dir($root)) {
            throw new \RuntimeException('Cannot create private temp root.');
        }
        if (!chmod($root, 0700)) throw new \RuntimeException('Cannot restrict private temp root.');
        return $root;
    }

    public static function directory(): string
    {
        $path = self::root().DIRECTORY_SEPARATOR.bin2hex(random_bytes(16));
        if (!mkdir($path, 0700)) throw new \RuntimeException('Cannot create private temp directory.');
        return $path;
    }

    public static function file(string $extension = '.pdf'): string
    {
        $path = self::root().DIRECTORY_SEPARATOR.bin2hex(random_bytes(16)).$extension;
        $stream = fopen($path, 'x+b');
        if ($stream === false) throw new \RuntimeException('Cannot create private temp file.');
        fclose($stream);
        if (!chmod($path, 0600)) {
            unlink($path);
            throw new \RuntimeException('Cannot restrict private temp file.');
        }
        return $path;
    }
}
