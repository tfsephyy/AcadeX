<?php

namespace App\Services\Extraction;

final class MetadataDocument
{
    /** @param DocumentPage[] $pages */
    public function __construct(public readonly array $pages) {}

    public static function fromTexts(array $pages): self
    {
        return new self(array_map(fn ($text, $index) => DocumentPage::fromText($text, $index + 1), array_values($pages), array_keys(array_values($pages))));
    }

    public function firstPage(): string
    {
        foreach ($this->pages as $page) if ($page->number === 1) return $page->text();
        return '';
    }

    public function text(bool $frontOnly = false): string
    {
        return implode("\n\n", array_map(fn ($page) => $page->text(), array_values(array_filter($this->pages,
            fn ($page) => !$frontOnly || $page->number <= 12))));
    }
}
