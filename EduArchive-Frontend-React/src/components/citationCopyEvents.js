const key = owner => `acadex:citation-copies:v1:${owner}`
const read = owner => {
  try {
    const events = JSON.parse(localStorage.getItem(key(owner)) || '[]')
    return Array.isArray(events) ? events.filter(event => event?.event_key && event?.capstone && ['apa', 'mla'].includes(event.format)) : []
  } catch { return [] }
}
const write = (owner, events) => {
  try { localStorage.setItem(key(owner), JSON.stringify(events)) } catch { /* Clipboard still works. */ }
}
const inflight = new Map()

export async function flushCitationCopies(api, owner) {
  if (!owner) return
  if (inflight.has(owner)) return inflight.get(owner)
  const work = (async () => {
    for (const event of read(owner)) {
      try {
        await api.post(`/capstones/${encodeURIComponent(event.capstone)}/citation`, event)
        write(owner, read(owner).filter(item => item.event_key !== event.event_key))
      } catch (error) {
        if ([403, 404, 409, 422].includes(error.response?.status)) {
          write(owner, read(owner).filter(item => item.event_key !== event.event_key))
        }
        break
      }
    }
  })()
  inflight.set(owner, work)
  try { await work } finally { inflight.delete(owner) }
}

export async function recordCitationCopy(api, owner, capstone, format) {
  const event = { capstone, format, action: 'copy', event_key: crypto.randomUUID() }
  write(owner, [...read(owner), event])
  // Send this event directly even when browser storage is unavailable.
  try {
    const response = await api.post(`/capstones/${encodeURIComponent(capstone)}/citation`, event)
    write(owner, read(owner).filter(item => item.event_key !== event.event_key))
    return response.data?.data
  } catch { return null }
}
