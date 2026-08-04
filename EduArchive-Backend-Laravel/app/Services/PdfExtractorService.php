<?php

namespace App\Services;

use Illuminate\Http\UploadedFile;
use Illuminate\Support\Facades\Log;

class PdfExtractorService
{
    /**
     * Number of lines to trim from the top (header zone ~1.25 cm).
     * Typically includes university name, address, and separator lines.
     */
    protected int $headerLinesToTrim = 3;

    /**
     * Number of lines to trim from the bottom (footer zone ~1.25 cm).
     * Typically includes page numbers and institution footers.
     */
    protected int $footerLinesToTrim = 0;

    /**
     * Additional header/footer text patterns to strip after line trimming.
     */
    protected array $stripPatterns = [
        '/Bongabong,?\s*Oriental\s+Mindoro\s*\d*\s*Philippines?/i',
        '/Mindoro\s+State\s+University/i',
        '/Republic\s+of\s+the\s+Philippines/i',
        '/^\s*\d{1,3}\s*$/m', // standalone page numbers (1-3 digits)
        '/^\s*Page\s*\d+\s*$/mi', // "Page 1" style footers
    ];

    /**
     * Extract text and metadata from a PDF file.
     */
    public function extract(UploadedFile $file): array
    {
        // Parse PDF once — get raw pages (no trimming)
        $rawPages = $this->extractRawPages($file->getRealPath());
        $rawFirstPage = $rawPages[0] ?? '';

        // Clean pages (header/footer trimmed) for title, author, abstract, etc.
        $pages = array_map(function ($rawText) {
            $cleaned = $this->trimHeaderFooterLines($rawText);
            return $this->stripPatternNoise($cleaned);
        }, $rawPages);

        $firstPageText = $pages[0] ?? '';
        $fullText = implode("\n", $pages);

        $abstract = $this->extractAbstract($fullText);
        if ($abstract) {
            $abstract = $this->autoCorrectText($abstract);
        }

        return [
            'title' => $this->extractTitle($firstPageText),
            'year' => $this->extractYear($rawFirstPage),
            'author' => $this->extractAuthor($firstPageText),
            'program' => $this->extractProgram($fullText),
            'abstract' => $abstract,
            'keywords' => $this->extractKeywords($fullText),
        ];
    }

