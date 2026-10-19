import { test } from 'node:test'
import assert from 'node:assert/strict'
import { getApiErrorMessage } from '../src/api/errors.js'

test('prefers the server message for upload limit failures', () => {
  const error = { response: { data: { message: 'The upload is too large for this server.', errors: { pdf: ['ignored'] } } } }
  assert.equal(getApiErrorMessage(error), 'The upload is too large for this server.')
})

test('falls back to the first validation field message and then the caller fallback', () => {
  assert.equal(getApiErrorMessage({ response: { data: { errors: { pdf: ['The file must be a valid PDF.'] } } } }), 'The file must be a valid PDF.')
  assert.equal(getApiErrorMessage(new Error('network')), 'Something went wrong. Please try again.')
  assert.equal(getApiErrorMessage(null, 'Upload failed.'), 'Upload failed.')
})
