export function readingProgressKey(documentId, accountId) {
  if (!documentId) return null
  return `acadex:pdf-page:v1:${accountId == null ? 'visitor' : `account-${accountId}`}:${documentId}`
}

export function readPage(storage, key, pageCount) {
  try {
    const page = Number(storage?.getItem(key))
    return Number.isSafeInteger(page) && page > 0 ? Math.min(page, pageCount) : 1
  } catch {
    return 1
  }
}

export function savePage(storage, key, page) {
  if (!key || !Number.isSafeInteger(page) || page < 1) return
  try { storage?.setItem(key, String(page)) } catch { /* Private browsing/quota: viewing still works. */ }
}

/** Find the page crossing the viewport's top edge, including gaps between pages. */
export function visiblePage(pages, top) {
  let low = 0
  let high = pages.length - 1
  while (low < high) {
    const middle = Math.floor((low + high) / 2)
    if (pages[middle].getBoundingClientRect().bottom <= top + 1) low = middle + 1
    else high = middle
  }
  return Number(pages[low]?.dataset.documentPage) || 1
}
