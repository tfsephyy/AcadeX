<?php

namespace App\Services;

use App\Models\Capstone;

/**
 * Server-side citation formatting. Kept separate from slug generation.
 * These are generated citations, not verified external citation counts.
 */
class CitationService
{
    public const FORMATS = ['apa', 'mla', 'ieee'];

    public function format(Capstone $capstone, string $format): string
    {
        $authors = $this->parseAuthors((string) ($capstone->author ?: 'Unknown Author'));
        $title = trim((string) ($capstone->title ?: 'Untitled'));
        $year = $capstone->year ?: 'n.d.';
        $school = 'Mindoro State University';

        return match ($format) {
            'mla' => $this->mla($authors, $title, $school, $year),
            'ieee' => $this->ieee($authors, $title, $school, $year),
            default => $this->apa($authors, $title, $school, $year),
        };
    }

    public function label(string $format): string
    {
        return match ($format) {
            'mla' => 'MLA 9th Edition',
            'ieee' => 'IEEE',
            default => 'APA 7th Edition',
        };
    }

    /** @return array<int, array{first: string, last: string}> */
    private function parseAuthors(string $raw): array
    {
        $parts = preg_split('/,\s*(?=[A-Z])|\s+(?:and|&)\s+/i', $raw) ?: [];
        $authors = [];
        foreach ($parts as $part) {
            $part = trim($part);
            if ($part === '') continue;
            if (str_contains($part, ',')) {
                [$last, $rest] = array_map('trim', explode(',', $part, 2));
                $authors[] = ['first' => $rest, 'last' => $last];
                continue;
            }
            $words = preg_split('/\s+/', $part) ?: [];
            if (count($words) === 1) {
                $authors[] = ['first' => '', 'last' => $words[0]];
            } else {
                $authors[] = ['first' => implode(' ', array_slice($words, 0, -1)), 'last' => end($words)];
            }
        }
        return $authors ?: [['first' => '', 'last' => 'Unknown Author']];
    }

    private function initials(string $first): string
    {
        $parts = preg_split('/\s+/', trim($first)) ?: [];
        return implode(' ', array_map(fn ($part) => mb_strtoupper(mb_substr($part, 0, 1)).'.', array_filter($parts)));
    }

    private function apa(array $authors, string $title, string $school, $year): string
    {
        $names = array_map(function (array $author) {
            $initials = $this->initials($author['first']);
            return $initials === '' ? $author['last'] : $author['last'].', '.$initials;
        }, $authors);

        $authorText = count($names) === 1
            ? $names[0]
            : (count($names) === 2 ? $names[0].' & '.$names[1] : implode(', ', array_slice($names, 0, -1)).', & '.end($names));

        $sentenceTitle = mb_strtoupper(mb_substr($title, 0, 1)).mb_strtolower(mb_substr($title, 1));
        $sentenceTitle = preg_replace('/:\s*([a-z])/', ': '.strtoupper('$1'), $sentenceTitle);

        return "{$authorText} ({$year}). {$sentenceTitle} [Unpublished capstone project]. {$school}.";
    }

    private function mla(array $authors, string $title, string $school, $year): string
    {
        $first = $authors[0];
        $authorText = $first['first'] !== ''
            ? $first['last'].', '.$first['first']
            : $first['last'];
        if (count($authors) === 2) {
            $second = $authors[1];
            $authorText .= ', and '.trim(($second['first'] !== '' ? $second['first'].' ' : '').$second['last']);
        } elseif (count($authors) > 2) {
            $authorText .= ', et al';
        }

        return "{$authorText}. {$title}. {$school}, {$year}. Unpublished capstone project.";
    }

    private function ieee(array $authors, string $title, string $school, $year): string
    {
        $names = array_map(function (array $author) {
            $initials = $this->initials($author['first']);
            return $initials === '' ? $author['last'] : $initials.' '.$author['last'];
        }, $authors);

        if (count($names) === 1) {
            $authorText = $names[0];
        } elseif (count($names) === 2) {
            $authorText = $names[0].' and '.$names[1];
        } else {
            $authorText = implode(', ', array_slice($names, 0, -1)).', and '.end($names);
        }

        return "[1] {$authorText}, \"{$title},\" unpublished capstone project, {$school}, {$year}.";
    }
}
