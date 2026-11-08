<?php

namespace Tests\Support;

/** Synthetic PDF with known metadata and an optional unused large stream. */
final class MetadataPdfFixture
{
    public static function write(string $path, int $paddingBytes = 0, int $pageCount = 2, ?string $adviserName = null): void
    {
        $headers = ['Republic of the Philippines', 'Mindoro State University', 'Bongabong Oriental Mindoro'];
        $title = array_merge($headers, ['SYNTHETIC CAMPUS ARCHIVE SYSTEM',
            'A Capstone Project Presented to the Faculty of',
            'Bachelor of Science in Information Technology', 'Prepared by:', 'Alex Example', 'Jamie Sample', '2026']);
        $abstract = array_merge($headers, ['ABSTRACT',
            'This study develops a synthetic document archive that helps students organize research records.',
            'The system provides searchable records and controlled access for an academic institution.',
            'Keywords: archive, document management, education', 'CHAPTER I']);
        $content = static function (array $lines): string {
            $stream = "BT /F1 12 Tf 16 TL 50 760 Td\n";
            foreach ($lines as $line) $stream .= '('.str_replace(['\\', '(', ')'], ['\\\\', '\\(', '\\)'], $line).") Tj T*\n";
            $stream .= 'ET';
            return '<< /Length '.strlen($stream).">>\nstream\n".$stream."\nendstream";
        };
        $kids = [];
        for ($i = 0; $i < $pageCount; $i++) $kids[] = (4 + 2*$i).' 0 R';
        $objects = ['<< /Type /Catalog /Pages 2 0 R >>',
            '<< /Type /Pages /Kids ['.implode(' ', $kids).'] /Count '.$pageCount.' >>',
            '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>'];
        for ($i = 0; $i < $pageCount; $i++) {
            $objects[] = '<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] /Resources << /Font << /F1 3 0 R >> >> /Contents '.(5+2*$i).' 0 R >>';
            $objects[] = $content($i === 0 ? $title : ($i === 1 ? $abstract
                : ($i === 2 && $adviserName !== null ? array_merge($headers, ['APPROVAL SHEET', 'Approved for synthetic verification.', $adviserName, 'Adviser'])
                    : ['Synthetic page '.($i+1)])));
        }
        $output = fopen($path, 'wb');
        try {
            fwrite($output, "%PDF-1.4\n"); $offsets = [0];
            foreach ($objects as $i => $object) {
                $offsets[] = ftell($output);
                fwrite($output, ($i+1)." 0 obj\n".$object."\nendobj\n");
            }
            if ($paddingBytes > 0) {
                $offsets[] = ftell($output);
                fwrite($output, (count($objects)+1)." 0 obj\n<< /Length $paddingBytes >>\nstream\n");
                $block = str_repeat('x', 1048576);
                while ($paddingBytes > 0) {
                    $part = substr($block, 0, min($paddingBytes, strlen($block)));
                    fwrite($output, $part); $paddingBytes -= strlen($part);
                }
                fwrite($output, "\nendstream\nendobj\n");
            }
            $xref = ftell($output); $count = count($offsets);
            fwrite($output, "xref\n0 $count\n0000000000 65535 f \n");
            foreach (array_slice($offsets, 1) as $offset) fwrite($output, sprintf("%010d 00000 n \n", $offset));
            fwrite($output, "trailer\n<< /Size $count /Root 1 0 R >>\nstartxref\n$xref\n%%EOF\n");
        } finally { fclose($output); }
    }
}
