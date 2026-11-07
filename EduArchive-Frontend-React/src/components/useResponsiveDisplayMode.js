import { useState, useSyncExternalStore } from 'react'

const query = '(min-width: 1024px)'
const subscribe = listener => {
  const media = window.matchMedia(query)
  media.addEventListener('change', listener)
  return () => media.removeEventListener('change', listener)
}

// Follow the viewport until the user explicitly chooses a layout.
export function useResponsiveDisplayMode() {
  const desktop = useSyncExternalStore(subscribe, () => window.matchMedia(query).matches, () => false)
  const [choice, setChoice] = useState(null)
  return [choice ?? (desktop ? 'table' : 'card'), setChoice]
}
