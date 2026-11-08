import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import api from '../api/axios'

export const PDF_REQUEST_TIMEOUT_MS = 60000

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
  const lastActivityRef = useRef(0)
  const requestKey = enabled && endpoint ? `${endpoint}\u0000${attempt}` : null
  const onLoadActivity = useCallback(() => {
    lastActivityRef.current = Date.now()
  }, [])

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
    onActivity: onLoadActivity,
    // Request only the small ranges PDF.js needs to open and navigate.
    rangeChunkSize: 64 * 1024,
    disableStream: true,
    disableAutoFetch: true,
  } : null, [url, onLoadActivity])

  const currentState = !requestKey
    ? { status: 'idle', progress: null, error: null }
    : loadState.requestKey === requestKey
      ? loadState
      : { status: 'loading', progress: null, error: null }

  const onLoadProgress = useCallback(({ loaded, total } = {}) => {
    lastActivityRef.current = Date.now()
    if (total > 0) {
      setLoadState(previous => previous.requestKey === requestKey && ['ready', 'error'].includes(previous.status) ? previous : {
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

  // Reset the stall timer whenever PDF.js reports progress. A slow but
  // continuously arriving document should not be killed just because the
  // total elapsed time exceeded the stall threshold.
  useEffect(() => {
    clearTimeout(timeoutRef.current)
    if (!requestKey || currentState.status !== 'loading') return undefined
    lastActivityRef.current = Date.now()
    const checkStall = () => {
      const remaining = timeout - (Date.now() - lastActivityRef.current)
      if (remaining > 0) {
        timeoutRef.current = window.setTimeout(checkStall, remaining)
        return
      }
      setLoadState({
        requestKey,
        status: 'error',
        progress: null,
        error: 'The document is taking too long to open. Check your connection and retry.',
      })
    }
    timeoutRef.current = window.setTimeout(checkStall, timeout)

    return () => clearTimeout(timeoutRef.current)
  }, [requestKey, timeout, currentState.status])

  return {
    url,
    file,
    status: currentState.status,
    progress: currentState.progress,
    error: currentState.error,
    retry,
    onLoadProgress,
    onLoadActivity,
    onLoadSuccess,
    onLoadError,
  }
}
