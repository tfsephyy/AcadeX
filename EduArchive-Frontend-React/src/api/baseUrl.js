export function resolveApiBaseUrl(value, production = false) {
  const configured = value?.trim()
  if (!configured) {
    if (production) throw new Error('VITE_API_BASE_URL must be configured for a production build.')
    return 'http://localhost:8000/api/v1'
  }
  if (configured === '/api/v1') return configured
  const url = new URL(configured)
  if (url.username || url.password || url.search || url.hash ||
      url.pathname.replace(/\/$/, '') !== '/api/v1' ||
      !['http:', 'https:'].includes(url.protocol) ||
      (production && (url.protocol !== 'https:' || ['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)))) {
    throw new Error('VITE_API_BASE_URL must be /api/v1 or an approved HTTPS API URL ending in /api/v1.')
  }
  return configured.replace(/\/$/, '')
}