    /**
     * Extract RAW text per page (no header/footer trimming).
     * Used for year extraction where the year sits at the very bottom of page 1.
     *
     * @return string[] Array of raw text strings indexed by page number (0-based).
     */
    protected function extractRawPages(string $filePath): array
    {
        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($filePath);
            $pages = [];

            foreach ($pdf->getPages() as $page) {
                $pages[] = $page->getText();
            }

            return $pages;
        } catch (\Exception $e) {
            Log::warning('PDF raw text extraction failed: ' . $e->getMessage());
            return [''];
        }
    }

    /**
     * Extract text per page from the PDF using Smalot PDF Parser.
     * Each page has its header and footer zones stripped.
     *
     * @return string[] Array of text strings indexed by page number (0-based).
     */
    protected function extractPages(string $filePath): array
    {
        try {
            $parser = new \Smalot\PdfParser\Parser();
            $pdf = $parser->parseFile($filePath);
            $pages = [];

            foreach ($pdf->getPages() as $page) {
                $rawText = $page->getText();
                $cleaned = $this->trimHeaderFooterLines($rawText);
                $cleaned = $this->stripPatternNoise($cleaned);
                $pages[] = $cleaned;
            }

            return $pages;
        } catch (\Exception $e) {
            Log::warning('PDF text extraction failed: ' . $e->getMessage());
            return [''];
        }
    }

    /**
     * Trim the top N and bottom N lines from page text to remove
     * header (~1.25 cm from top) and footer (~1.25 cm from bottom) zones.
     */
    protected function trimHeaderFooterLines(string $text): string
    {
        $lines = explode("\n", $text);
        $total = count($lines);

        // Only trim if there are enough lines to keep meaningful content
        if ($total <= ($this->headerLinesToTrim + $this->footerLinesToTrim + 2)) {
            return $text;
        }

        // Remove header lines from top and footer lines from bottom
        $lines = array_slice($lines, $this->headerLinesToTrim, $total - $this->headerLinesToTrim - $this->footerLinesToTrim);

        return implode("\n", $lines);
    }

    /**
     * Remove known header/footer text patterns from page content.
     */
    protected function stripPatternNoise(string $text): string
    {
        foreach ($this->stripPatterns as $pattern) {
            $text = preg_replace($pattern, '', $text);
        }
        return $text;
    }

    // ──────────────────────────────────────────────────────────
    //  TITLE — text before "A Capstone Project Presented to…"
    // ──────────────────────────────────────────────────────────

    /**
     * Extract the title from the first page.
     *
     * Rule: The title is the text that appears BEFORE the phrase
     * "A Capstone Project Presented to the Faculty of..."
     */
    protected function extractTitle(string $firstPage): string
    {
        // Match everything before "A Capstone Project Presented to"
        if (preg_match('/^(.*?)(?=A\s+Capstone\s+Project\s+Presented\s+to)/is', $firstPage, $match)) {
            $title = $this->cleanText($match[1]);
            if (!empty($title)) {
                return $title;
            }
        }

        // Fallback: try the first significant line
        $lines = array_filter(
            array_map('trim', explode("\n", $firstPage)),
            fn($line) => strlen($line) > 5
        );

        foreach (array_values($lines) as $line) {
            // Skip university headers and generic labels
            if (preg_match('/^(republic|mindoro|bongabong|college|department|bachelor|a\s+capstone)/i', $line)) {
                continue;
            }
            if (strlen($line) > 10 && strlen($line) < 300) {
                return $this->cleanText($line);
            }
        }

        return 'Untitled';
    }

    // ──────────────────────────────────────────────────────────
    //  AUTHORS — 3-4 lines after "Prepared by:"
    // ──────────────────────────────────────────────────────────

    /**
     * Extract author names from the first page.
     *
     * Rule: Extract the 3–4 lines immediately after "Prepared by:"
     * and before the date/year section.
     */
    protected function extractAuthor(string $firstPage): string
    {
        $lines = explode("\n", $firstPage);
        $authors = [];
        $collecting = false;

        foreach ($lines as $line) {
            $trimmed = trim($line);

            // Start collecting after "Prepared by:"
            if (!$collecting && preg_match('/^Prepared\s+by\s*:?\s*$/i', $trimmed)) {
                $collecting = true;
                continue;
            }

            // Also handle "Prepared by:" on a line with content after it
            if (!$collecting && preg_match('/^Prepared\s+by\s*:\s*(.+)$/i', $trimmed, $m)) {
                $collecting = true;
                $name = trim($m[1]);
                if (!empty($name) && !preg_match('/^\d{4}$/', $name)) {
                    $authors[] = $name;
                }
                continue;
            }

            if ($collecting) {
                // Stop when we hit a year (e.g. "2024"), a month-year, or empty content
                if (preg_match('/^(January|February|March|April|May|June|July|August|September|October|November|December)\s+\d{4}/i', $trimmed)) {
                    break;
                }
                if (preg_match('/^\d{4}$/', $trimmed)) {
                    break;
                }
                // Stop after collecting 4 names
                if (count($authors) >= 4) {
                    break;
                }

                // Skip empty or very short lines
                if (strlen($trimmed) < 3) {
                    continue;
                }

                // Skip lines that look like section headers
                if (preg_match('/^(a\s+capstone|presented|submitted|adviser|panelist|approved|department)/i', $trimmed)) {
                    break;
                }

                $authors[] = $trimmed;
            }
        }

        if (!empty($authors)) {
            return $this->cleanText(implode(', ', $authors));
        }

        // Fallback: try generic patterns
        foreach ($lines as $i => $line) {
            $trimmed = trim($line);
            if (preg_match('/^(submitted\s+by|researchers?|proponents?|authors?|by)\s*:?\s*/i', $trimmed, $match)) {
                $authorLine = trim(str_ireplace($match[0], '', $trimmed));
                if (empty($authorLine) && isset($lines[$i + 1])) {
                    $authorLine = trim($lines[$i + 1]);
                }
                if (!empty($authorLine)) {
                    return $this->cleanText($authorLine);
                }
            }
        }

        return 'Unknown Author';
    }

    // ──────────────────────────────────────────────────────────
    //  YEAR — last line of the first page (before footer)
    // ──────────────────────────────────────────────────────────

    /**
     * Extract year from the first page.
     *
     * Rule: Extract the year from the last line of the first page,
     * located right before the footer.
     */
    protected function extractYear(string $firstPage): ?int
    {
        $lines = array_filter(
            array_map('trim', explode("\n", $firstPage)),
            fn($line) => strlen($line) > 0
        );
        $lines = array_values($lines);

        // Scan from the bottom of page 1 upward looking for a year
        for ($i = count($lines) - 1; $i >= 0; $i--) {
            if (preg_match('/\b(20[0-9]{2})\b/', $lines[$i], $m)) {
                return (int) $m[1];
            }
        }

        return null;
    }

    // ──────────────────────────────────────────────────────────
    //  PROGRAM — BSIT or BSCpE detection
    // ──────────────────────────────────────────────────────────

    /**
     * Extract program (BSIT or BSCpE).
     */
    protected function extractProgram(string $text): ?string
    {
        if (preg_match('/\b(BS\s*IT|B\.?S\.?\s*I\.?T\.?|Bachelor\s+of\s+Science\s+in\s+Information\s+Technology)/i', $text)) {
            return 'BSIT';
        }
        if (preg_match('/\b(BS\s*CpE|B\.?S\.?\s*Cp\.?E\.?|Bachelor\s+of\s+Science\s+in\s+Computer\s+Engineering)/i', $text)) {
            return 'BSCpE';
        }
        return null;
    }

    // ──────────────────────────────────────────────────────────
    //  ABSTRACT — text between "EXECUTIVE SUMMARY" and "TABLE OF CONTENTS"
    // ──────────────────────────────────────────────────────────

    /**
     * Extract abstract section.
     *
     * Rule: The abstract starts after "EXECUTIVE SUMMARY" and ends
     * before "TABLE OF CONTENTS". Extract all text between these two
     * headings only.
     */
    protected function extractAbstract(string $text): ?string
    {
        // Primary rule: between EXECUTIVE SUMMARY and TABLE OF CONTENTS
        if (preg_match('/EXECUTIVE\s+SUMMARY\s*\n(.*?)(?=TABLE\s+OF\s+CONTENTS)/is', $text, $match)) {
            $abstract = $this->cleanText($match[1]);
            if (strlen($abstract) > 30) {
                return substr($abstract, 0, 5000);
            }
        }

        // Fallback: try a plain "Abstract" section
        if (preg_match('/\bABSTRACT\b\s*\n(.*?)(?=\n\s*(?:TABLE\s+OF\s+CONTENTS|CHAPTER|INTRODUCTION|KEYWORDS?|ACKNOWLEDGMENT))/is', $text, $match)) {
            $abstract = $this->cleanText($match[1]);
            if (strlen($abstract) > 30) {
                return substr($abstract, 0, 5000);
            }
        }

        return null;
    }

    // ──────────────────────────────────────────────────────────
    //  ABSTRACT AUTO-CORRECTION
    // ──────────────────────────────────────────────────────────

    /**
     * Auto-correct common PDF extraction artifacts in abstract text.
     * Fixes broken words, spacing issues, and common OCR misspellings.
     */
    protected function autoCorrectText(string $text): string
    {
        // 1. Fix spaces inserted within words by PDF extraction (e.g. "th e" → "the")
        //    Common single-letter fragments that should rejoin their neighbor
        $brokenWordPatterns = [
            '/\b(\w)\s(\w{2,})\b/' => function ($m) {
                // Only rejoin if the combined word looks valid
                $combined = $m[1] . $m[2];
                if ($this->isLikelyWord($combined)) {
                    return $combined;
                }
                return $m[0];
            },
            '/\b(\w{2,})\s(\w)\b/' => function ($m) {
                $combined = $m[1] . $m[2];
                if ($this->isLikelyWord($combined)) {
                    return $combined;
                }
                return $m[0];
            },
        ];

        foreach ($brokenWordPatterns as $pattern => $callback) {
            $text = preg_replace_callback($pattern, $callback, $text);
        }

        // 2. Fix common OCR/extraction spacing artifacts
        // Multiple spaces → single space
        $text = preg_replace('/\s{2,}/', ' ', $text);

        // Space before punctuation (e.g. "word ." → "word.")
        $text = preg_replace('/\s+([.,;:!?])/', '$1', $text);

        // Missing space after punctuation (e.g. "word.Next" → "word. Next")
        $text = preg_replace('/([.,;:!?])([A-Z])/', '$1 $2', $text);

        // Fix "i t" → "it", "o f" → "of", "i n" → "in", etc.
        $commonBrokenWords = [
            '/\bt h e\b/i' => 'the',
            '/\bt o\b/i' => 'to',
            '/\bo f\b/i' => 'of',
            '/\bi n\b/i' => 'in',
            '/\bi t\b/i' => 'it',
            '/\bi s\b/i' => 'is',
            '/\ba n d\b/i' => 'and',
            '/\bf o r\b/i' => 'for',
            '/\bw i t h\b/i' => 'with',
            '/\bt h a t\b/i' => 'that',
            '/\bt h i s\b/i' => 'this',
            '/\bw h i c h\b/i' => 'which',
            '/\bf r o m\b/i' => 'from',
            '/\bh a v e\b/i' => 'have',
            '/\bw e r e\b/i' => 'were',
            '/\bb e e n\b/i' => 'been',
            '/\bt h e i r\b/i' => 'their',
            '/\ba r e\b/i' => 'are',
            '/\bw a s\b/i' => 'was',
            '/\bn o t\b/i' => 'not',
            '/\bb u t\b/i' => 'but',
            '/\ba l s o\b/i' => 'also',
            '/\bm o r e\b/i' => 'more',
            '/\bs u c h\b/i' => 'such',
            '/\bw h e n\b/i' => 'when',
            '/\bs o m e\b/i' => 'some',
            '/\bt h e n\b/i' => 'then',
            '/\bt h a n\b/i' => 'than',
            '/\bo t h e r\b/i' => 'other',
            '/\ba b o u t\b/i' => 'about',
            '/\bc a n\b/i' => 'can',
            '/\bw i l l\b/i' => 'will',
            '/\be a c h\b/i' => 'each',
            '/\bm a k e\b/i' => 'make',
            '/\bl i k e\b/i' => 'like',
            '/\bu s e d\b/i' => 'used',
            '/\bu s e r\b/i' => 'user',
            '/\bu s e r s\b/i' => 'users',
            '/\bs y s t e m\b/i' => 'system',
            '/\bp r o j e c t\b/i' => 'project',
            '/\bd a t a\b/i' => 'data',
            '/\bs t u d y\b/i' => 'study',
            '/\br e s e a r c h\b/i' => 'research',
        ];

        foreach ($commonBrokenWords as $pattern => $replacement) {
            $text = preg_replace($pattern, $replacement, $text);
        }

        // 3. Fix double periods, double commas
        $text = preg_replace('/\.{2,}/', '.', $text);
        $text = preg_replace('/,{2,}/', ',', $text);

        // 4. Capitalize first letter after period
        $text = preg_replace_callback('/\.\s+([a-z])/', function ($m) {
            return '. ' . strtoupper($m[1]);
        }, $text);

        // 5. Ensure first character is capitalized
        $text = ucfirst(trim($text));

        return $text;
    }

    /**
     * Simple heuristic to check if a string looks like a valid English word.
     * Uses common word patterns and minimum length checks.
     */
    protected function isLikelyWord(string $word): bool
    {
        $word = strtolower($word);

        // Very common English words
        $commonWords = [
            'the',
            'and',
            'for',
            'are',
            'but',
            'not',
            'you',
            'all',
            'can',
            'had',
            'her',
            'was',
            'one',
            'our',
            'out',
            'has',
            'his',
            'how',
            'its',
            'may',
            'new',
            'now',
            'old',
            'see',
            'way',
            'who',
            'did',
            'get',
            'let',
            'say',
            'she',
            'too',
            'use',
            'with',
            'this',
            'that',
            'from',
            'have',
            'been',
            'were',
            'they',
            'will',
            'each',
            'make',
            'like',
            'into',
            'over',
            'such',
            'than',
            'them',
            'then',
            'some',
            'when',
            'what',
            'also',
            'more',
            'about',
            'which',
            'their',
            'other',
            'there',
            'these',
            'could',
            'would',
            'should',
            'through',
            'system',
            'project',
            'data',
            'study',
            'research',
            'capstone',
            'university',
            'information',
            'technology',
            'development',
            'application',
            'user',
            'users',
            'used',
            'using',
            'based',
            'results',
        ];

        if (in_array($word, $commonWords)) {
            return true;
        }

        // Check word doesn't have unusual consonant clusters
        if (strlen($word) >= 3 && strlen($word) <= 15) {
            // Reject if too many consecutive consonants (5+)
            if (preg_match('/[bcdfghjklmnpqrstvwxyz]{5,}/i', $word)) {
                return false;
            }
            return true;
        }

        return false;
    }

    // ──────────────────────────────────────────────────────────
    //  KEYWORDS
    // ──────────────────────────────────────────────────────────

    /**
     * Extract keywords from the document.
     */
    protected function extractKeywords(string $text): array
    {
        $keywords = [];

        // 1. Look for explicit "Keywords:" section
        if (preg_match('/\bkeywords?\s*:?\s*\n?(.*?)(?:\n\s*\n|\b(?:chapter|introduction|abstract|table\s+of\s+contents)\b)/is', $text, $match)) {
            $raw = trim($match[1]);
            $parts = preg_split('/[,;]\s*/', $raw);
            foreach ($parts as $part) {
                $part = trim($part);
                if (strlen($part) > 2 && strlen($part) < 50) {
                    $keywords[] = $this->cleanText($part);
                }
            }
        }

        // 2. Extract tech terms from title and body
        $techTerms = $this->extractTechTerms($text);
        $keywords = array_merge($keywords, $techTerms);

        // Remove duplicates and limit
        $keywords = array_unique(array_map('strtolower', $keywords));
        return array_slice(array_values($keywords), 0, 15);
    }

    /**
     * Extract technology-related terms.
     */
    protected function extractTechTerms(string $text): array
    {
        $techPatterns = [
            'machine learning',
            'deep learning',
            'artificial intelligence',
            'neural network',
            'web application',
            'mobile application',
            'database',
            'API',
            'REST',
            'PHP',
            'Laravel',
            'React',
            'Vue',
            'Angular',
            'Node.js',
            'Python',
            'Java',
            'JavaScript',
            'TypeScript',
            'C#',
            'Flutter',
            'Kotlin',
            'MySQL',
            'MongoDB',
            'PostgreSQL',
            'Firebase',
            'IoT',
            'blockchain',
            'cloud computing',
            'data mining',
            'image processing',
            'natural language processing',
            'NLP',
            'computer vision',
            'automation',
            'robotics',
            'QR code',
            'barcode',
            'RFID',
            'GPS',
            'e-commerce',
            'e-learning',
            'management system',
            'information system',
            'decision support',
            'expert system',
            'Android',
            'iOS',
            'Arduino',
            'Raspberry Pi',
            'PDF',
            'data extraction',
            'web scraping',
            'repository',
        ];

        $found = [];
        $lowerText = strtolower($text);
        foreach ($techPatterns as $term) {
            if (str_contains($lowerText, strtolower($term))) {
                $found[] = strtolower($term);
            }
        }

        return $found;
    }

    /**
     * Clean extracted text by removing unnecessary spacing,
     * repeated headers/footers, and formatting artifacts.
     */
    protected function cleanText(string $text): string
    {
        // Strip known patterns one more time
        foreach ($this->stripPatterns as $pattern) {
            $text = preg_replace($pattern, '', $text);
        }

        // Remove excess whitespace
        $text = preg_replace('/\s+/', ' ', $text);
        return trim($text);
    }
}
