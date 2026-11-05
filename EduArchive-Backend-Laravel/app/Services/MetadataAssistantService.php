<?php

namespace App\Services;

use Illuminate\Support\Facades\Http;
use Illuminate\Support\Facades\Log;

/**
 * Optional local metadata assistant backed by Ollama.
 *
 * Safety contract:
 *  - disabled unless OLLAMA_URL is configured;
 *  - only fills fields that deterministic extraction left empty;
 *  - every suggested value must be grounded in the cleaned source text;
 *  - failures are silent (logged by class only) and never block processing.
 */
class MetadataAssistantService
{
    public function enabled(): bool
    {
        return trim((string) config('acadex.ollama_url')) !== '';
    }

    public function enrich(array $metadata, string $sourceText): array
    {
        if (!$this->enabled()) return $metadata;

        $missing = array_filter([
            'title' => empty($metadata['title']),
            'author' => empty($metadata['author']),
            'year' => empty($metadata['year']),
            'program' => empty($metadata['program']),
            'abstract' => empty($metadata['abstract']),
            'keywords' => empty($metadata['keywords']),
        ]);
        if (empty($missing)) return $metadata;

        $sourceText = trim($sourceText);
        if ($sourceText === '') return $metadata;

        $limit = max(1000, (int) config('acadex.ai_source_chars', 12000));
        $source = mb_substr($sourceText, 0, $limit);

        try {
            $url = rtrim((string) config('acadex.ollama_url'), '/').'/api/chat';
            $response = Http::timeout(max(5, (int) config('acadex.ollama_timeout', 45)))
                ->acceptJson()
                ->post($url, [
                    'model' => (string) config('acadex.ollama_model', 'llama3.1:8b'),
                    'stream' => false,
                    'format' => 'json',
                    'messages' => [
                        [
                            'role' => 'system',
                            'content' => 'You extract bibliographic metadata from a capstone document. '
                                .'Return only a JSON object with keys: title, author, year, program, abstract, keywords. '
                                .'Use only text that appears verbatim in the SOURCE. Never paraphrase, guess, or invent. '
                                .'Use null for missing text, [] for missing keywords. program must be "BSIT" or "BSCpE". '
                                .'author is a comma-separated list of names. keywords is an array of short phrases from the SOURCE.',
                        ],
                        ['role' => 'user', 'content' => "SOURCE:\n".$source],
                    ],
                    'options' => ['temperature' => 0, 'num_predict' => 800],
                ]);

            if (!$response->successful()) {
                Log::warning('Metadata assistant unavailable.', ['status' => $response->status()]);
                return $metadata;
            }

            $content = (string) ($response->json('message.content') ?? '');
            if ($content === '' || strlen($content) > 65536) return $metadata;

            $content = preg_replace('/^```(?:json)?\s*|\s*```$/m', '', trim($content));
            $suggested = json_decode($content, true);
            if (!is_array($suggested)) return $metadata;

            return $this->applyGroundedSuggestions($metadata, $suggested, $sourceText);
        } catch (\Throwable $error) {
            Log::warning('Metadata assistant call failed.', ['type' => get_class($error)]);
            return $metadata;
        }
    }

    private function applyGroundedSuggestions(array $metadata, array $suggested, string $source): array
    {
        if (empty($metadata['title']) && is_string($suggested['title'] ?? null)) {
            $title = $this->cleanLine($suggested['title']);
            if (mb_strlen($title) >= 5 && mb_strlen($title) <= 255 && $this->grounded($title, $source)) {
                $metadata['title'] = $title;
            }
        }

        if (empty($metadata['author']) && is_string($suggested['author'] ?? null)) {
            $author = $this->cleanLine($suggested['author']);
            if ($author !== '' && mb_strlen($author) <= 255 && $this->grounded($author, $source)) {
                $metadata['author'] = $author;
                if (empty($metadata['author_details'])) {
                    $metadata['author_details'] = array_map(
                        fn ($name) => ['name' => trim($name), 'email' => '', 'contact' => ''],
                        array_values(array_filter(array_map('trim', explode(',', $author))))
                    );
                }
            }
        }

        if (empty($metadata['year']) && isset($suggested['year'])) {
            $year = filter_var($suggested['year'], FILTER_VALIDATE_INT);
            if ($year !== false && $year >= 2000 && $year <= 2099 && str_contains($source, (string) $year)) {
                $metadata['year'] = $year;
            }
        }

        if (empty($metadata['program']) && is_string($suggested['program'] ?? null)) {
            $program = trim($suggested['program']);
            if (in_array($program, ['BSIT', 'BSCpE'], true) && $this->grounded($program, $source)) {
                $metadata['program'] = $program;
            }
        }

        if (empty($metadata['abstract']) && is_string($suggested['abstract'] ?? null)) {
            $abstract = trim($suggested['abstract']);
            if (mb_strlen($abstract) >= 60 && mb_strlen($abstract) <= 5000 && $this->grounded($abstract, $source)) {
                $metadata['abstract'] = $abstract;
            }
        }

        if (empty($metadata['keywords']) && is_array($suggested['keywords'] ?? null)) {
            $keywords = [];
            foreach ($suggested['keywords'] as $keyword) {
                if (!is_string($keyword)) continue;
                $keyword = mb_strtolower($this->cleanLine($keyword));
                if ($keyword === '' || mb_strlen($keyword) > 100 || !$this->grounded($keyword, $source)) continue;
                if (!in_array($keyword, $keywords, true)) $keywords[] = $keyword;
                if (count($keywords) >= 10) break;
            }
            $metadata['keywords'] = $keywords;
        }

        return $metadata;
    }

    private function cleanLine(string $value): string
    {
        $value = trim(preg_replace('/\s+/', ' ', $value));
        return trim($value, " \t\n\r\0\x0B\"'");
    }

    /** Compare on letters/numbers only so punctuation and OCR spacing do not matter. */
    private function grounded(string $value, string $source): bool
    {
        $normalize = function (string $text): string {
            $text = mb_strtolower($text);
            $text = preg_replace('/[^\p{L}\p{N}]+/u', ' ', $text) ?? '';
            return trim(preg_replace('/\s+/', ' ', $text) ?? '');
        };

        $needle = $normalize($value);
        return $needle !== '' && str_contains($normalize($source), $needle);
    }
}
