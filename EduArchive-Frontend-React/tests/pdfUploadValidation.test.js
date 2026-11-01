import test from 'node:test'
import assert from 'node:assert/strict'
import { MAX_CAPSTONE_BYTES, validateCapstonePdf } from '../src/components/pdfUploadValidation.js'

test('PDF selection accepts the exact ceiling and rejects one byte over before sending', () => {
  const file = { name: 'capstone.pdf', type: 'application/pdf', size: MAX_CAPSTONE_BYTES }
  assert.equal(validateCapstonePdf(file), null)
  assert.match(validateCapstonePdf({ ...file, size: file.size + 1 }), /maximum upload size is 128 MiB/)
})
test('PDF selection supports a missing browser MIME type and rejects other files', () => {
  assert.equal(validateCapstonePdf({ name: 'CAPSTONE.PDF', type: '', size: 98 * 1048576 }), null)
  assert.match(validateCapstonePdf({ name: 'file.docx', type: '', size: 120 }), /select a PDF/)
  assert.match(validateCapstonePdf(null), /select a PDF/)
})
