import { useEffect, useState } from 'react'
import { Document, pdfjs } from 'react-pdf'

const CHUNK_BYTES = 1024 * 1024

/** Each viewer owns its transport, including a separate fullscreen instance. */
export default function ProgressivePdfDocument({ file, onLoadError, onLoadProgress, loading, ...props }) {
  const url = file?.url
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
    const fetchRange = async (begin, end) => {
      const requestController = new AbortController()
      const cancel = () => requestController.abort(controller.signal.reason)
      controller.signal.addEventListener('abort', cancel, { once: true })
      const timeout = setTimeout(() => requestController.abort(new Error('Document request timeout')), 180000)
      try {
        if (controller.signal.aborted) cancel()
        const response = await fetch(url, {
          credentials: 'include', signal: requestController.signal,
          headers: { Range: `bytes=${begin}-${end - 1}` },
        })
        if (!response.ok) throw new Error(`Document request failed (${response.status})`)
        return { response, data: new Uint8Array(await response.arrayBuffer()) }
      } finally {
        clearTimeout(timeout)
        controller.signal.removeEventListener('abort', cancel)
      }
    }
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

  if (!url) return <Document file={file} loading={loading} onLoadError={onLoadError} onLoadProgress={onLoadProgress} {...props} />
  if (failure) return props.error || null
  if (!source || sourceUrl !== url) return loading || null
  return <Document file={source} loading={loading} onLoadError={onLoadError} onLoadProgress={onLoadProgress} {...props} />
}
