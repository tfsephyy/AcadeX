export const normalizeAdviserName = name => {
    let value = String(name || '').normalize('NFC').replace(/[\u200B\uFEFF]/gu, '').trim().replace(/\s+/gu, ' ').toLowerCase();
    value = value.replace(/(?:[,\s]+(?:ph\.?d\.?|m\.?i\.?t\.?|m\.?s\.?i\.?t\.?|m\.?s\.?c\.?|ed\.?d\.?))+$/giu, '')
        .replace(/,\s*(?:m\.?a\.?|m\.?s\.?)$/giu, '').replace(/,\s*((?:jr|sr)\.?)$/giu, ' $1');
    if (value.split(',').length === 2) {
        const [surname, given] = value.split(',').map(part => part.trim());
        value = `${given} ${surname}`;
    }
    return value.replace(/^(?:(?:dr|prof|engr|mr|mrs|ms|miss|sir|maam)\.?\s+)+/giu, '')
        .replace(/[.'’]/gu, '').replace(/[^\p{L}\p{M}\p{N}]+/gu, ' ').trim();
};

export function matchAdviser(name, faculty, selectedId = null) {
    const normalized = normalizeAdviserName(name);
    const matches = normalized ? faculty.filter(account => normalizeAdviserName(account.name) === normalized) : [];
    const id = matches.length === 1 ? matches[0].id
        : matches.find(account => String(account.id) === String(selectedId))?.id ?? null;
    return { matches, id };
}
