import test from 'node:test';
import assert from 'node:assert/strict';
import { parseCitations, extractPageCitations } from '../src/components/citationParser.js';

test('parseCitations tokenizes plain text without markers', () => {
    const tokens = parseCitations('This is plain text with no markers.');
    assert.equal(tokens.length, 1);
    assert.equal(tokens[0].type, 'text');
    assert.equal(tokens[0].content, 'This is plain text with no markers.');
});

test('parseCitations parses [PAGE:n] markers accurately', () => {
    const input = 'According to the methodology [PAGE:12], the system uses Agile.';
    const tokens = parseCitations(input);
    assert.equal(tokens.length, 3);
    assert.equal(tokens[0].type, 'text');
    assert.equal(tokens[0].content, 'According to the methodology ');
    assert.equal(tokens[1].type, 'page');
    assert.equal(tokens[1].page, 12);
    assert.equal(tokens[2].type, 'text');
    assert.equal(tokens[2].content, ', the system uses Agile.');
});

test('parseCitations parses combined [PAGE:n] and [LINK:id] markers in order', () => {
    const input = 'Refer to [LINK:42] on [PAGE:5] for comparative findings.';
    const tokens = parseCitations(input);
    assert.equal(tokens.length, 5);
    assert.equal(tokens[0].content, 'Refer to ');
    assert.equal(tokens[1].type, 'link');
    assert.equal(tokens[1].id, '42');
    assert.equal(tokens[2].content, ' on ');
    assert.equal(tokens[3].type, 'page');
    assert.equal(tokens[3].page, 5);
    assert.equal(tokens[4].content, ' for comparative findings.');
});

test('extractPageCitations returns unique sorted list of referenced page numbers', () => {
    const text = 'Findings on [PAGE:15] verify earlier assumptions on [PAGE:3] and [PAGE:15].';
    const pages = extractPageCitations(text);
    assert.deepEqual(pages, [3, 15]);
});
