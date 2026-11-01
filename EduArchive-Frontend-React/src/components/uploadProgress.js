export function getUploadProgress({ loaded, total } = {}) {
  const sent = Number.isFinite(loaded) ? Math.max(0, loaded) : 0
  const size = Number.isFinite(total) && total > 0 ? total : null
  return { loaded: sent, total: size, percent: size ? Math.min(100, Math.floor(sent / size * 100)) : null, sent: size !== null && sent >= size }
}

export function formatElapsed(seconds) {
  const value = Math.max(0, Math.floor(seconds))
  return `${Math.floor(value / 60)}:${String(value % 60).padStart(2, '0')}`
}
