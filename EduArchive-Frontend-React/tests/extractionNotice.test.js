import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getExtractionNotice } from '../src/components/extractionNotice.js'

test('empty, failed and skipped extraction never claim metadata was filled', () => {
  for (const state of [{ extracted: {} }, { extracted: { program: 'BSIT' } }, { extracted: { title: 'Untitled', author: 'Unknown Author' } }, { extractionStatus: 'unavailable', extracted: {} }, { skipped: true, extracted: {} }]) {
    const message = getExtractionNotice(state)
    assert.match(message, /enter|fill/i)
    assert.doesNotMatch(message, /auto-extracted|suggestions filled/i)
  }
})

test('successful bounded extraction explains which pages supplied suggestions', () => {
  const message = getExtractionNotice({ extractionStatus: 'complete', extractionScope: 'first_12_pages', extracted: { title: 'Synthetic archive' } })
  assert.match(message, /first 12 pages/i)
  assert.match(message, /review/i)
})
