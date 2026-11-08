<?php

namespace App\Services\Extraction;

/** Positions use PDF coordinates (origin at bottom left), when available. */
final class DocumentPage
{
    public function __construct(
        public readonly int $number,
        public readonly string $rawText,
        public readonly array $lines,
        public readonly ?float $height = null,
    ) {}

    public static function fromText(string $text, int $number, array $positions = [], ?float $height = null): self
    {
        $lines = [];
        foreach (preg_split('/\R/u', $text) as $index => $line) {
            $lines[] = ['text' => $line, 'index' => $index, 'x' => $positions[$index]['x'] ?? null, 'y' => $positions[$index]['y'] ?? null];
        }
        return new self($number, $text, $lines, $height);
    }

    public function text(): string
    {
        return implode("\n", array_column($this->lines, 'text'));
    }
}
