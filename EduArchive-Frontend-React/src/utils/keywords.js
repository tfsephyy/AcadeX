export const MAX_KEYWORDS = 15;
export const MAX_KEYWORD_LENGTH = 100;

export function normalizeKeywords(raw) {
    const values = Array.isArray(raw) ? raw : [raw];
    return [...new Set(values.flatMap(value => String(value || '').split(','))
        .map(value => value.trim().replace(/\s+/gu, ' ').toLowerCase()).filter(Boolean))];
}

export function keywordError(values) {
    if (normalizeKeywords(values).length > MAX_KEYWORDS) return `You can save a maximum of ${MAX_KEYWORDS} keywords. Remove keywords before adding more.`;
    if (normalizeKeywords(values).some(value => [...value].length > MAX_KEYWORD_LENGTH)) return `Each keyword must contain no more than ${MAX_KEYWORD_LENGTH} characters.`;
    return '';
}

export function changeKeywords(existing, raw, replaceIndex = null) {
    const incoming = normalizeKeywords(raw);
    if (!incoming.length) return { error: 'Enter at least one keyword.', keywords: existing };
    const values = [...existing];
    if (replaceIndex === null) values.push(...incoming);
    else values.splice(replaceIndex, 1, ...incoming);
    const keywords = normalizeKeywords(values);
    const error = keywordError(keywords);
    return { error, keywords: error ? existing : keywords };
}
