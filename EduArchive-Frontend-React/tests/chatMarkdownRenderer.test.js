import test from 'node:test';
import assert from 'node:assert/strict';
import React from 'react';
import { renderMarkdown } from '../src/components/chatMarkdownRenderer.js';

test('renderMarkdown handles headings without displaying raw # symbols', () => {
    const text = '### 📑 Objectives\n#### Methodology';
    const elements = renderMarkdown(text);
    assert.equal(elements.length, 2);
    assert.equal(elements[0].props.role, 'heading');
    assert.equal(elements[0].props.className, 'chatbot-heading chatbot-h3');
    assert.equal(elements[1].props.role, 'heading');
    assert.equal(elements[1].props.className, 'chatbot-heading chatbot-h4');
});

test('renderMarkdown handles horizontal rules without displaying raw dashes', () => {
    const text = 'Above\n---\nBelow';
    const elements = renderMarkdown(text);
    assert.equal(elements.length, 3);
    assert.equal(elements[0].type, 'p');
    assert.equal(elements[1].type, 'hr');
    assert.equal(elements[1].props.className, 'chatbot-divider');
    assert.equal(elements[2].type, 'p');
});

test('renderMarkdown renders blockquotes as blockquote elements', () => {
    const text = '> This study developed an IoT system.\n> Additional details here.';
    const elements = renderMarkdown(text);
    assert.equal(elements.length, 1);
    assert.equal(elements[0].type, 'blockquote');
    assert.equal(elements[0].props.className, 'chatbot-quote');
});

test('renderMarkdown renders markdown tables into structured HTML tables', () => {
    const tableText = [
        '| Metric | Score | Status |',
        '|---|---|---|',
        '| Accuracy | 98.4% | Passed |',
        '| F1-Score | 96.1% | Verified |',
    ].join('\n');

    const elements = renderMarkdown(tableText);
    assert.equal(elements.length, 1);
    const wrapper = elements[0];
    assert.equal(wrapper.props.className, 'chatbot-table-wrapper');
    const table = wrapper.props.children;
    assert.equal(table.type, 'table');
    assert.equal(table.props.className, 'chatbot-table');
    const [thead, tbody] = table.props.children;
    assert.equal(thead.type, 'thead');
    assert.equal(tbody.type, 'tbody');
});

test('renderMarkdown renders fenced code blocks into pre and code elements', () => {
    const codeText = '```python\nprint("Hello World")\n```';
    const elements = renderMarkdown(codeText);
    assert.equal(elements.length, 1);
    assert.equal(elements[0].type, 'pre');
    assert.equal(elements[0].props.className, 'chatbot-code-block');
    assert.equal(elements[0].props.children.type, 'code');
    assert.equal(elements[0].props.children.props.children, 'print("Hello World")');
});

test('renderMarkdown invokes pageRenderer for [PAGE:n] tags inside headings and tables', () => {
    let renderedPage = null;
    const pageRenderer = (page) => {
        renderedPage = page;
        return React.createElement('button', { key: 'p' }, 'Page ' + page);
    };

    const text = '### Limitations [PAGE:5]';
    const elements = renderMarkdown(text, null, pageRenderer);
    assert.equal(renderedPage, 5);
    assert.equal(elements[0].props.role, 'heading');
});

test('renderMarkdown handles lists correctly', () => {
    const listText = '- Item 1\n- Item 2\n- Item 3';
    const elements = renderMarkdown(listText);
    assert.equal(elements.length, 1);
    assert.equal(elements[0].type, 'ul');
    assert.equal(elements[0].props.children.length, 3);
});
