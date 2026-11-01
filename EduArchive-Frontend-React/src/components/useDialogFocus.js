import { useEffect, useRef } from 'react'

// One focus/scroll owner for nested dialogs and mobile navigation drawers.
const openLayers = []
let previousOverflow = ''
export function useDialogFocus(open, onClose, { mobile = false } = {}) {
  const ref = useRef(null)
  const closeRef = useRef(onClose)
  useEffect(() => { closeRef.current = onClose }, [onClose])
  useEffect(() => {
    if (!open) return
    const query = window.matchMedia('(max-width: 1023px)')
    const node = ref.current
    if (!node || (mobile && !query.matches)) return
    const previous = document.activeElement
    if (!openLayers.length) { previousOverflow = document.body.style.overflow; document.body.style.overflow = 'hidden' }
    openLayers.push(node)
    const originalRole = node.getAttribute('role')
    if (mobile) { node.setAttribute('role', 'dialog'); node.setAttribute('aria-modal', 'true') }
    const focusable = () => [...node.querySelectorAll('a[href],button:not(:disabled),input:not(:disabled):not([type="hidden"]),select:not(:disabled),textarea:not(:disabled),[tabindex="0"]')].filter(el => el.getClientRects().length && getComputedStyle(el).visibility !== 'hidden' && !el.closest('[inert]'))
    const frame = requestAnimationFrame(() => (node.querySelector('[data-dialog-autofocus]') || focusable()[0] || node).focus())
    const handleKey = e => {
      if (openLayers.at(-1) !== node) return
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeRef.current?.(); return }
      if (e.key === 'Tab') {
        const items = focusable(), first = items[0], last = items.at(-1)
        if (!items.length) { e.preventDefault(); node.focus() }
        else if (e.shiftKey && (document.activeElement === first || !node.contains(document.activeElement))) { e.preventDefault(); last.focus() }
        else if (!e.shiftKey && (document.activeElement === last || !node.contains(document.activeElement))) { e.preventDefault(); first.focus() }
      }
    }
    const containFocus = e => {
      if (openLayers.at(-1) === node && !node.contains(e.target)) (focusable()[0] || node).focus()
    }
    document.addEventListener('keydown', handleKey)
    document.addEventListener('focusin', containFocus)
    const onResize = () => { if (mobile && !query.matches) closeRef.current?.() }
    query.addEventListener('change', onResize)
    return () => {
      cancelAnimationFrame(frame)
      if (mobile) { node.removeAttribute('aria-modal'); if (originalRole) node.setAttribute('role', originalRole); else node.removeAttribute('role') }
      document.removeEventListener('keydown', handleKey)
      document.removeEventListener('focusin', containFocus)
      query.removeEventListener('change', onResize)
      const i = openLayers.indexOf(node)
      if (i >= 0) openLayers.splice(i, 1)
      if (!openLayers.length) document.body.style.overflow = previousOverflow
      if (previous?.isConnected && (!openLayers.length || openLayers.at(-1).contains(previous))) previous.focus()
    }
  }, [open, mobile])
  return ref
}
