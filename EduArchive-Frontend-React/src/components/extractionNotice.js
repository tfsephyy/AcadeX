export function getExtractionNotice({ extractionStatus, extractionScope, extracted = {}, skipped } = {}) {
  if (extractionStatus === 'queued' || extractionStatus === 'processing') {
    return 'Document processing is running in the background. Suggestions will appear here when ready.'
  }
  if (extractionStatus === 'failed' || extractionStatus === 'unavailable' || extractionStatus === 'manual_required') {
    return 'Your PDF was uploaded, but automatic suggestions are unavailable. Please fill in the document details.'
  }
  if (skipped || extractionStatus === 'skipped') {
    return 'Automatic extraction was skipped. Enter the document details before proceeding.'
  }
  const hasSuggestions = Object.entries(extracted).some(([field, value]) => {
    if (field === 'program') return false
    if (Array.isArray(value)) return value.length > 0
    if (value === null || value === undefined) return false
    const text = String(value).trim()
    return text !== '' && !['Untitled', 'Unknown Author'].includes(text)
  })
  if (!hasSuggestions) {
    return 'Automatic processing finished without usable metadata. Please fill in the document details.'
  }
  if (extractionScope === 'first_12_pages') {
    return 'Metadata uses the first 12 pages; see the processing notes for CV contact coverage. Review all suggestions and missing details.'
  }
  return 'Metadata was extracted from your PDF. Please review and correct it before proceeding.'
}
