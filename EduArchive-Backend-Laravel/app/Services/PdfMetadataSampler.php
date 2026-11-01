<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use RuntimeException;
use Symfony\Component\Process\ExecutableFinder;
use Symfony\Component\Process\Process;

/** Makes a bounded private working copy; never modifies the stored original. */
class PdfMetadataSampler
{
    public const MAX_PAGES = 12;

    public function create(UploadedFile $file): string
    {
        $limit = PdfExtractorService::maxAutomaticBytes();
        if ($limit < 1 || $file->getSize() > EncryptedFileStream::MAX_BYTES) {
            throw new RuntimeException('Document is outside the metadata sampling limits.');
        }
        // The production target is Linux. Fail gracefully when its OS-enforced
        // process budgets are unavailable rather than running an unbounded tool.
        $finder = new ExecutableFinder();
        $gs = $finder->find('gs');
        $prlimit = $finder->find('prlimit');
        if (PHP_OS_FAMILY !== 'Linux' || !$gs || !$prlimit) {
            throw new RuntimeException('Bounded PDF metadata tools are unavailable.');
        }
        $output = PrivateTemp::file('.pdf');
        $successful = false;
        try {
            $process = new Process([
                $prlimit, '--as=536870912', '--cpu=30', '--fsize='.$limit, '--',
                $gs, '-q', '-dSAFER', '-dBATCH', '-dNOPAUSE', '-dPDFSTOPONERROR',
                '-sDEVICE=pdfwrite', '-dCompatibilityLevel=1.5', '-dPDFSETTINGS=/ebook',
                '-dFirstPage=1', '-dLastPage='.self::MAX_PAGES, '-dAutoRotatePages=/None',
                '-dDownsampleColorImages=true', '-dColorImageResolution=150',
                '-dDownsampleGrayImages=true', '-dGrayImageResolution=150',
                '-dDownsampleMonoImages=true', '-dMonoImageResolution=200',
                '-dNumRenderingThreads=1', '-dMaxBitmap=10000000', '-dBufferSpace=10000000',
                '-sOutputFile='.$output, '-f', $file->getRealPath(),
            ], dirname($output));
            $process->setTimeout(40);
            $process->disableOutput();
            $process->run();
            clearstatcache(true, $output);
            $size = filesize($output);
            if (!$process->isSuccessful() || $size === false || $size < 1 || $size > $limit) {
                throw new RuntimeException('A safe PDF metadata sample could not be generated.');
            }
            $successful = true;
            return $output;
        } finally {
            if (!$successful) @unlink($output);
        }
    }
}
