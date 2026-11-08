export const normalizeAdviserName = name => String(name || '').trim().replace(/\s+/gu, ' ').toLowerCase();

export function matchAdviser(name, faculty, selectedId = null) {
    const normalized = normalizeAdviserName(name);
    const matches = normalized ? faculty.filter(account => normalizeAdviserName(account.name) === normalized) : [];
    const id = matches.length === 1 ? matches[0].id
        : matches.find(account => String(account.id) === String(selectedId))?.id ?? null;
    return { matches, id };
}
