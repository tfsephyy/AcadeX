<?php

namespace App\Services\Chatbot;

class PdfPassageRetriever
{
    private const STOPWORDS = [
        'a', 'an', 'and', 'are', 'as', 'at', 'be', 'by', 'for', 'from',
        'has', 'he', 'in', 'is', 'it', 'its', 'of', 'on', 'that', 'the',
        'to', 'was', 'were', 'will', 'with', 'what', 'who', 'when', 'where',
        'which', 'how', 'this', 'these', 'those', 'can', 'could', 'should',
        'about', 'does', 'did', 'have', 'had', 'been',
    ];

    /**
     * Splits extracted PDF text into indexed pages using delimiter markers.
     *
     * @return array<int, array{page: int, text: string}>
     */
    public function extractPages(string $text): array
    {
        $pattern = '/(?:^|\n)---\s*\[PAGE:(\d+)\]\s*---\s*\n?/i';
        $matches = [];
        if (!preg_match_all($pattern, $text, $matches, PREG_OFFSET_CAPTURE)) {
            $trimmed = trim($text);
            return $trimmed !== '' ? [['page' => 1, 'text' => $trimmed]] : [];
        }

        $pages = [];
        $count = count($matches[0]);
        for ($i = 0; $i < $count; $i++) {
            $pageNumber = (int) $matches[1][$i][0];
            $matchEnd = $matches[0][$i][1] + strlen($matches[0][$i][0]);
            $nextMatchStart = ($i + 1 < $count) ? $matches[0][$i + 1][1] : strlen($text);
            $pageContent = trim(substr($text, $matchEnd, $nextMatchStart - $matchEnd));
            $pages[] = [
                'page' => $pageNumber,
                'text' => $pageContent,
            ];
        }

        return $pages;
    }

    /**
     * Scores and ranks pages by relevance to the search query.
     *
     * @return array<int, array{page: int, text: string, score: float}>
     */
    public function retrieveRankedPages(string $text, string $query, int $maxPages = 5): array
    {
        $pages = $this->extractPages($text);
        if (empty($pages)) {
            return [];
        }

        $terms = $this->extractQueryTerms($query);
        $scored = [];

        foreach ($pages as $idx => $page) {
            $score = $this->scorePage($page['text'], $terms, $query);
            $scored[] = [
                'page'  => $page['page'],
                'text'  => $page['text'],
                'score' => $score,
                'index' => $idx,
            ];
        }

        // Check if any page scored > 0
        $hasScores = false;
        foreach ($scored as $item) {
            if ($item['score'] > 0) {
                $hasScores = true;
                break;
            }
        }

        if ($hasScores) {
            // Sort descending by score, tie-break by document index
            usort($scored, function ($a, $b) {
                if ($b['score'] === $a['score']) {
                    return $a['index'] <=> $b['index'];
                }
                return ($b['score'] > $a['score']) ? 1 : -1;
            });
        }

        return array_slice($scored, 0, $maxPages);
    }

    /**
     * Builds bounded context string from the top-scoring pages, formatted in document order.
     */
    public function retrieveContext(string $text, string $query, int $maxChars = 6000): string
    {
        $ranked = $this->retrieveRankedPages($text, $query, 12);
        if (empty($ranked)) {
            return mb_substr($text, 0, $maxChars);
        }

        // Budget selection: prioritize highest-scoring pages up to maxChars
        $selected = [];
        $currentChars = 0;

        foreach ($ranked as $item) {
            $pageHeader = "--- [PAGE:{$item['page']}] ---\n";
            $entry = $pageHeader . $item['text'] . "\n\n";
            $entryLen = strlen($entry);

            if ($currentChars + $entryLen <= $maxChars) {
                $selected[] = $item;
                $currentChars += $entryLen;
            } elseif (empty($selected)) {
                // If even the single highest-scoring page exceeds budget, truncate it gracefully
                $headLen = strlen($pageHeader);
                $available = max(100, $maxChars - $headLen - 4);
                $item['text'] = mb_substr($item['text'], 0, $available) . '...';
                $selected[] = $item;
                break;
            }
        }

        // Sort the chosen pages back into document order for logical reading flow
        usort($selected, fn($a, $b) => $a['page'] <=> $b['page']);

        $context = '';
        foreach ($selected as $item) {
            $context .= "--- [PAGE:{$item['page']}] ---\n" . $item['text'] . "\n\n";
        }

        return trim($context);
    }

    /**
     * Extracts meaningful keyword stems from user query.
     *
     * @return array<int, string>
     */
    public function extractQueryTerms(string $query): array
    {
        $cleaned = preg_replace('/[^\p{L}\p{N}\s]/u', ' ', mb_strtolower($query));
        $tokens = preg_split('/\s+/', (string) $cleaned, -1, PREG_SPLIT_NO_EMPTY);
        if (!$tokens) {
            return [];
        }

        $terms = [];
        foreach ($tokens as $token) {
            if (mb_strlen($token) >= 3 && !in_array($token, self::STOPWORDS, true)) {
                $terms[] = $token;
            }
        }

        return array_unique($terms);
    }

    /**
     * Calculates relevance score between page content and query terms.
     */
    private function scorePage(string $pageText, array $terms, string $rawQuery): float
    {
        if (empty($terms)) {
            return 0.0;
        }

        $lowerPage = mb_strtolower($pageText);
        $score = 0.0;

        // Exact phrase bonus
        $cleanRaw = trim(mb_strtolower($rawQuery));
        if (mb_strlen($cleanRaw) >= 5 && str_contains($lowerPage, $cleanRaw)) {
            $score += 15.0;
        }

        // Bigram combination bonus for technical/compound terms
        $termCount = count($terms);
        if ($termCount >= 2) {
            for ($k = 0; $k < $termCount - 1; $k++) {
                $bigram = $terms[$k] . ' ' . $terms[$k + 1];
                if (str_contains($lowerPage, $bigram)) {
                    $score += 5.0;
                }
            }
        }

        foreach ($terms as $term) {
            $matches = substr_count($lowerPage, $term);
            if ($matches > 0) {
                // Diminishing returns for repeated terms
                $score += 1.0 + log(1 + $matches);
            }
        }

        // Section intent boost
        $sectionKeywords = [
            'methodology' => ['methodology', 'research design', 'implementation', 'system architecture', 'procedure', 'framework'],
            'objective'   => ['objective', 'problem statement', 'purpose', 'aim of the study', 'scope'],
            'result'      => ['results', 'findings', 'evaluation', 'discussion', 'performance', 'accuracy', 'outcome'],
            'limitation'  => ['limitation', 'scope and limitation', 'future work', 'constraints', 'delimitations'],
            'tech'        => ['technologies', 'tools', 'hardware', 'software stack', 'framework', 'microcontroller', 'sensors'],
        ];

        foreach ($sectionKeywords as $key => $indicators) {
            if (str_contains($cleanRaw, $key)) {
                foreach ($indicators as $ind) {
                    if (str_contains($lowerPage, $ind)) {
                        $score += 3.0;
                        break;
                    }
                }
            }
        }

        return $score;
    }
}
