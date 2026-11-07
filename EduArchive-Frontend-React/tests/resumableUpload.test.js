import test from 'node:test'
import assert from 'node:assert/strict'
import { resumableCapstoneTransfer } from '../src/components/resumableCapstoneTransfer.js'
import { createCapstoneUploadManager } from '../src/components/capstoneUploadManager.js'

const response = data => ({ data: { data } })
const flush = async () => { for (let i = 0; i < 30; i++) await new Promise(resolve => setImmediate(resolve)) }
const file = new File(['abcdef'], 'synthetic.pdf', { type: 'application/pdf' })

test('reconnect uses server acknowledged bytes, retries finalization with the same transfer, and never re-sends confirmed chunks', async () => {
  const calls = [], progress = []
  const api = {
    put: async (path, body) => { calls.push([path, body]); return response({ received_bytes: 2, chunk_bytes: 2 }) },
    post: async (path, form) => {
      if (path.endsWith('/complete')) return response({ upload_id: 'owned', processing_status: 'queued' })
      const offset = Number(form.get('offset'))
      calls.push([path, offset, await form.get('chunk').text()])
      return response({ received_bytes: offset + 2, chunk_bytes: 2 })
    },
  }
  const result = await resumableCapstoneTransfer({ api, selected: file, task: { name: file.name, size: 6, transferId: 'same-id' }, signal: new AbortController().signal, onProgress: event => progress.push(event.loaded) })
  assert.equal(result.data.data.upload_id, 'owned')
  assert.deepEqual(calls.slice(1).map(call => call.slice(1)), [[2, 'cd'], [4, 'ef']])
  assert.deepEqual(progress, [2, 4, 6])
  api.put = async () => response({ upload_id: 'owned' })
  api.post = async path => { assert.equal(path, '/uploads/transfers/same-id/complete'); return response({ upload_id: 'owned' }) }
  await resumableCapstoneTransfer({ api, selected: file, task: { name: file.name, size: 6, transferId: 'same-id' }, signal: new AbortController().signal, onProgress: () => assert.fail() })
})

function storage() {
  let saved = null, pdf = null
  return {
    load: async () => saved ? { task: structuredClone(saved), file: pdf } : null,
    saveTask: async (owner, task) => { saved = structuredClone(task) },
    saveFile: async (owner, file) => { pdf = file },
    removeFile: async () => { assert(saved.data?.upload_id, 'Stable reference must be saved before removing the file'); pdf = null },
    clear: async () => { saved = null; pdf = null },
    get saved() { return saved },
  }
}

test('a new app restores the selected PDF and same transfer after refresh, then restores extraction without sending another upload', async () => {
  const persistence = storage(), sends = []
  let finish
  const api = { get: async () => response({ processing_status: 'processing' }) }
  const make = () => createCapstoneUploadManager({ api, persistence, uuid: () => 'durable-id', errorMessage: (e, fallback) => fallback,
    schedule: () => 1, unschedule: () => {}, sendFile: options => { sends.push(options); return new Promise(resolve => { finish = resolve }) } })
  const first = make()
  first.setOwner(5)
  await flush()
  assert(first.start(file, 'student'))
  await flush()
  first.dispose()
  const second = make()
  second.setOwner(5)
  await flush()
  assert.equal(sends.length, 2)
  assert.equal(sends[1].task.transferId, sends[0].task.transferId)
  assert.equal(await sends[1].selected.text(), 'abcdef')
  finish(response({ upload_id: 'same-upload', pdf_path: 'upload:same-upload', processing_status: 'queued' }))
  await flush()
  assert.equal(second.getSnapshot().task.phase, 'processing')
  second.dispose()
  const third = make()
  third.setOwner(5)
  await flush()
  assert.equal(sends.length, 2)
  assert.equal(third.getSnapshot().task.data.upload_id, 'same-upload')
  third.setOwner(null)
  await flush()
  assert.equal(persistence.saved, null)
})

test('a lost finalization response resumes the same transfer rather than allocating another upload', async () => {
  const sends = []
  const manager = createCapstoneUploadManager({ api: { get: async () => response({ processing_status: 'completed' }) }, uuid: () => 'same-id',
    errorMessage: (e, fallback) => fallback, sendFile: async options => {
      sends.push(options.task.transferId)
      if (sends.length === 1) throw new Error('Connection interrupted')
      return response({ upload_id: 'same-upload', pdf_path: 'upload:same-upload', processing_status: 'completed' })
    } })
  manager.setOwner(5)
  manager.start(file, 'student')
  await flush()
  manager.retry()
  await flush()
  assert.deepEqual(sends, ['same-id', 'same-id'])
  assert.equal(manager.getSnapshot().task.phase, 'completed')
  manager.dispose()
})

test('a submitted upload clears restored activity instead of offering another capstone submission', async () => {
  const persistence = storage()
  await persistence.saveTask(5, { owner: 5, role: 'student', phase: 'completed', data: { upload_id: 'claimed' } })
  const manager = createCapstoneUploadManager({ api: { get: async () => response({ capstone_id: 8, processing_status: 'completed' }) }, persistence, errorMessage: () => '' })
  manager.setOwner(5)
  await flush()
  assert.equal(manager.getSnapshot().task, null)
  assert.equal(persistence.saved, null)
})
