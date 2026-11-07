import test from 'node:test'
import assert from 'node:assert/strict'
import { createCapstoneUploadManager, getUploadReviewState } from '../src/components/capstoneUploadManager.js'

const deferred = () => {
  let resolve, reject
  const promise = new Promise((yes, no) => { resolve = yes; reject = no })
  return { promise, resolve, reject }
}
const settle = () => new Promise(resolve => setImmediate(resolve))
const pdf = () => new File(['synthetic upload'], 'synthetic.pdf', { type: 'application/pdf' })
const stored = (id = 'upload-one', status = 'queued') => ({ data: { data: {
  upload_id: id, pdf_path: `private/${id}.enc`, pdf_original_name: 'synthetic.pdf', processing_status: status,
} } })
function fixture(t, get = () => new Promise(() => {}), deleteFn = null) {
  const posts = [], deletes = [], timers = new Map()
  let timerId = 0
  const manager = createCapstoneUploadManager({
    api: {
      post: (path, form, config) => {
        const response = deferred()
        posts.push({ path, form, config, ...response })
        return response.promise
      },
      get,
      delete: (path, config) => {
        deletes.push({ path, config })
        return deleteFn ? deleteFn(path, config) : Promise.resolve({ data: {} })
      },
    },
    errorMessage: (error, fallback) => error.response?.data?.message || fallback,
    schedule: (fn, delay) => { const id = timerId++; timers.set(id, { fn, delay }); return id },
    unschedule: id => timers.delete(id), now: () => 123000,
  })
  manager.setOwner(42)
  t.after(() => manager.dispose())
  return { manager, posts, deletes, timers }
}

test('minimizing and removing route subscribers preserves the transfer and its progress', async t => {
  const { manager, posts } = fixture(t)
  const unsubscribe = manager.subscribe(() => {})
  assert.equal(manager.start(pdf(), 'student'), true)
  assert.equal(posts[0].path, '/student/capstones/upload')
  manager.minimize()
  unsubscribe()
  posts[0].config.onUploadProgress({ loaded: 37, total: 100 })
  assert.equal(posts[0].config.signal.aborted, false)
  assert.equal(manager.getSnapshot().task.transfer.percent, 37)
  manager.expand()
  assert.equal(manager.getSnapshot().task.startedAt, 123000)
  posts[0].resolve(stored())
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'queued')
  assert.equal(getUploadReviewState(manager.getSnapshot().task).pdfInfo.pdf_path, 'private/upload-one.enc')
})

test('cancel aborts the request and late progress/completion cannot overwrite a retry', async t => {
  const { manager, posts } = fixture(t)
  manager.start(pdf(), 'admin')
  manager.cancel()
  assert.equal(posts[0].config.signal.aborted, true)
  assert.equal(manager.getSnapshot().task.phase, 'cancelled')
  manager.retry()
  assert.equal(posts.length, 2)
  posts[1].config.onUploadProgress({ loaded: 20, total: 100 })
  posts[0].config.onUploadProgress({ loaded: 100, total: 100 })
  posts[0].resolve(stored('old', 'completed'))
  await settle()
  assert.equal(manager.getSnapshot().task.transfer.percent, 20)
  assert.equal(manager.getSnapshot().task.phase, 'uploading')
  posts[1].resolve(stored('new', 'completed'))
  await settle()
  assert.equal(manager.getSnapshot().task.data.upload_id, 'new')
})

test('a second upload opens the existing activity instead of duplicating the transfer', t => {
  const { manager, posts } = fixture(t)
  manager.start(pdf(), 'faculty')
  manager.minimize()
  assert.equal(manager.start(pdf(), 'faculty'), false)
  assert.equal(posts.length, 1)
  assert.equal(manager.getSnapshot().expanded, true)
})

test('background polling completes while minimized and preserves the review reference', async t => {
  let calls = 0
  const { manager, posts, timers } = fixture(t, async () => ({ data: { data: ++calls === 1
    ? { processing_status: 'processing' }
    : { processing_status: 'completed', extracted: { title: 'Synthetic study' } } } }))
  manager.start(pdf(), 'student')
  manager.minimize()
  posts[0].resolve(stored())
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'processing')
  assert.equal(manager.getSnapshot().expanded, false)
  const next = timers.values().next().value
  timers.clear()
  next.fn()
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'completed')
  assert.equal(getUploadReviewState(manager.getSnapshot().task).extracted.title, 'Synthetic study')
  assert.equal(getUploadReviewState(manager.getSnapshot().task).uploadId, 'upload-one')
  assert.equal(timers.size, 0)
})

test('review page owns polling while open; late aborted polls are ignored and polling resumes on exit', async t => {
  const gets = []
  const { manager, posts } = fixture(t, (url, config) => {
    const response = deferred(); gets.push({ url, config, ...response }); return response.promise
  })
  manager.start(pdf(), 'admin')
  posts[0].resolve(stored())
  await settle()
  manager.setReviewing(true)
  assert.equal(gets[0].config.signal.aborted, true)
  gets[0].resolve({ data: { data: { processing_status: 'failed' } } })
  manager.observeStatus('upload-one', { processing_status: 'processing' })
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'processing')
  manager.observeStatus('another-upload', { processing_status: 'completed' })
  assert.equal(manager.getSnapshot().task.phase, 'processing')
  manager.setReviewing(false)
  assert.equal(gets.length, 2)
})

test('temporary status failures back off without claiming the server processing failed', async t => {
  const { manager, posts, timers } = fixture(t, async () => { throw new Error('Offline') })
  manager.start(pdf(), 'faculty')
  posts[0].resolve(stored())
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'queued')
  assert.match(manager.getSnapshot().task.connectionError, /temporarily unavailable/)
  assert.equal(timers.values().next().value.delay, 10000)
})

