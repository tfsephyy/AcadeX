<?php

namespace App\Services\Extraction;

final class AdviserExtractor
{
    public function extract(MetadataDocument $document): ?string
    {
        foreach ($document->pages as $page) {
            $text = preg_replace('/^([\t ]*)APPROVAL[\t ]*\R[\t ]*SHEET[\t ]*$/imu', '$1APPROVAL SHEET', $page->text());
            $lines = explode("\n", $text);
            $approval = false;
            foreach ($lines as $index => $line) {
                $line = trim($line);
                if (preg_match('/^APPROVAL\s+SHEET\s*[:.]?$/iu', $line)) { $approval = true; continue; }
                if (!$approval || !preg_match('/^(?:(?:Capstone|Project|Thesis|Research)\s+)?Adviser\s*[:.]?$/iu', $line)) continue;
                for ($before = $index - 1; $before >= 0; $before--) {
                    $name = trim($lines[$before]);
                    if ($name === '' || preg_match('/^[_\-–—.\s]+$/u', $name)) continue;
                    return (new AuthorExtractor())->isName($name) && !preg_match('/^(?:APPROVAL SHEET|Panelist|Chairperson|Dean)$/iu', $name)
                        ? (new TextNormalizer())->line($name) : null;
                }
            }
        }
        return null;
    }
}
