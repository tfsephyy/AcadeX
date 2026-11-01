import test from 'node:test'
import assert from 'node:assert/strict'
import { unpackList } from '../src/api/listResponse.js'

test('saved capstones retain Laravel pagination while exposing the item array', () => {
  const page = { data: [{ id: 42 }], current_page: 2, last_page: 3, total: 25 }
  assert.deepEqual(unpackList(page).items, [{ id: 42 }])
  assert.equal(unpackList(page).pagination, page)
})
test('plain and empty list responses remain compatible', () => {
  assert.deepEqual(unpackList([{ id: 1 }]), { items: [{ id: 1 }], pagination: null })
  assert.deepEqual(unpackList(null), { items: [], pagination: null })
  assert.deepEqual(unpackList({}), { items: [], pagination: null })
})
