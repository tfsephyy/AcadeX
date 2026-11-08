import test from 'node:test';
import assert from 'node:assert/strict';
import { matchAdviser } from '../src/utils/adviserMatching.js';

const faculty = [{ id: 1, name: 'Alex Example' }, { id: 2, name: 'Jamie Sample' }, { id: 3, name: ' JAMIE  SAMPLE ' }];

test('one name match automatically selects Faculty regardless of capitalization or extra spaces', () => {
    assert.equal(matchAdviser(' ALEX \t EXAMPLE ', faculty).id, 1);
});

test('normalization handles titles, credentials and surname order while retaining distinct initials', () => {
    const accounts = [{ id: 1, name: 'Maria L. Santos' }, { id: 2, name: 'Maria M. Santos' }];
    assert.equal(matchAdviser('Dr. MARIA L SANTOS, MIT', accounts).id, 1);
    assert.equal(matchAdviser('Santos, Maria L.', accounts).id, 1);
    assert.equal(matchAdviser('Maria Santos', accounts).id, null);
    assert.equal(matchAdviser('Maria L Santos', [...accounts, { id: 3, name: 'Prof. Maria L. Santos' }]).id, null);
});

test('duplicate names wait for an explicit matching choice and name edits discard stale selections', () => {
    assert.equal(matchAdviser('Jamie Sample', faculty).id, null);
    assert.equal(matchAdviser('Jamie Sample', faculty).matches.length, 2);
    assert.equal(matchAdviser('Jamie Sample', faculty, 3).id, 3);
    assert.equal(matchAdviser('Jamie Sample', faculty, 1).id, null);
    assert.equal(matchAdviser('Unregistered Adviser', faculty, 3).id, null);
    assert.deepEqual(matchAdviser(' ', faculty, 1), { matches: [], id: null });
});
