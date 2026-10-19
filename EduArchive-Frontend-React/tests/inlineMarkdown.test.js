import assert from 'node:assert/strict';
import test from 'node:test';
import { inlineMarkdown } from '../src/components/inlineMarkdown.js';

test('stored HTML remains inert across the supported markdown forms', () => {
    const payloads = [
        '<img src=x onerror="globalThis.stolen=true">',
        '**<svg onload="alert(1)">**',
        '*<a href="javascript:alert(1)">click</a>*',
        '`</code><script>alert(1)</script>`',
        '&#x3c;img src=x onerror=alert(1)&#x3e;',
        '&lt;script&gt;alert(1)&lt;/script&gt;',
        '<iframe srcdoc="<script>alert(1)</script>"></iframe>',
    ];
    for (const payload of payloads) {
        const html = inlineMarkdown(payload);
        assert.match(html, /&(?:lt|amp);/);
        assert.doesNotMatch(html.replace(/<\/?(?:strong|em|code)>/g, ''), /[<>]/);
        assert.doesNotMatch(html, /<(?:img|svg|a|script|iframe)\b/i);
    }
});

test('fixed formatting and ordinary academic text remain readable', () => {
    assert.equal(inlineMarkdown('**Title** with *emphasis* and `code`'),
        '<strong>Title</strong> with <em>emphasis</em> and <code>code</code>');
    assert.equal(inlineMarkdown('Research & development < 2026'), 'Research &amp; development &lt; 2026');
    assert.equal(inlineMarkdown(null), '');
});
