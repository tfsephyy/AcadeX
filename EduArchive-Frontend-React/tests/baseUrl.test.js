import { test } from 'node:test'
import assert from 'node:assert/strict'
import { resolveApiBaseUrl } from '../src/api/baseUrl.js'

test('development fallback and explicit HTTPS/same-origin production settings', () => {
  assert.equal(resolveApiBaseUrl(), 'http://localhost:8000/api/v1')
  assert.equal(resolveApiBaseUrl('/api/v1', true), '/api/v1')
  assert.equal(resolveApiBaseUrl('https://api.example.invalid/api/v1/', true), 'https://api.example.invalid/api/v1')
})
test('production rejects missing, insecure, local and credential-bearing API addresses', () => {
  for (const value of [undefined, '', 'http://api.example.invalid/api/v1', 'https://localhost/api/v1',
    'https://api.example.invalid/wrong', 'https://api.example.invalid/api/v1?secret=x',
    'https://user:pass@api.example.invalid/api/v1']) assert.throws(() => resolveApiBaseUrl(value, true))
})
