import test from 'node:test'
import assert from 'node:assert/strict'
import { getUploadProgress, formatElapsed } from '../src/components/uploadProgress.js'

test('file progress uses measured bytes and completes only at the transfer boundary', () => {
  assert.deepEqual(getUploadProgress({ loaded: 25, total: 100 }), { loaded: 25, total: 100, percent: 25, sent: false })
  assert.equal(getUploadProgress({ loaded: 99, total: 100 }).sent, false)
  assert.equal(getUploadProgress({ loaded: 100, total: 100 }).sent, true)
  assert.equal(getUploadProgress({ loaded: 110, total: 100 }).percent, 100)
})
test('unknown or invalid transfer totals never invent a percentage', () => {
  for (const total of [undefined, 0, -1, NaN, Infinity]) {
    const result = getUploadProgress({ loaded: 25, total })
    assert.equal(result.percent, null)
    assert.equal(result.sent, false)
  }
  assert.equal(getUploadProgress({ loaded: -1 }).loaded, 0)
})
test('elapsed time stays a duration rather than an estimated completion time', () => {
  assert.equal(formatElapsed(0), '0:00')
  assert.equal(formatElapsed(61.8), '1:01')
  assert.equal(formatElapsed(125), '2:05')
})
