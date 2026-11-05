import { useCallback, useEffect, useRef, useState } from 'react'
import { Page } from 'react-pdf'

/** Load pages near the viewport; retain searchable text and links on visited pages. */
export default function ViewportPdfPage({ pageNumber, width, className = '', loadText = false, ...props }) {
  const container = useRef(null)
  const [nearViewport, setNearViewport] = useState(pageNumber === 1)
  const [visited, setVisited] = useState(pageNumber === 1)
  const [ratio, setRatio] = useState(595 / 842)
  useEffect(() => {
    if (!('IntersectionObserver' in window)) return
    const observer = new IntersectionObserver(([entry]) => {
      setNearViewport(entry.isIntersecting)
      if (entry.isIntersecting) setVisited(true)
    }, { rootMargin: '800px 0px' })
    if (container.current) observer.observe(container.current)
    return () => observer.disconnect()
  }, [])
  const onLoadSuccess = useCallback(page => {
    const viewport = page.getViewport({ scale: 1 })
    setRatio(viewport.width / viewport.height)
  }, [])
  const renderCanvas = nearViewport || typeof window === 'undefined' || !('IntersectionObserver' in window)
  return <div ref={container} data-document-page={pageNumber} className={`viewport-pdf-page ${className}`} style={{ width, aspectRatio: ratio }}>
    {(visited || renderCanvas || loadText) && <Page {...props} pageNumber={pageNumber} width={width} renderMode={renderCanvas ? 'canvas' : 'none'} onLoadSuccess={onLoadSuccess} />}
  </div>
}
