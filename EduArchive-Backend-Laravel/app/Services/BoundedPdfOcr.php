<?php

namespace App\Services;

use Illuminate\Support\Facades\Log;
use Symfony\Component\Process\Process;

/** Native OCR budgets apply independently of the private Python service. */
class BoundedPdfOcr
{
    public const MAX_PAGES = 30;
    public const WIDTH = 1660;
    public const HEIGHT = 2340;
    private const TOTAL_SECONDS = 90;

    public static function renderCommand(string $binary, string $pdf, string $output): array
    {
        return [$binary, '-q', '-dNOPAUSE', '-dBATCH', '-dSAFER', '-sDEVICE=pnggray',
            '-r200', '-g'.self::WIDTH.'x'.self::HEIGHT, '-dFIXEDMEDIA',
            '-dTextAlphaBits=4', '-dGraphicsAlphaBits=4', '-dFirstPage=1',
            '-dLastPage='.self::MAX_PAGES, '-dMaxBitmap=10000000', '-dBufferSpace=10000000',
            '-sOutputFile='.$output, '-f', $pdf];
    }

    public function extract(string $ghostscript, string $tesseract, string $pdf, int $psm = 6): array
    {
        $directory = PrivateTemp::directory();
        $deadline = microtime(true) + self::TOTAL_SECONDS;
        try {
            if (!$this->run(self::renderCommand($ghostscript, $pdf, $directory.'/page_%04d.png'),
                min(45, $deadline - microtime(true)), $directory)) {
                return [''];
            }
            $images = glob($directory.'/page_*.png') ?: [];
            sort($images);
            $pages = [];
            foreach (array_slice($images, 0, self::MAX_PAGES) as $image) {
                $remaining = $deadline - microtime(true);
                if ($remaining <= 0) break;
                $dimensions = @getimagesize($image);
                if (!$dimensions || $dimensions[0] > self::WIDTH || $dimensions[1] > self::HEIGHT) {
                    throw new \RuntimeException('Native OCR exceeded its rendering budget.');
                }
                $output = $image.'_ocr';
                if (!$this->run([$tesseract, $image, $output, '-l', 'eng', '--psm', (string) $psm], min(10, $remaining), $directory)) {
                    break;
                }
                $pages[] = is_file($output.'.txt') ? trim(file_get_contents($output.'.txt')) : '';
            }
            return $pages ?: [''];
        } catch (\Throwable $error) {
            Log::warning('Bounded native OCR failed.', ['error_type' => get_class($error)]);
            return [''];
        } finally {
            foreach (glob($directory.'/*') ?: [] as $file) @unlink($file);
            @rmdir($directory);
        }
    }

    private function run(array $arguments, float $timeout, string $directory): bool
    {
        if ($timeout <= 0) return false;
        $process = new Process($arguments, $directory);
        $process->setTimeout($timeout);
        $process->disableOutput();
        $process->run();
        return $process->isSuccessful();
    }
}
