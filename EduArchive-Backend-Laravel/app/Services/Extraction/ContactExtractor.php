<?php

namespace App\Services\Extraction;

final class ContactExtractor
{
    public function extract(MetadataDocument $document, array $authors): array
    {
        $result = array_map(fn ($name) => ['name' => $name, 'email' => '', 'contact' => ''], $authors);
        $keys = array_map([NameNormalizer::class, 'key'], $authors);
        $active = null;
        $inCv = false;
        $contacts = [];
        foreach ($document->pages as $page) {
            // CV profiles must establish a name again after a page boundary.
            $active = null;
            foreach (explode("\n", $page->text()) as $line) {
                $line = trim($line);
                if (preg_match('/^(?:CURRICULUM\s+VITAE|C\.?V\.?)\s*[:.]?$/iu', $line)) {
                    $inCv = true; $active = null; continue;
                }
                if (!$inCv) continue;
                if (preg_match('/^(?:APPENDIX\b|CHAPTER\b|REFERENCES\b|BIBLIOGRAPHY\b)/iu', $line)) {
                    $inCv = false; $active = null; continue;
                }
                $candidate = preg_replace('/^(?:Full\s+Name|Name)\s*:\s*/iu', '', $line);
                $matches = array_keys($keys, NameNormalizer::key($candidate), true);
                if (count($matches) === 1) { $active = $matches[0]; continue; }
                if (preg_match('/^(?:Full\s+Name|Name)\s*:/iu', $line)) { $active = null; continue; }
                // A new person's unlabelled name also ends the previous profile.
                if ($active !== null && (new AuthorExtractor())->isName($candidate) && !str_contains($line, ':')
                    && !preg_match('/\b(?:education|background|elementary|secondary|tertiary|school|skills|awards|achievements|experience|personal|information|data|email|e-mail|contact|mobile|telephone|cellphone|phone)\b/iu', $line)) {
                    $active = null;
                }
                if ($active === null) continue;
                if (preg_match('/[\p{L}\p{N}._%+\-]+\s*@\s*[\p{L}\p{N}.\-]+\.[A-Za-z]{2,}/u', $line, $email)) {
                    $value = preg_replace('/\s+/u', '', $email[0]);
                    if (filter_var($value, FILTER_VALIDATE_EMAIL)) $contacts[$active]['email'][$value] = true;
                }
                if (preg_match('/(?<!\d)(\+?63[\s-]*9(?:[\s-]*\d){9}|09(?:[\s-]*\d){9})(?![\s-]*\d)/u', $line, $phone)) {
                    $value = preg_replace('/[\s-]+/u', '', $phone[0]);
                    if (str_starts_with($value, '63')) $value = '+'.$value;
                    $contacts[$active]['contact'][$value] = true;
                }
            }
        }
        foreach ($contacts as $index => $fields) {
            foreach ($fields as $field => $values) {
                if (count($values) === 1) $result[$index][$field] = (string) array_key_first($values);
            }
        }
        return $result;
    }
}
