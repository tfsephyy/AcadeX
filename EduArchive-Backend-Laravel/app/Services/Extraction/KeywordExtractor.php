<?php

namespace App\Services\Extraction;

use App\Services\KeywordInput;

final class KeywordExtractor
{
    public function extract(MetadataDocument $document, ?string $title, ?string $abstract): array
    {
        $source = $document->text();
        $ranked = [];
        // Keep source-matched technical and research terms; never pad with filler.
        preg_match_all('/^\s*(?:key\s*words?|index\s+terms?)\s*:\s*([^\n]+)$/imu', $source, $labels);
        $labelled = implode("\n", $labels[1]);
        $weighted = ($title ?? '')."\n".($abstract ?? '');
        foreach (array_merge(TechnicalVocabulary::TERMS, ResearchVocabulary::TERMS) as $term) {
            $pattern = '/(?<![\p{L}\p{N}])'.preg_quote($term, '/').'(?![\p{L}\p{N}])/iu';
            $count = preg_match_all($pattern, $source);
            if ($count) $ranked[$term] = ['count' => $count,
                'relevance' => 3 * preg_match_all($pattern, $weighted)
                    + 10 * preg_match_all($pattern, $labelled) + substr_count($term, ' ')];
        }
        // Frequency is primary; title, abstract and labels break frequency ties.
        uasort($ranked, fn ($a, $b) => ($b['count'] <=> $a['count']) ?: ($b['relevance'] <=> $a['relevance']));
        return array_slice(array_keys($ranked), 0, KeywordInput::MAX_KEYWORDS);
    }
}
