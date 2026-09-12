<?php

namespace App\Services;

/**
 * NlpSearchService
 *
 * Provides NLP preprocessing for capstone search queries:
 *  - Stop-word removal
 *  - Abbreviation expansion  (ML → machine learning)
 *  - Synonym expansion       (AI → artificial intelligence, neural network, …)
 *  - Boolean FULLTEXT query building for MySQL MATCH … AGAINST
 */
class NlpSearchService
{
    // ──────────────────────────────────────────────────────────────────────────
    // Stop words — stripped before any search term processing.
    // ──────────────────────────────────────────────────────────────────────────
    private const STOP_WORDS = [
        'what','which','find','show','me','about','the','a','an','is','are','was',
        'were','do','does','can','could','would','should','have','has','had','this',
        'that','these','those','for','with','from','to','in','on','at','by','of',
        'and','or','but','not','any','all','some','tell','how','why','when','where',
        'who','give','list','please','thank','hello','hi','hey','using','used','use',
        'look','looking','their','there','here','my','your','our','its','it','they',
        'them','also','get','want','need','help','make','know','see','just','more',
        'than','then','been','will','very','other','into','such','most','after',
        'before','between','under','over','again','further','once',
        // Capstone-domain stop words (too generic)
        'capstone','capstones','research','study','studies','project','projects',
        'thesis','work','author','authors','title','year','program','category',
        'information','details','topic','topics','related','similar','explain',
        'describe','open','current','selected','using',
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // Abbreviation map — each abbreviation expands to its full form(s).
    // The FULL forms are added to search terms; original abbrev also kept.
    // ──────────────────────────────────────────────────────────────────────────
    private const ABBREVIATIONS = [
        'ml'    => ['machine learning'],
        'ai'    => ['artificial intelligence'],
        'dl'    => ['deep learning'],
        'nlp'   => ['natural language processing'],
        'iot'   => ['internet of things'],
        'cv'    => ['computer vision'],
        'nn'    => ['neural network'],
        'cnn'   => ['convolutional neural network'],
        'rnn'   => ['recurrent neural network'],
        'lstm'  => ['long short term memory'],
        'gnn'   => ['graph neural network'],
        'gpt'   => ['generative pre-trained transformer'],
        'llm'   => ['large language model'],
        'ar'    => ['augmented reality'],
        'vr'    => ['virtual reality'],
        'mr'    => ['mixed reality'],
        'xr'    => ['extended reality'],
        'api'   => ['application programming interface'],
        'ui'    => ['user interface'],
        'ux'    => ['user experience'],
        'hci'   => ['human computer interaction'],
        'db'    => ['database'],
        'dbms'  => ['database management system'],
        'sql'   => ['structured query language'],
        'nosql' => ['non relational database'],
        'os'    => ['operating system'],
        'cpu'   => ['central processing unit'],
        'gpu'   => ['graphics processing unit'],
        'oop'   => ['object oriented programming'],
        'dsa'   => ['data structures algorithms'],
        'web'   => ['web development', 'web application'],
        'app'   => ['application', 'mobile application'],
        'pos'   => ['point of sale'],
        'erp'   => ['enterprise resource planning'],
        'crm'   => ['customer relationship management'],
        'lms'   => ['learning management system'],
        'cms'   => ['content management system'],
        'qr'    => ['qr code', 'quick response'],
        'rfid'  => ['radio frequency identification'],
        'gps'   => ['global positioning system'],
        'gis'   => ['geographic information system'],
        'bsit'  => ['bachelor of science information technology'],
        'bscpe' => ['bachelor of science computer engineering'],
        'ict'   => ['information communication technology'],
        'it'    => ['information technology'],
        'cs'    => ['computer science'],
        'se'    => ['software engineering'],
        'ce'    => ['computer engineering'],
        'msu'   => ['mindanao state university'],
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // Synonym map — each term expands to closely related terms.
    // When a user query contains the key, all values are also searched.
    // ──────────────────────────────────────────────────────────────────────────
    private const SYNONYMS = [
        // AI / ML cluster
        'artificial intelligence'    => ['machine learning', 'deep learning', 'neural network', 'ai'],
        'machine learning'           => ['artificial intelligence', 'deep learning', 'neural network', 'classification', 'prediction'],
        'deep learning'              => ['machine learning', 'neural network', 'cnn', 'rnn', 'lstm'],
        'neural network'             => ['deep learning', 'machine learning', 'artificial intelligence'],
        'natural language processing'=> ['nlp', 'text classification', 'sentiment analysis', 'chatbot', 'language model'],
        'computer vision'            => ['image processing', 'object detection', 'image recognition', 'cv'],
        'chatbot'                    => ['natural language processing', 'conversational ai', 'virtual assistant'],
        'sentiment analysis'         => ['natural language processing', 'opinion mining', 'text mining'],
        'image recognition'          => ['computer vision', 'object detection', 'image classification'],
        'object detection'           => ['computer vision', 'image recognition', 'yolo'],
        'recommendation system'      => ['recommender', 'collaborative filtering', 'content-based filtering'],
        'prediction'                 => ['forecasting', 'machine learning', 'classification', 'regression'],
        'classification'             => ['machine learning', 'prediction', 'categorization'],

        // IoT / Embedded
        'internet of things'         => ['iot', 'smart devices', 'embedded system', 'sensor', 'automation'],
        'smart'                      => ['iot', 'automation', 'intelligent'],
        'embedded system'            => ['microcontroller', 'arduino', 'raspberry pi', 'iot'],
        'automation'                 => ['internet of things', 'robotics', 'embedded system', 'smart'],
        'sensor'                     => ['iot', 'embedded system', 'monitoring'],
        'monitoring'                 => ['sensor', 'tracking', 'surveillance', 'iot'],

        // Web / Mobile
        'web application'            => ['web development', 'website', 'web system'],
        'web development'            => ['web application', 'website', 'frontend', 'backend'],
        'mobile application'         => ['android', 'ios', 'mobile app', 'smartphone'],
        'android'                    => ['mobile application', 'mobile app'],
        'system'                     => ['application', 'platform', 'software'],

        // Database / Data
        'database'                   => ['data management', 'sql', 'nosql', 'dbms'],
        'data mining'                => ['machine learning', 'big data', 'analytics', 'pattern recognition'],
        'big data'                   => ['data analytics', 'data mining', 'hadoop', 'database'],
        'data analytics'             => ['data mining', 'big data', 'visualization', 'business intelligence'],
        'cloud'                      => ['cloud computing', 'aws', 'azure', 'distributed system'],
        'cloud computing'            => ['cloud', 'distributed system', 'server'],

        // Security
        'security'                   => ['cybersecurity', 'network security', 'encryption', 'authentication'],
        'cybersecurity'              => ['security', 'network security', 'intrusion detection', 'firewall'],
        'authentication'             => ['security', 'authorization', 'login', 'face recognition'],
        'face recognition'           => ['biometric', 'authentication', 'computer vision', 'image recognition'],
        'biometric'                  => ['face recognition', 'fingerprint', 'authentication'],

        // Education
        'e-learning'                 => ['learning management system', 'online learning', 'education technology', 'lms'],
        'education'                  => ['e-learning', 'learning', 'school', 'student'],
        'learning management system' => ['lms', 'e-learning', 'online learning'],

        // Healthcare
        'health'                     => ['healthcare', 'medical', 'patient', 'hospital'],
        'healthcare'                 => ['health', 'medical', 'hospital', 'telemedicine'],
        'medical'                    => ['healthcare', 'hospital', 'patient', 'diagnosis'],
        'diagnosis'                  => ['medical', 'healthcare', 'prediction', 'machine learning'],

        // Geographic / Mapping
        'gis'                        => ['geographic information system', 'mapping', 'location', 'geospatial'],
        'mapping'                    => ['gis', 'geographic information system', 'location'],
        'location'                   => ['gps', 'gis', 'tracking', 'geospatial'],

        // Business / Management
        'inventory'                  => ['stock management', 'warehouse', 'supply chain', 'erp'],
        'point of sale'              => ['pos', 'retail', 'sales', 'inventory'],
        'payroll'                    => ['human resource', 'hrms', 'salary'],
        'scheduling'                 => ['timetable', 'calendar', 'resource management'],
    ];

    // ──────────────────────────────────────────────────────────────────────────
    // Public API
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Process a raw search query and return an enriched list of search terms.
     * Includes original meaningful terms + abbreviation expansions + synonyms.
     *
     * @return string[] Unique lowercase search terms
     */
    public function expandTerms(string $query): array
    {
        $normalized = $this->normalize($query);
        $baseTerms  = $this->extractMeaningfulTerms($normalized);

        $expanded = $baseTerms;

        // 1. Abbreviation expansion (single tokens)
        foreach ($baseTerms as $term) {
            if (isset(self::ABBREVIATIONS[$term])) {
                foreach (self::ABBREVIATIONS[$term] as $expansion) {
                    $expanded[] = $expansion;
                    // Also add individual words of the expansion
                    foreach (explode(' ', $expansion) as $word) {
                        if (strlen($word) > 2) {
                            $expanded[] = $word;
                        }
                    }
                }
            }
        }

        // 2. Synonym expansion (single tokens and bigrams)
        $allPhrases = array_merge($baseTerms, $this->extractBigrams($normalized));
        foreach ($allPhrases as $phrase) {
            if (isset(self::SYNONYMS[$phrase])) {
                foreach (self::SYNONYMS[$phrase] as $syn) {
                    $expanded[] = $syn;
                }
            }
        }

        // 3. Deduplicate and filter short/empty
        return array_values(array_unique(
            array_filter($expanded, fn($t) => strlen(trim($t)) > 1)
        ));
    }

    /**
     * Build a MySQL FULLTEXT boolean mode query string from expanded terms.
     * Uses phrase matching (+") for multi-word expansions and prefix (+word*)
     * for single tokens to catch word variations.
     *
     * Example output: +"machine learning" +artificial* +intelligence*
     */
    public function buildFulltextQuery(string $query): string
    {
        $terms = $this->expandTerms($query);

        $parts = [];
        foreach ($terms as $term) {
            $term = trim($term);
            if ($term === '') {
                continue;
            }
            if (str_contains($term, ' ')) {
                // Multi-word phrase — wrap in quotes for exact phrase match
                $safe   = str_replace('"', '', $term);
                $parts[] = "+\"{$safe}\"";
            } else {
                // Single word — use prefix wildcard to catch stemmed variants
                $safe   = preg_replace('/[^a-z0-9]/', '', $term);
                if (strlen($safe) >= 2) {
                    $parts[] = "+{$safe}*";
                }
            }
        }

        // Deduplicate parts
        return implode(' ', array_unique($parts));
    }

    /**
     * Strip stop words and return only meaningful single-token terms.
     *
     * @return string[]
     */
    public function extractMeaningfulTerms(string $text): array
    {
        $clean = preg_replace('/[^a-z0-9\s]/', ' ', strtolower($text));
        $words = preg_split('/\s+/', trim($clean), -1, PREG_SPLIT_NO_EMPTY);

        return array_values(array_unique(
            array_filter($words, fn($w) => strlen($w) > 1 && !in_array($w, self::STOP_WORDS))
        ));
    }

    /**
     * Normalise raw input: lowercase, strip extra whitespace.
     */
    public function normalize(string $text): string
    {
        return trim(strtolower(preg_replace('/\s+/', ' ', $text)));
    }

    // ──────────────────────────────────────────────────────────────────────────
    // Private helpers
    // ──────────────────────────────────────────────────────────────────────────

    /**
     * Extract consecutive word pairs (bigrams) to allow multi-word synonym lookup.
     *
     * @return string[]
     */
    private function extractBigrams(string $text): array
    {
        $words  = preg_split('/\s+/', trim($text), -1, PREG_SPLIT_NO_EMPTY);
        $bigrams = [];
        for ($i = 0; $i < count($words) - 1; $i++) {
            $bigrams[] = $words[$i] . ' ' . $words[$i + 1];
        }
        return $bigrams;
    }
}
