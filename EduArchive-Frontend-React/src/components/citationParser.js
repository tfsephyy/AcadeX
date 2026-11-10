/**
 * Citation Parser for EduArchive Unified AI Research Assistant
 *
 * Handles parsing and extraction of:
 * - [PAGE:n] page citations that navigate the active PDF viewer to page n.
 * - [LINK:id] capstone cross-references that display interactive capstone cards.
 */

const CITATION_REGEX = /\[(PAGE|LINK):([a-zA-Z0-9_-]+)\]/gi;

/**
 * Parses raw text containing [PAGE:n] and [LINK:id] markers into an ordered array of tokens.
 *
 * @param {string} text
 * @returns {Array<{ type: 'text'|'page'|'link', content?: string, page?: number, id?: string }>}
 */
export function parseCitations(text) {
    if (!text || typeof text !== 'string') return [];

    const tokens = [];
    let lastIndex = 0;
    let match;

    const regex = new RegExp(CITATION_REGEX.source, 'gi');

    while ((match = regex.exec(text)) !== null) {
        if (match.index > lastIndex) {
            tokens.push({
                type: 'text',
                content: text.slice(lastIndex, match.index),
            });
        }

        const tagType = match[1].toUpperCase();
        const value = match[2];

        if (tagType === 'PAGE') {
            const pageNum = parseInt(value, 10);
            if (!isNaN(pageNum) && pageNum > 0) {
                tokens.push({
                    type: 'page',
                    page: pageNum,
                });
            } else {
                tokens.push({ type: 'text', content: match[0] });
            }
        } else if (tagType === 'LINK') {
            tokens.push({
                type: 'link',
                id: value,
            });
        }

        lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
        tokens.push({
            type: 'text',
            content: text.slice(lastIndex),
        });
    }

    return tokens;
}

/**
 * Extracts a unique, sorted list of referenced page numbers from a message string.
 *
 * @param {string} text
 * @returns {number[]}
 */
export function extractPageCitations(text) {
    if (!text || typeof text !== 'string') return [];
    const tokens = parseCitations(text);
    const pages = new Set();
    for (const t of tokens) {
        if (t.type === 'page') {
            pages.add(t.page);
        }
    }
    return Array.from(pages).sort((a, b) => a - b);
}
