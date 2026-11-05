import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../api/axios'

export const PDF_REQUEST_TIMEOUT_MS = 180000

function messageFor(error) {
  const message = String(error?.message || '').toLowerCase()
  if (error?.name === 'AbortException') return 'The document request was interrupted. Retry to open it again.'
  if (message.includes('401')) return 'Your session has expired. Sign in again, then retry opening the document.'
  if (message.includes('403')) return 'You do not have permission to view this document.'
  if (message.includes('404')) return 'The document file could not be found on the server.'
  if (message.includes('timeout')) return 'The document took too long to open. Check your connection and retry.'
  return 'The document could not be opened. Check your connection and retry.'
}

/**
 * Supplies an authenticated PDF.js source URL. Keeping the request inside
 * PDF.js allows it to use HTTP byte ranges instead of waiting for a full blob.
 */
export function usePdfBlob(endpoint, { enabled = true, timeout = PDF_REQUEST_TIMEOUT_MS } = {}) {
  const [attempt, setAttempt] = useState(0)
  const [loadState, setLoadState] = useState({ requestKey: null, status: 'idle', progress: null, error: null })
  const timeoutRef = useRef(null)
  const requestKey = enabled && endpoint ? `${endpoint}\u0000${attempt}` : null

  const url = useMemo(() => {
    if (!enabled || !endpoint) return null
    return api.getUri({
      url: endpoint,
      params: attempt ? { pdf_retry: attempt } : undefined,
    })
  }, [attempt, enabled, endpoint])

  const file = useMemo(() => url ? {
    url,
    withCredentials: true,
    // Match the server's authenticated 1 MiB blocks and let PDF.js fetch only
    // the ranges needed to display and navigate the document.
    rangeChunkSize: 1024 * 1024,
    disableStream: true,
    disableAutoFetch: true,
  } : null, [url])

  const currentState = !requestKey
    ? { status: 'idle', progress: null, error: null }
    : loadState.requestKey === requestKey
      ? loadState
      : { status: 'loading', progress: null, error: null }

  const onLoadProgress = useCallback(({ loaded, total } = {}) => {
    if (total > 0) {
      setLoadState({
        requestKey,
        status: 'loading',
        progress: Math.min(100, Math.round((loaded / total) * 100)),
        error: null,
      })
    }
  }, [requestKey])

  const onLoadSuccess = useCallback(() => {
    clearTimeout(timeoutRef.current)
    setLoadState({ requestKey, status: 'ready', progress: 100, error: null })
  }, [requestKey])

  const onLoadError = useCallback((loadError) => {
    clearTimeout(timeoutRef.current)
    setLoadState({ requestKey, status: 'error', progress: null, error: messageFor(loadError) })
  }, [requestKey])

  const retry = useCallback(() => {
    clearTimeout(timeoutRef.current)
    setAttempt(value => value + 1)
  }, [])

  useEffect(() => {
    clearTimeout(timeoutRef.current)
    if (!requestKey) return undefined
    timeoutRef.current = window.setTimeout(() => {
      setLoadState({
        requestKey,
        status: 'error',
        progress: null,
        error: 'The document is taking too long to open. Check your connection and retry.',
      })
    }, timeout)

    return () => clearTimeout(timeoutRef.current)
  }, [requestKey, timeout])

  return {
    url,
    file,
    status: currentState.status,
    progress: currentState.progress,
    error: currentState.error,
    retry,
    onLoadProgress,
    onLoadSuccess,
    onLoadError,
  }
}
