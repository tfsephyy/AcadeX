import test from 'node:test';
import assert from 'node:assert/strict';
import { mergeMetadataReview } from '../src/utils/metadataReview.js';

test('late suggestions preserve manual edits and deliberate empty fields', () => {
    const previous = { title: 'Corrected title', year: '', author: 'Manual Author', abstract: '', keywords: [], adviser_name: '', program: 'BSCpE' };
    const extracted = { title: 'PDF title', year: 2026, author: 'PDF Author', abstract: 'PDF abstract', keywords: ['repository'], adviser_name: 'PDF Adviser' };
    const next = mergeMetadataReview(previous, extracted, new Set(['title', 'abstract', 'keywords', 'adviser_name']));
    assert.equal(next.title, 'Corrected title');
    assert.equal(next.author, 'Manual Author');
    assert.equal(next.year, 2026);
    assert.equal(next.abstract, '');
    assert.equal(next.adviser_name, '');
    assert.deepEqual(next.keywords, []);
    assert.equal(next.program, 'BSIT');
});
