export function getExtractionNotice({ extractionStatus, extractionScope, extracted = {}, skipped } = {}) {
  if (skipped || extractionStatus === 'skipped') {
    return 'Automatic extraction was skipped. Enter the document details before proceeding.'
  }
  const hasSuggestions = Object.values(extracted).some(value => {
    if (Array.isArray(value)) return value.length > 0
    if (value === null || value === undefined) return false
    const text = String(value).trim()
    return text !== '' && !['Untitled', 'Unknown Author'].includes(text)
  })
  if (!hasSuggestions || ['unavailable', 'manual_required'].includes(extractionStatus)) {
    return 'Your PDF was uploaded, but automatic suggestions are unavailable. Please fill in the document details.'
  }
  if (extractionScope === 'first_12_pages') {
    return 'Suggestions were extracted from the first 12 pages of your PDF. Review them and fill in any missing details.'
  }
  return 'Metadata was extracted from your PDF. Please review and correct it before proceeding.'
}
