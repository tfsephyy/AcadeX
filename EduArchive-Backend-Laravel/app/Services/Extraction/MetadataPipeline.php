<?php

namespace App\Services\Extraction;

use Illuminate\Support\Facades\Log;

final class MetadataPipeline
{
    public function __construct(
        private HeaderFooterCleaner $cleaner,
        private TitleExtractor $title,
        private AuthorExtractor $authors,
        private YearExtractor $year,
        private AdviserExtractor $adviser,
        private AbstractExtractor $abstract,
        private KeywordExtractor $keywords,
        private ContactExtractor $contacts,
    ) {}

    public function extract(MetadataDocument $raw): array
    {
        $document = $this->cleaner->clean($raw);
        $warnings = [];
        $title = $this->field('title', fn () => $this->title->extract($document), null, $warnings);
        $authors = $this->field('author', fn () => $this->authors->extract($document), [], $warnings);
        $year = $this->field('year', fn () => $this->year->extract($document), null, $warnings);
        $adviser = $this->field('adviser_name', fn () => $this->adviser->extract($document), null, $warnings);
        $abstract = $this->field('abstract', fn () => $this->abstract->extract($document), null, $warnings);
        $keywords = $this->field('keywords', fn () => $this->keywords->extract($document, $title, $abstract), [], $warnings);
        $contacts = $this->field('author_details', fn () => $this->contacts->extract($document, $authors), [], $warnings);
        if (array_filter($contacts, fn ($contact) => !$contact['email'] || !$contact['contact'])) {
            $warnings[] = 'Review author contact details: some CV contacts are missing or ambiguous.';
        }
        return ['metadata' => ['title' => $title, 'author' => $authors ? implode(', ', $authors) : null,
            'year' => $year, 'adviser_name' => $adviser, 'program' => 'BSIT', 'abstract' => $abstract,
            'keywords' => $keywords, 'author_details' => $contacts], 'source' => $document->text(true),
            // Private diagnostic source; never included in an upload API response.
            'raw_source' => implode("\n\f\n", array_map(fn ($page) => $page->rawText, $raw->pages)),
            'notes' => $warnings];
    }

    private function field(string $field, callable $extract, mixed $empty, array &$warnings): mixed
    {
        try { $value = $extract(); }
        catch (\Throwable $error) {
            Log::warning('PDF metadata field extraction failed.', ['field' => $field, 'type' => get_class($error)]);
            $value = $empty;
        }
        if ($value === null || $value === []) $warnings[] = 'Review '.$field.': no reliable value was found.';
        return $value;
    }
}
