import test from 'node:test'
import assert from 'node:assert/strict'
import { recordCitationCopy, flushCitationCopies } from '../src/components/citationCopyEvents.js'

test('lost copy acknowledgement retains one event id and replays it without allocating a second event', async () => {
  const values = new Map()
  globalThis.localStorage = { getItem: key => values.get(key) ?? null, setItem: (key, value) => values.set(key, value) }
  const events = []
  const api = { post: async (url, event) => {
    events.push({ url, ...event })
    if (events.length === 1) throw new Error('Lost acknowledgement')
    return { data: { data: { reference_count: 1 } } }
  } }
  assert.equal(await recordCitationCopy(api, 11, 7, 'apa'), null)
  await flushCitationCopies(api, 12)
  assert.equal(events.length, 1, 'Account switch must not replay another account copy')
  await flushCitationCopies(api, 11)
  assert.equal(events.length, 2)
  assert.equal(events[0].event_key, events[1].event_key)
  assert.equal(events[0].action, 'copy')
  await flushCitationCopies(api, 11)
  assert.equal(events.length, 2, 'Acknowledged copy is removed from retry storage')
  delete globalThis.localStorage
})

test('clipboard receipts still reach the API if browser storage is denied', async () => {
  globalThis.localStorage = { getItem: () => { throw new Error('Denied') }, setItem: () => { throw new Error('Denied') } }
  let calls = 0
  const result = await recordCitationCopy({ post: async (url, event) => {
    calls++
    assert.equal(event.format, 'mla')
    return { data: { data: { reference_count: 2 } } }
  } }, 13, 9, 'mla')
  assert.equal(calls, 1)
  assert.equal(result.reference_count, 2)
  delete globalThis.localStorage
})
