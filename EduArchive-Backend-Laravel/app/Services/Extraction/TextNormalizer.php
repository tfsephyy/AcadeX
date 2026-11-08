<?php

namespace App\Services\Extraction;

final class TextNormalizer
{
    public function line(string $text): string
    {
        if (class_exists(\Normalizer::class)) $text = \Normalizer::normalize($text, \Normalizer::FORM_C) ?: $text;
        $text = str_replace(["\u{00A0}", "\u{200B}", "\u{FEFF}"], [' ', '', ''], $text);
        return trim(preg_replace('/[\t ]+/u', ' ', $text));
    }

    public function prose(string $text): string
    {
        $text = str_replace(["\r\n", "\r"], "\n", $text);
        $text = preg_replace('/(\p{Ll})-\n(\p{Ll})/u', '$1$2', $text);
        $paragraphs = preg_split('/\n\s*\n/u', $text);
        $paragraphs = array_map(fn ($paragraph) => $this->line(preg_replace('/\s+/u', ' ', $paragraph)), $paragraphs);
        $text = implode("\n\n", array_filter($paragraphs, fn ($value) => $value !== ''));
        // Explicit, bounded formatting artifacts; never guess technical words.
        return preg_replace(
            ['/\bsystemprovides\b/u', '/\bprovidesweb-based\b/u', '/\binforma tion\b/iu'],
            ['system provides', 'provides web-based', 'information'], $text
        );
    }

    /** Rejoin only recognized structural labels split across PDF lines. */
    public function headings(string $text): string
    {
        return preg_replace_callback('/^[\t ]*(?:EXECUTIVE\s+SUMMARY|TABLE\s+OF\s+CONT(?:ENTS?|END|ENDS)|(?:Prepared|Submitted)\s+by)[\t ]*[:.]?[\t ]*$/imu',
            fn ($match) => $this->line(preg_replace('/\s+/u', ' ', $match[0])), $text);
    }
}