test('expired uploads stop polling and cannot be reopened for review', async t => {
  const { manager, posts, timers } = fixture(t, async () => { throw { response: { status: 410 } } })
  manager.start(pdf(), 'student')
  posts[0].resolve(stored())
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'unavailable')
  assert.equal(timers.size, 0)
  manager.dismiss()
  assert.equal(manager.getSnapshot().task, null)
})

test('logout or account changes abort requests and clear filenames and timers', async t => {
  const { manager, posts, timers } = fixture(t)
  manager.start(pdf(), 'admin')
  manager.setOwner(null)
  assert.equal(posts[0].config.signal.aborted, true)
  assert.equal(manager.getSnapshot().task, null)
  manager.setOwner(99)
  posts[0].resolve(stored())
  await settle()
  assert.equal(manager.getSnapshot().task, null)
  assert.equal(timers.size, 0)
  assert.equal(manager.start(pdf(), 'student'), true)
  assert.equal(manager.getSnapshot().task.owner, 99)
})

test('dismiss with upload_id calls DELETE /uploads/{id}', async t => {
  const { manager, posts, deletes } = fixture(t)
  manager.start(pdf(), 'student')
  posts[0].resolve(stored('upload-123', 'completed'))
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'completed')
  manager.dismiss()
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].path, '/uploads/upload-123')
  assert.equal(manager.getSnapshot().task, null)
})

test('dismiss without upload_id calls DELETE /uploads/transfers/{transferId}', async t => {
  const deletes = []
  const manager = createCapstoneUploadManager({
    api: {
      post: () => new Promise(() => {}),
      delete: (path, config) => { deletes.push({ path, config }); return Promise.resolve({ data: {} }) }
    },
    errorMessage: (e, f) => f,
    sendFile: () => new Promise(() => {}),
    uuid: () => 'transfer-custom-uuid',
  })
  manager.setOwner(42)
  t.after(() => manager.dispose())
  manager.start(pdf(), 'student')
  assert.equal(manager.getSnapshot().task.transferId, 'transfer-custom-uuid')
  manager.cancel()
  assert.equal(manager.getSnapshot().task.phase, 'cancelled')
  manager.dismiss()
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].path, '/uploads/transfers/transfer-custom-uuid')
  assert.equal(manager.getSnapshot().task, null)
})

test('dismiss ignores 404 error from DELETE /uploads/{id}', async t => {
  const { manager, posts, deletes } = fixture(t, () => new Promise(() => {}), () => Promise.reject({ response: { status: 404 } }))
  manager.start(pdf(), 'student')
  posts[0].resolve(stored('upload-404', 'completed'))
  await settle()
  manager.dismiss()
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].path, '/uploads/upload-404')
  assert.equal(manager.getSnapshot().task, null)
})

test('dismiss while uploading or processing does nothing', async t => {
  const { manager, posts, deletes } = fixture(t)
  manager.start(pdf(), 'student')
  // phase is uploading
  manager.dismiss()
  assert.notEqual(manager.getSnapshot().task, null)
  assert.equal(deletes.length, 0)

  // now in processing
  posts[0].resolve(stored('upload-proc', 'processing'))
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'processing')
  manager.dismiss()
  assert.notEqual(manager.getSnapshot().task, null)
  assert.equal(deletes.length, 0)
})

test('dismiss allowed in phase queued', async t => {
  const { manager, posts, deletes } = fixture(t)
  manager.start(pdf(), 'student')
  posts[0].resolve(stored('upload-queued', 'queued'))
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'queued')
  manager.dismiss()
  assert.equal(deletes.length, 1)
  assert.equal(deletes[0].path, '/uploads/upload-queued')
  assert.equal(manager.getSnapshot().task, null)
})

test('an expired resumed transfer asks for the PDF again and can be dismissed', async t => {
  let attempts = 0
  let nextTransfer = 0
  const deletes = []
  const transferIds = []
  const manager = createCapstoneUploadManager({
    api: {
      post: () => Promise.resolve(stored()),
      get: () => new Promise(() => {}),
      delete: path => { deletes.push(path); return Promise.reject({ response: { status: 410 } }) },
    },
    sendFile: async ({ task }) => {
      attempts++
      transferIds.push(task.transferId)
      if (attempts === 1) {
        throw { response: { status: 422, data: { message: 'Pending uploads have reached the storage limit.' } } }
      }
      if (attempts === 2) {
        throw { response: { status: 410, data: { message: 'This upload expired. Select the PDF again.' } } }
      }
      return stored('upload-after-reselect')
    },
    uuid: () => `transfer-${++nextTransfer}`,
    errorMessage: (error, fallback) => error.response?.data?.message || fallback,
  })
  manager.setOwner(42)
  t.after(() => manager.dispose())

  assert.equal(manager.start(pdf(), 'student'), true)
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'error')
  manager.retry()
  await settle()
  assert.equal(manager.getSnapshot().task.phase, 'unavailable')
  assert.equal(manager.getSnapshot().task.error, 'This upload expired. Select the PDF again.')
  manager.retry()
  assert.equal(attempts, 2)
  assert.equal(transferIds[0], transferIds[1])

  manager.dismiss()
  assert.deepEqual(deletes, ['/uploads/transfers/transfer-1'])
  assert.equal(manager.getSnapshot().task, null)
  assert.equal(manager.start(pdf(), 'student'), true)
  await settle()
  assert.equal(attempts, 3)
  assert.notEqual(transferIds[1], transferIds[2])
  assert.equal(manager.getSnapshot().task.data.upload_id, 'upload-after-reselect')
})
