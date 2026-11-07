import test from 'node:test'
import assert from 'node:assert/strict'
import { readingProgressKey, readPage, savePage, visiblePage } from '../src/utils/pdfReadingProgress.js'

test('reading positions are isolated by PDF type, document and account, including visitors', () => {
  const values = new Map()
  const storage = { getItem: key => values.get(key), setItem: (key, value) => values.set(key, value) }
  const key = readingProgressKey('42:capstone', 7)
  savePage(storage, key, 9)
  assert.equal(readPage(storage, key, 20), 9)
  for (const other of [readingProgressKey('42:imrad', 7), readingProgressKey('43:capstone', 7), readingProgressKey('42:capstone', 8), readingProgressKey('42:capstone', null)]) {
    assert.equal(readPage(storage, other, 20), 1)
  }
  const visitorKey = readingProgressKey('42:capstone', null)
  savePage(storage, visitorKey, 4)
  assert.equal(readPage(storage, visitorKey, 20), 4)
  assert.equal(readPage(storage, key, 20), 9)
})

test('shortened PDFs clamp progress; malformed and inaccessible browser storage cannot break viewing', () => {
  assert.equal(readPage({ getItem: () => '99' }, 'doc', 12), 12)
  for (const value of ['0', '-1', '1.5', 'NaN', 'Infinity', 'corrupt', null]) {
    assert.equal(readPage({ getItem: () => value }, 'doc', 12), 1)
  }
  const blocked = { getItem: () => { throw Error('Denied') }, setItem: () => { throw Error('Quota') } }
  assert.equal(readPage(blocked, 'doc', 12), 1)
  assert.doesNotThrow(() => savePage(blocked, 'doc', 4))
})

test('page tracking follows the viewport top, including gaps, first and final pages', () => {
  const pages = [100, 210, 320].map((bottom, i) => ({ dataset: { documentPage: String(i + 1) }, getBoundingClientRect: () => ({ bottom }) }))
  assert.equal(visiblePage(pages, 0), 1)
  assert.equal(visiblePage(pages, 99), 2)
  assert.equal(visiblePage(pages, 150), 2)
  assert.equal(visiblePage(pages, 250), 3)
  assert.equal(visiblePage(pages, 400), 3)
})
