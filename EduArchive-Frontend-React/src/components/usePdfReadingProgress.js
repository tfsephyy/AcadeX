import { useEffect, useRef } from 'react'
import { readingProgressKey, readPage, savePage, visiblePage } from '../utils/pdfReadingProgress'

function browserStorage() {
  try { return window.localStorage } catch { return null }
}

export function usePdfReadingProgress({ documentId, accountId, source, pageCount, active }) {
  const documentRef = useRef(null)
  const key = readingProgressKey(documentId, accountId)

  useEffect(() => {
    const element = documentRef.current
    if (!element || !key || !pageCount || !active) return
    let scroller = element.parentElement
    while (scroller && !/(auto|scroll)/.test(getComputedStyle(scroller).overflowY)) scroller = scroller.parentElement
    if (!scroller) return

    const storage = browserStorage()
    const targetPage = readPage(storage, key, pageCount)
    let currentPage = targetPage
    let restored = false
    let frame = 0
    let saveTimer
    const flush = () => {
      clearTimeout(saveTimer)
      if (restored) savePage(storage, key, currentPage)
    }
    const update = () => {
      frame = 0
      if (!element.isConnected || !scroller.contains(element)) return
      const pages = element.querySelectorAll('[data-document-page]')
      if (pages.length !== pageCount) return
      if (!restored) {
        const target = pages[targetPage - 1]
        scroller.scrollTop += target.getBoundingClientRect().top - scroller.getBoundingClientRect().top - scroller.clientTop
        restored = true
        mutations.disconnect()
      }
      currentPage = visiblePage(pages, scroller.getBoundingClientRect().top + scroller.clientTop)
      clearTimeout(saveTimer)
      saveTimer = setTimeout(flush, 200)
    }
    const schedule = () => { if (!frame) frame = requestAnimationFrame(update) }
    const onScroll = () => {
      // Read while this document is still mounted; navigation can replace its
      // DOM before effect cleanup runs.
      if (!element.isConnected || !scroller.contains(element)) return
      if (restored) {
        const pages = element.querySelectorAll('[data-document-page]')
        if (pages.length === pageCount) {
          currentPage = visiblePage(pages, scroller.getBoundingClientRect().top + scroller.clientTop)
          clearTimeout(saveTimer)
          saveTimer = setTimeout(flush, 200)
        }
      } else schedule()
    }
    // Parent page counts and lazy PDF pages mount after PDF.js resolves.
    const mutations = new MutationObserver(schedule)
    mutations.observe(element, { childList: true, subtree: true })
    scroller.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('pagehide', flush)
    document.addEventListener('visibilitychange', flush)
    schedule()
    return () => {
      cancelAnimationFrame(frame)
      mutations.disconnect()
      scroller.removeEventListener('scroll', onScroll)
      window.removeEventListener('pagehide', flush)
      document.removeEventListener('visibilitychange', flush)
      flush()
    }
  }, [key, source, pageCount, active])

  return documentRef
}
