import test from 'node:test';
import assert from 'node:assert/strict';
import { resolveAutoMode } from '../src/context/chatbotModeManager.js';

test('resolveAutoMode switches to pdf_only when capstone opens and no manual override', () => {
    const next = resolveAutoMode({ prevCapstoneId: null, nextCapstoneId: 10, currentMode: 'smart', isManual: false });
    assert.equal(next.mode, 'pdf_only');
    assert.equal(next.isManual, false);
});

test('resolveAutoMode resets to pdf_only when opening a different capstone even if previously manual', () => {
    const next = resolveAutoMode({ prevCapstoneId: 10, nextCapstoneId: 20, currentMode: 'general', isManual: true });
    assert.equal(next.mode, 'pdf_only');
    assert.equal(next.isManual, false);
});

test('resolveAutoMode preserves manual mode within the same capstone context', () => {
    const next = resolveAutoMode({ prevCapstoneId: 10, nextCapstoneId: 10, currentMode: 'general', isManual: true });
    assert.equal(next.mode, 'general');
    assert.equal(next.isManual, true);
});

test('resolveAutoMode reverts to smart when closing capstone', () => {
    const next = resolveAutoMode({ prevCapstoneId: 10, nextCapstoneId: null, currentMode: 'pdf_only', isManual: false });
    assert.equal(next.mode, 'smart');
    assert.equal(next.isManual, false);
});

test('resolveAutoMode prevents pdf_only mode when no capstone is open', () => {
    const next = resolveAutoMode({ prevCapstoneId: null, nextCapstoneId: null, currentMode: 'pdf_only', isManual: true });
    assert.equal(next.mode, 'smart');
    assert.equal(next.isManual, false);
});
