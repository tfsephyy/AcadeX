/** Preserve explicit edits, including deliberate clearing, when a job completes. */
export function mergeMetadataReview(previous, extracted, edited) {
    const next = { ...previous, program: 'BSIT' };
    for (const field of ['title', 'year', 'author', 'abstract', 'adviser_name']) {
        if (!edited.has(field) && !previous[field]) next[field] = extracted[field] || '';
    }
    if (!edited.has('keywords') && !previous.keywords.length) {
        next.keywords = Array.isArray(extracted.keywords) ? extracted.keywords : [];
    }
    return next;
}
