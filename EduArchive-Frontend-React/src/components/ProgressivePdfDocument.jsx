import { useEffect, useState } from 'react'
import { Document, pdfjs } from 'react-pdf'
import { useAuth } from '../context/useAuth'
import { usePdfReadingProgress } from './usePdfReadingProgress'

const CHUNK_BYTES = 64 * 1024

const STALL_MS = 60000

/**
 * Fetch one byte range with a stall detector instead of an overall timeout.
 * If no data arrives for 60 seconds the request aborts. Slow continuous
 * downloads are not killed.
 */
async function fetchRangeStreaming(url, begin, end, outerSignal, onActivity) {
  outerSignal?.throwIfAborted()
  const controller = new AbortController()
  const onOuterAbort = () => {
    if (outerSignal?.aborted) controller.abort(outerSignal.reason)
  }
  outerSignal?.addEventListener('abort', onOuterAbort, { once: true })

  let stall
  const resetStall = () => {
    clearTimeout(stall)
    stall = setTimeout(() => controller.abort(new Error('Document request timeout')), STALL_MS)
  }
  try {
    resetStall()
    const response = await fetch(url, {
      credentials: 'include',
      signal: controller.signal,
      headers: { Range: `bytes=${begin}-${end - 1}` },
    })
    if (!response.ok) throw new Error(`Document request failed (${response.status})`)
    if (!response.body?.getReader) {
      const data = new Uint8Array(await response.arrayBuffer())
      onActivity?.(data.length)
      return { response, data }
    }

    const reader = response.body.getReader()
    const chunks = []
    let received = 0
    for (;;) {
      const { done, value } = await reader.read()
      if (done) break
      if (value?.length) {
        resetStall()
        chunks.push(value)
        received += value.length
        onActivity?.(value.length)
      }
    }

    const data = new Uint8Array(received)
    let offset = 0
    for (const chunk of chunks) {
      data.set(chunk, offset)
      offset += chunk.length
    }
    return { response, data }
  } finally {
    clearTimeout(stall)
    outerSignal?.removeEventListener('abort', onOuterAbort)
  }
}

// Bound PDF.js page-dictionary bursts on large scanned documents.
function createRangeFetcher(url, signal, onActivity) {
  const queue = []
  let active = 0
  const drain = () => {
    while (active < 4 && queue.length) {
      const { begin, end, resolve, reject } = queue.shift()
      active++
      fetchRangeStreaming(url, begin, end, signal, onActivity)
        .then(resolve, reject)
        .finally(() => { active--; drain() })
    }
  }
  return (begin, end) => new Promise((resolve, reject) => {
    queue.push({ begin, end, resolve, reject })
    drain()
  })
}

/** Each viewer owns its transport, including a separate fullscreen instance. */
export default function ProgressivePdfDocument({ file, onLoadError, onLoadProgress, onLoadActivity = file?.onActivity, loading, documentId, progressActive = true, onLoadSuccess, ...props }) {
  const url = file?.url
  const { user } = useAuth()
  const [loaded, setLoaded] = useState(null)
  const sourceId = url || file
  const pageCount = loaded?.source === sourceId ? loaded.pages : 0
  const documentRef = usePdfReadingProgress({ documentId, accountId: user?.id, source: sourceId, pageCount, active: progressActive })
  const loadedDocument = pdf => { setLoaded({ source: sourceId, pages: pdf.numPages }); onLoadSuccess?.(pdf) }
  const [source, setSource] = useState(null)
  const [sourceUrl, setSourceUrl] = useState(null)
  const [failure, setFailure] = useState(false)
  useEffect(() => {
    if (!url) return
    let active = true
    let transport
    const controller = new AbortController()
    const fail = (error) => {
      if (!active) return
      setFailure(true)
      onLoadError?.(error)
    }
    const fetchRange = createRangeFetcher(url, controller.signal, onLoadActivity)
    const start = async () => {
      const { response, data } = await fetchRange(0, CHUNK_BYTES)
      if (!active) return
      // Compatibility for legacy readers which cannot serve ranges yet.
      if (response.status === 200) {
        setSource({ data }); setSourceUrl(url)
        return
      }
      const match = /^bytes 0-(\d+)\/(\d+)$/.exec(response.headers.get('Content-Range') || '')
      if (!match || Number(match[1]) + 1 !== data.length) throw new Error('Invalid document range response')
      const length = Number(match[2])
      if (!Number.isSafeInteger(length) || length < data.length) throw new Error('Invalid document length')
      class AuthenticatedRangeTransport extends pdfjs.PDFDataRangeTransport {
        requestDataRange(begin, end) {
          fetchRange(begin, end).then(({ response: result, data: bytes }) => {
            const range = /^bytes (\d+)-(\d+)\/(\d+)$/.exec(result.headers.get('Content-Range') || '')
            if (!active) return
            if (result.status !== 206 || !range || Number(range[1]) !== begin || Number(range[2]) + 1 !== end || Number(range[3]) !== length || bytes.length !== end - begin) {
              throw new Error('Invalid document range response')
            }
            this.onDataRange(begin, bytes)
          }).catch(fail)
        }
        abort() { controller.abort() }
      }
      transport = new AuthenticatedRangeTransport(length, data, true)
      onLoadProgress?.({ loaded: data.length, total: length })
      setSource({ range: transport, length, rangeChunkSize: CHUNK_BYTES, disableStream: true, disableAutoFetch: true })
      setSourceUrl(url)
    }
    setFailure(false)
    start().catch(fail)
    return () => { active = false; controller.abort(); transport?.abort() }
    // A transport belongs to this URL. Callback updates must not restart it.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url])

  if (!url) return <div ref={documentRef}><Document onLoadSuccess={loadedDocument} file={file} loading={loading} onLoadError={onLoadError} onLoadProgress={onLoadProgress} {...props} /></div>
  if (failure) return props.error || null
  if (!source || sourceUrl !== url) return loading || null
  return <div ref={documentRef}><Document onLoadSuccess={loadedDocument} file={source} loading={loading} onLoadError={onLoadError} onLoadProgress={onLoadProgress} {...props} /></div>
}
