<?php

namespace App\Services\Extraction;

use App\Services\{EncryptedFileStream, PrivateTemp};
use Symfony\Component\Process\{ExecutableFinder, Process};

/** Large originals stay out of the in-process PHP parser. Read every text page. */
class FullPdfTextReader
{
    public const MAX_TEXT_BYTES = 8 * 1024 * 1024;

    public function read(string $path): array
    {
        if (!is_file($path) || filesize($path) > EncryptedFileStream::MAX_BYTES) return ['pages' => [], 'complete' => false];
        $finder = new ExecutableFinder();
        $gs = $finder->find('gs') ?: $finder->find('gswin64c');
        if (!$gs && PHP_OS_FAMILY === 'Windows') $gs = glob('C:/Program Files/gs/gs*/bin/gswin64c.exe')[0] ?? null;
        $prlimit = $finder->find('prlimit');
        if (!$gs || (PHP_OS_FAMILY === 'Linux' && !$prlimit)) return ['pages' => [], 'complete' => false];
        $directory = PrivateTemp::directory();
        $process = null;
        try {
            $arguments = [$gs, '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dPDFSTOPONERROR',
                '-sDEVICE=txtwrite', '-dNumRenderingThreads=1', '-dMaxBitmap=10000000', '-dBufferSpace=10000000',
                '-sOutputFile='.$directory.'/page-%d.txt', '-f', $path];
            if (PHP_OS_FAMILY === 'Linux') $arguments = array_merge([$prlimit, '--as=536870912', '--cpu=40', '--fsize='.self::MAX_TEXT_BYTES, '--'], $arguments);
            $process = new Process($arguments, $directory);
            $process->setTimeout(45);
            $process->disableOutput();
            $process->start();
            while ($process->isRunning()) {
                $process->checkTimeout();
                $files = glob($directory.'/page-*.txt') ?: [];
                clearstatcache();
                if (count($files) > 20000 || array_sum(array_map('filesize', $files)) > self::MAX_TEXT_BYTES) {
                    $process->stop(0);
                    return ['pages' => [], 'complete' => false];
                }
                usleep(100000);
            }
            $files = glob($directory.'/page-*.txt') ?: [];
            natsort($files);
            $pages = [];
            $bytes = 0;
            foreach ($files as $file) {
                clearstatcache(true, $file);
                $bytes += filesize($file);
                if ($bytes > self::MAX_TEXT_BYTES || count($pages) >= 20000) return ['pages' => $pages, 'complete' => false];
                preg_match('/page-(\d+)\.txt$/', $file, $number);
                $pages[] = DocumentPage::fromText(file_get_contents($file), (int) $number[1]);
            }
            return ['pages' => $pages, 'complete' => $process->isSuccessful() && count($pages) > 0];
        } catch (\Throwable) {
            return ['pages' => [], 'complete' => false];
        } finally {
            if ($process?->isRunning()) $process->stop(0);
            foreach (glob($directory.'/*') ?: [] as $file) @unlink($file);
            @rmdir($directory);
        }
    }
}
