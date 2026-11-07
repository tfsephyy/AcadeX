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

test('raw SQL and HTML failures never appear as upload notifications', () => {
  for (const data of [
    { message: "SQLSTATE[42S02]: Table 'eduarchivedb.upload_transfers' doesn't exist" },
    '<!DOCTYPE html><html>Private exception trace</html>',
    { message: 'Illuminate\\Database\\QueryException: private SQL' },
  ]) assert.equal(getApiErrorMessage({ response: { status: 500, data } }, 'Please resume your upload or try again shortly.'), 'Please resume your upload or try again shortly.')
})
