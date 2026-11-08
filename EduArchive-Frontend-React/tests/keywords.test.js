import test from 'node:test';
import assert from 'node:assert/strict';
import { normalizeKeywords, changeKeywords, keywordError } from '../src/utils/keywords.js';

test('comma lists trim, normalize spaces and remove case-insensitive duplicates and empty values', () => {
    assert.deepEqual(normalizeKeywords(['React', ' Laravel, MySQL, ,REACT', 'PDF   Extraction']), ['react', 'laravel', 'mysql', 'pdf extraction']);
});

test('adding or replacing tags cannot exceed fifteen unique keywords or silently truncate input', () => {
    const fifteen = Array.from({ length: 15 }, (_, index) => `technology ${index}`);
    assert.equal(changeKeywords(fifteen.slice(1), 'technology 0').keywords.length, 15);
    assert.equal(changeKeywords(fifteen, 'technology 0').error, '');
    const rejected = changeKeywords(fifteen, 'new term, another term');
    assert.match(rejected.error, /maximum of 15/);
    assert.deepEqual(rejected.keywords, fifteen);
    assert.match(changeKeywords(fifteen, 'two, terms', 0).error, /maximum of 15/);
    assert.equal(changeKeywords(fifteen, 'replacement', 0).keywords[0], 'replacement');
});

test('individual edits deduplicate and invalid or long entries leave the saved list intact', () => {
    assert.deepEqual(changeKeywords(['react', 'laravel', 'mysql'], 'LARAVEL', 0).keywords, ['laravel', 'mysql']);
    assert.match(changeKeywords(['react'], ' , ').error, /at least one/);
    assert.match(keywordError(['a'.repeat(101)]), /100 characters/);
    assert.deepEqual(changeKeywords(['react'], 'a'.repeat(101)).keywords, ['react']);
});
