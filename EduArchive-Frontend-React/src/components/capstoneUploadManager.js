import { getUploadProgress } from './uploadProgress.js'

const processing = task => ['queued', 'processing'].includes(task?.phase)

export function getUploadReviewState(task) {
  const data = task.data
  return {
    pdfInfo: { pdf_path: data.pdf_path, pdf_original_name: data.pdf_original_name, upload_id: data.upload_id },
    uploadId: data.upload_id,
    extracted: data.extracted || {},
    extractionStatus: data.extraction_status || data.processing_status || 'queued',
    extractionScope: data.extraction_scope,
    processingStatus: data.processing_status || 'queued',
    processingError: data.processing_error || '',
    retryable: Boolean(data.retryable),
    notes: data.notes || [],
    skipped: false,
  }
}

// This store belongs to the app, so route/modal unmounts never abort a transfer.
export function createCapstoneUploadManager({ api, errorMessage, schedule = setTimeout, unschedule = clearTimeout, now = Date.now, persistence = null, sendFile = null, uuid = () => crypto.randomUUID() }) {
  let snapshot = { task: null, expanded: false }
  let owner = null
  let generation = 0
  let request = null
  let pollRequest = null
  let timer = null
  let file = null
  let reviewing = false
  const listeners = new Set()
  let checkpointWrites = Promise.resolve()
  const persist = operation => {
    checkpointWrites = checkpointWrites.catch(() => {}).then(operation)
    return checkpointWrites
  }
  const publish = next => {
    snapshot = next
    if (persistence && next.task) {
      const task = next.task
      void persist(() => persistence.saveTask(task.owner, task)).catch(() => {})
    }
    listeners.forEach(listener => listener())
  }
  const patchTask = changes => publish({ ...snapshot, task: { ...snapshot.task, ...changes } })
  const current = version => version === generation && snapshot.task !== null
  const stopPolling = () => {
    if (timer !== null) unschedule(timer)
    timer = null
    pollRequest?.abort()
    pollRequest = null
  }
  const reset = (clearCheckpoint = true) => {
    if (clearCheckpoint && persistence && owner !== null) {
      const previous = owner
      void persist(() => persistence.clear(previous)).catch(() => {})
    }
    generation += 1
    request?.abort()
    request = null
    stopPolling()
    file = null
    publish({ task: null, expanded: false })
  }
  const observeStatus = (uploadId, data) => {
    if (!uploadId || snapshot.task?.data?.upload_id !== uploadId) return
    if (data.capstone_id) { reset(); return }
    const phase = data.processing_status
    if (!['queued', 'processing', 'completed', 'failed'].includes(phase)) return
    patchTask({ phase, data: { ...snapshot.task.data, ...data }, error: data.processing_error || '', connectionError: '' })
  }
  const poll = async (version = generation, force = false) => {
    if (!current(version) || reviewing || (!force && !processing(snapshot.task)) || pollRequest) return
    if (timer !== null) unschedule(timer)
    timer = null
    const controller = new AbortController()
    pollRequest = controller
    let delay = 5000
    try {
      const uploadId = snapshot.task.data.upload_id
      const response = await api.get(`/uploads/${uploadId}/status`, { signal: controller.signal })
      if (current(version) && !controller.signal.aborted) observeStatus(uploadId, response.data.data || {})
    } catch (error) {
      if (!current(version) || controller.signal.aborted) return
      if ([401, 403, 404, 410].includes(error.response?.status)) {
        patchTask({ phase: 'unavailable', error: errorMessage(error, 'This upload is no longer available. Please upload the PDF again.') })
      } else {
        delay = 10000
        patchTask({ connectionError: 'Progress is temporarily unavailable. We will check again automatically.' })
      }
    } finally {
      if (pollRequest === controller) pollRequest = null
      if (current(version) && !controller.signal.aborted && !reviewing && processing(snapshot.task)) {
        timer = schedule(() => { timer = null; void poll(version) }, delay)
      }
    }
  }
  const transfer = async (selected, role, version, controller) => {
    try {
      const task = snapshot.task
      if (persistence) {
        await persist(() => persistence.saveFile(task.owner, selected))
        await checkpointWrites
        if (!current(version) || controller.signal.aborted) return
      }
      const onProgress = event => {
        if (current(version) && !controller.signal.aborted) patchTask({ transfer: getUploadProgress(event) })
      }
      let response
      if (sendFile) {
        response = await sendFile({ api, selected, task, signal: controller.signal, onProgress })
      } else {
        const form = new FormData()
        form.append('pdf', selected)
        response = await api.post(`/${role}/capstones/upload`, form, {
          headers: { 'Content-Type': 'multipart/form-data' }, signal: controller.signal, onUploadProgress: onProgress,
        })
      }
      if (!current(version) || controller.signal.aborted) return
      const data = response.data.data || {}
      if (!data.upload_id || !data.pdf_path) throw new Error('Missing upload reference')
      request = null
      file = null
      patchTask({ phase: data.processing_status || 'queued', data, error: data.processing_error || '' })
      // Persist the stable server reference before dropping the browser file.
      if (persistence) void persist(() => persistence.removeFile(task.owner)).catch(() => {})
      void poll(version)
    } catch (error) {
      if (!current(version) || controller.signal.aborted) return
      request = null
      if (error.response?.status === 410) {
        patchTask({ phase: 'unavailable', error: errorMessage(error, 'This upload expired. Select the PDF again.') })
      } else {
        patchTask({ phase: 'error', error: errorMessage(error, error.response
          ? 'The upload could not be completed. Please resume it or try again shortly.'
          : error.message || 'Upload failed. Please try again.') })
      }
    }
  }
  const start = (selected, role) => {
    if (snapshot.restoring) return false
    if (snapshot.task) { publish({ ...snapshot, expanded: true }); return false }
    if (owner === null || !selected || !['admin', 'faculty', 'student'].includes(role)) return false
    file = selected
    const version = ++generation
    const controller = new AbortController()
    request = controller
    publish({ expanded: true, task: {
      owner, role, name: selected.name, size: selected.size, startedAt: now(),
      ...(sendFile ? { transferId: uuid() } : {}),
      phase: 'uploading', transfer: getUploadProgress(), data: null, error: '', connectionError: '',
    } })
    void transfer(selected, role, version, controller)
    return true
  }
  return {
    getSnapshot: () => snapshot,
    subscribe: listener => { listeners.add(listener); return () => listeners.delete(listener) },
    start,
    expand: () => { if (snapshot.task) publish({ ...snapshot, expanded: true }) },
    minimize: () => publish({ ...snapshot, expanded: false }),
    cancel: () => {
      if (snapshot.task?.phase !== 'uploading') return
      generation += 1
      request?.abort()
      request = null
      patchTask({ phase: 'cancelled', error: '' })
    },
    retry: () => {
      if (!file || !['error', 'cancelled'].includes(snapshot.task?.phase)) return
      const version = ++generation
      const controller = new AbortController()
      request = controller
      patchTask({ phase: 'uploading', error: '', connectionError: '' })
      void transfer(file, snapshot.task.role, version, controller)
    },
    dismiss: () => {
      if (snapshot.task?.phase === 'uploading' || snapshot.task?.phase === 'processing') return
      const uploadId = snapshot.task?.data?.upload_id
      const submitted = Boolean(snapshot.task?.data?.capstone_id)
      if (uploadId && !submitted) {
        void api.delete(`/uploads/${uploadId}`).catch(() => {})
      } else if (snapshot.task?.transferId && !uploadId) {
        void api.delete(`/uploads/transfers/${snapshot.task.transferId}`).catch(() => {})
      }
      reset()
    },
    setOwner: id => {
      if (owner === id) return
      const previous = owner
      reset(false)
      if (previous !== null && persistence) void persist(() => persistence.clear(previous)).catch(() => {})
      owner = id
      if (id === null || !persistence) return
      const version = generation
      publish({ ...snapshot, restoring: true })
      void persist(() => persistence.load(id)).then(saved => {
        if (owner !== id || version !== generation) return
        if (!saved?.task || saved.task.owner !== id) { publish({ ...snapshot, restoring: false }); return }
        file = saved.file || null
        publish({ task: saved.task, expanded: false, restoring: false })
        if (saved.task.phase === 'uploading') {
          if (!file) { patchTask({ phase: 'unavailable', error: 'The browser no longer has this PDF. Dismiss and select it again.' }); return }
          const controller = new AbortController()
          request = controller
          void transfer(file, saved.task.role, version, controller)
        } else if (saved.task.data?.upload_id) void poll(version, true)
      }).catch(() => {
        if (owner === id && version === generation) publish({ ...snapshot, restoring: false })
      })
    },
    setReviewing: value => {
      if (reviewing === value) return
      reviewing = value
      stopPolling()
      if (!reviewing) void poll()
    },
    observeStatus,
    refresh: () => { void poll() },
    dispose: () => { reset(false); owner = null },
  }
}
