import test from 'node:test';
import assert from 'node:assert/strict';
import { getAvailableModes } from '../src/components/chatbotHelpers.js';

test('getAvailableModes disables pdf_only when activeCapstone is null', () => {
    const modes = getAvailableModes(null);
    assert.equal(modes.length, 3);
    const pdfOnly = modes.find(m => m.id === 'pdf_only');
    assert.equal(pdfOnly.disabled, true);
    assert.ok(pdfOnly.disabledReason);
});

test('getAvailableModes enables pdf_only when activeCapstone is present', () => {
    const modes = getAvailableModes({ id: 1, title: 'Sample Capstone' });
    const pdfOnly = modes.find(m => m.id === 'pdf_only');
    assert.equal(pdfOnly.disabled, false);
});

test('all modes contain clear labels and descriptions', () => {
    const modes = getAvailableModes({ id: 1, title: 'Sample' });
    for (const m of modes) {
        assert.ok(m.id);
        assert.ok(m.label);
        assert.ok(m.description);
    }
});
