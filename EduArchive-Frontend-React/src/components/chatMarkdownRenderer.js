import React from 'react';
import { inlineMarkdown } from './inlineMarkdown.js';
import { parseCitations } from './citationParser.js';

/**
 * ChatMarkdownRenderer for EduArchive AcaBot
 *
 * Renders markdown responses into structured, safe React elements.
 * Uses React.createElement directly for zero-dependency execution across
 * Vite and Node test runners.
 */

const h = React.createElement;

const HR_REGEX = /^(\s*[-*_]\s*){3,}$/;
const HEADING_REGEX = /^(#{1,6})\s+(.+)$/;
const BLOCKQUOTE_REGEX = /^>\s?(.*)$/;
const UL_REGEX = /^(\s*)([*-]|•)\s+(.+)$/;
const OL_REGEX = /^(\s*)(\d+)\.\s+(.+)$/;
const TABLE_ROW_REGEX = /^\s*\|(.+)\|\s*$/;
const TABLE_SEPARATOR_REGEX = /^\s*\|?\s*:?-+:?\s*(\|\s*:?-+:?\s*)+\|?\s*$/;

export function renderMarkdown(text, linkRenderer, pageRenderer) {
    if (!text || typeof text !== 'string') return [];

    const lines = text.split(/\r?\n/);
    const elements = [];
    let key = 0;

    // Helper: Parse text segment containing [PAGE:n] or [LINK:id] into React nodes
    const parseWithCitations = (raw) => {
        const tokens = parseCitations(raw);
        const parts = [];

        for (const token of tokens) {
            if (token.type === 'text') {
                // Strip legacy [ID:N] tags from visible text
                const clean = token.content.replace(/\[ID:\d+\]/g, '');
                parts.push(
                    h('span', {
                        key: `t-${key++}`,
                        dangerouslySetInnerHTML: { __html: inlineMarkdown(clean) },
                    })
                );
            } else if (token.type === 'link') {
                if (typeof linkRenderer === 'function') {
                    parts.push(linkRenderer(token.id, key++));
                } else {
                    parts.push(h('span', { key: `link-${key++}` }, `[ID:${token.id}]`));
                }
            } else if (token.type === 'page') {
                if (typeof pageRenderer === 'function') {
                    parts.push(pageRenderer(token.page, key++));
                } else {
                    parts.push(
                        h('span', {
                            key: `page-${key++}`,
                            className: 'chatbot-page-ref-badge',
                        }, `Page ${token.page}`)
                    );
                }
            }
        }

        return parts.length === 1 ? parts[0] : h(React.Fragment, { key: `frag-${key++}` }, ...parts);
    };

    let i = 0;
    while (i < lines.length) {
        const line = lines[i];
        const trimmed = line.trim();

        // 1. Fenced Code Block: ```
        if (trimmed.startsWith('```')) {
            const codeLines = [];
            i++;
            while (i < lines.length && !lines[i].trim().startsWith('```')) {
                codeLines.push(lines[i]);
                i++;
            }
            if (i < lines.length && lines[i].trim().startsWith('```')) {
                i++;
            }
            elements.push(
                h('pre', { key: `code-${key++}`, className: 'chatbot-code-block' },
                    h('code', null, codeLines.join('\n'))
                )
            );
            continue;
        }

        // 2. Horizontal Rule: ---, ----, ***, ___
        if (HR_REGEX.test(trimmed)) {
            elements.push(h('hr', { key: `hr-${key++}`, className: 'chatbot-divider' }));
            i++;
            continue;
        }

        // 3. Headings: #, ##, ###, ####, etc.
        const headingMatch = trimmed.match(HEADING_REGEX);
        if (headingMatch) {
            const level = headingMatch[1].length;
            const headingContent = headingMatch[2];
            elements.push(
                h('div', {
                    key: `h-${key++}`,
                    role: 'heading',
                    'aria-level': Math.min(level + 2, 6),
                    className: `chatbot-heading chatbot-h${level}`,
                }, parseWithCitations(headingContent))
            );
            i++;
            continue;
        }

        // 4. Blockquotes: > quote
        if (BLOCKQUOTE_REGEX.test(trimmed)) {
            const quoteLines = [];
            while (i < lines.length && BLOCKQUOTE_REGEX.test(lines[i].trim())) {
                const match = lines[i].trim().match(BLOCKQUOTE_REGEX);
                quoteLines.push(match ? match[1] : lines[i].trim().slice(1));
                i++;
            }
            elements.push(
                h('blockquote', { key: `quote-${key++}`, className: 'chatbot-quote' },
                    parseWithCitations(quoteLines.join(' '))
                )
            );
            continue;
        }

        // 5. Tables: | col1 | col2 |
        if (TABLE_ROW_REGEX.test(line) && i + 1 < lines.length && TABLE_SEPARATOR_REGEX.test(lines[i + 1])) {
            const parseCells = (rowText) => {
                const match = rowText.match(TABLE_ROW_REGEX);
                if (!match) return [];
                return match[1].split('|').map((c) => c.trim());
            };

            const headerCells = parseCells(line);
            i += 2; // skip header line and separator line

            const bodyRows = [];
            while (i < lines.length && TABLE_ROW_REGEX.test(lines[i])) {
                bodyRows.push(parseCells(lines[i]));
                i++;
            }

            const headerThs = headerCells.map((cell, cIdx) =>
                h('th', { key: `th-${cIdx}` }, parseWithCitations(cell))
            );
            const thead = h('thead', null, h('tr', null, ...headerThs));

            const trs = bodyRows.map((row, rIdx) => {
                const tds = row.map((cell, cIdx) =>
                    h('td', { key: `td-${rIdx}-${cIdx}` }, parseWithCitations(cell))
                );
                return h('tr', { key: `tr-${rIdx}` }, ...tds);
            });
            const tbody = h('tbody', null, ...trs);

            elements.push(
                h('div', { key: `table-${key++}`, className: 'chatbot-table-wrapper' },
                    h('table', { className: 'chatbot-table' }, thead, tbody)
                )
            );
            continue;
        }

        // 6. Unordered and Ordered Lists
        const isUl = UL_REGEX.test(line);
        const isOl = OL_REGEX.test(line);

        if (isUl || isOl) {
            const listType = isUl ? 'ul' : 'ol';
            const listItems = [];

            while (i < lines.length) {
                const currentLine = lines[i];
                const currentUl = currentLine.match(UL_REGEX);
                const currentOl = currentLine.match(OL_REGEX);

                if (listType === 'ul' && currentUl) {
                    listItems.push(currentUl[3]);
                    i++;
                } else if (listType === 'ol' && currentOl) {
                    listItems.push(currentOl[3]);
                    i++;
                } else {
                    break;
                }
            }

            const lis = listItems.map((itemText, lIdx) =>
                h('li', { key: `li-${lIdx}` }, parseWithCitations(itemText))
            );

            elements.push(h(listType, { key: `list-${key++}` }, ...lis));
            continue;
        }

        // 7. Blank lines
        if (trimmed === '') {
            i++;
            continue;
        }

        // 8. Standard paragraph
        elements.push(
            h('p', { key: `p-${key++}` }, parseWithCitations(line))
        );
        i++;
    }

    return elements;
}
