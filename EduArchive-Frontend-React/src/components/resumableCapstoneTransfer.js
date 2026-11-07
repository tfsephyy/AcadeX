export async function resumableCapstoneTransfer({ api, selected, task, signal, onProgress }) {
  const run = async () => {
    const base = `/uploads/transfers/${task.transferId}`
    const response = await api.put(base, { name: task.name, size: task.size }, { signal })
    let state = response.data.data
    if (!state.upload_id) {
      let offset = state.received_bytes
      onProgress({ loaded: offset, total: selected.size })
      while (offset < selected.size) {
        const end = Math.min(offset + state.chunk_bytes, selected.size)
        const form = new FormData()
        form.append('offset', String(offset))
        form.append('chunk', selected.slice(offset, end), 'chunk.bin')
        const acknowledgement = await api.post(`${base}/chunks`, form, {
          signal, headers: { 'Content-Type': 'multipart/form-data' },
          onUploadProgress: event => {
            if (event.total > 0) onProgress({ loaded: offset + (end - offset) * Math.min(1, event.loaded / event.total), total: selected.size })
          },
        })
        state = acknowledgement.data.data
        if (state.upload_id) break
        if (state.received_bytes <= offset || state.received_bytes > selected.size) throw new Error('Invalid upload acknowledgement. Reconnect and try again.')
        offset = state.received_bytes
        onProgress({ loaded: offset, total: selected.size })
      }
    }
    return api.post(`${base}/complete`, {}, { signal })
  }
  // Coordinate same-upload recovery in multiple tabs. Server locks also enforce correctness.
  return globalThis.navigator?.locks
    ? navigator.locks.request(`acadex-upload:${task.transferId}`, { signal }, run)
    : run()
}
