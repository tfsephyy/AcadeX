import test from 'node:test'
import assert from 'node:assert/strict'
import fs from 'node:fs'

const source = fs.readFileSync(new URL('../src/components/ProgressivePdfDocument.jsx', import.meta.url), 'utf8')
function fixture(fetcher) {
  let now = 0
  let next = 0
  const timers = new Map()
  const tick = async ms => {
    now += ms
    for (const [id, timer] of [...timers]) if (timer.at <= now) { timers.delete(id); timer.fn() }
    for (let i = 0; i < 8; i++) await Promise.resolve()
  }
  const code = source.slice(source.indexOf('const CHUNK_BYTES'), source.indexOf('/** Each viewer'))
  const load = new Function('fetch', 'setTimeout', 'clearTimeout', `${code}; return { fetchRangeStreaming, createRangeFetcher: typeof createRangeFetcher === 'function' ? createRangeFetcher : null, chunk: CHUNK_BYTES }`)(
    fetcher,
    (fn, delay) => { const id = ++next; timers.set(id, { fn, at: now + delay }); return id },
    id => timers.delete(id),
  )
  return { ...load, tick, timers }
}
function waitForAbort(signal) {
  return new Promise((resolve, reject) => {
    if (signal.aborted) reject(signal.reason)
    else signal.addEventListener('abort', () => reject(signal.reason), { once: true })
  })
}
test('first range is 64 KiB', () => assert.equal(fixture(() => {}).chunk, 65536))
test('no response headers times out after 60 seconds', async () => {
  const f = fixture((url, { signal }) => waitForAbort(signal))
  const pending = f.fetchRangeStreaming('/pdf', 0, 65536)
  const rejected = assert.rejects(pending, /timeout/)
  await f.tick(60001)
  assert.equal(f.timers.size, 0)
  await rejected
})
test('slow continuing bytes survive beyond the old 180-second limit and report activity', async () => {
  let supply
  const progress = []
  const f = fixture(async (url, { signal }) => ({ ok: true, body: { getReader: () => ({
    read: () => new Promise((resolve, reject) => {
      supply = resolve
      signal.addEventListener('abort', () => reject(signal.reason), { once: true })
    }), releaseLock() {},
  }) } }))
  const pending = f.fetchRangeStreaming('/pdf', 0, 4, undefined, n => progress.push(n))
  await f.tick(0)
  for (let i = 0; i < 4; i++) { await f.tick(50000); supply({ done: false, value: new Uint8Array([i]) }); await f.tick(0) }
  supply({ done: true }); await f.tick(0)
  const { data } = await pending
  assert.deepEqual([...data], [0, 1, 2, 3])
  assert.deepEqual(progress, [1, 1, 1, 1])
  assert.equal(f.timers.size, 0)
})
test('body stall aborts and retry can complete', async () => {
  let attempt = 0
  const f = fixture(async (url, { signal }) => {
    if (++attempt === 1) return { ok: true, body: { getReader: () => ({ read: () => waitForAbort(signal), releaseLock() {} }) } }
    return { ok: true, arrayBuffer: async () => new Uint8Array([9]).buffer }
  })
  const failed = f.fetchRangeStreaming('/pdf', 0, 1)
  const rejected = assert.rejects(failed, /timeout/)
  await f.tick(0); await f.tick(60001); await rejected
  assert.deepEqual([...(await f.fetchRangeStreaming('/pdf', 0, 1)).data], [9])
  assert.equal(f.timers.size, 0)
})
test('pre-aborted navigation never starts a fetch', async () => {
  let called = false
  const f = fixture(async () => { called = true; return { ok: true, arrayBuffer: async () => new ArrayBuffer(0) } })
  const controller = new AbortController(); controller.abort(new Error('navigation'))
  await assert.rejects(f.fetchRangeStreaming('/pdf', 0, 1, controller.signal), /navigation/)
  assert.equal(called, false)
})
test('range bursts run at most four requests at once', async () => {
  let active = 0, peak = 0
  const finish = []
  const f = fixture(async () => {
    peak = Math.max(peak, ++active)
    return { ok: true, arrayBuffer: () => new Promise(resolve => finish.push(() => { active--; resolve(new ArrayBuffer(1)) })) }
  })
  assert.equal(typeof f.createRangeFetcher, 'function')
  const fetchRange = f.createRangeFetcher('/pdf', new AbortController().signal)
  const pending = Array.from({ length: 12 }, (_, i) => fetchRange(i, i + 1))
  await f.tick(0)
  assert.equal(active, 4)
  for (let i = 0; i < 3; i++) { finish.splice(0).forEach(fn => fn()); await f.tick(0) }
  await Promise.all(pending)
  assert.equal(peak, 4); assert.equal(f.timers.size, 0)
})
