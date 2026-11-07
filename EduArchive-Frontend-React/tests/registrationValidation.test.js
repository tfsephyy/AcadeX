import test from 'node:test'
import assert from 'node:assert/strict'
import { personalRegistrationErrors, academicRegistrationErrors, registrationErrorStep, registrationErrorMessage, buildRegistrationPayload } from '../src/utils/registrationValidation.js'

const faculty = { name: ' Synthetic Faculty ', username: ' synthetic ', id_number: 'MBC2026-12345', email: ' FACULTY@example.invalid ', role: 'faculty', program: 'BSIT', year: '', section: '' }

test('Faculty accepts program without student year/section and submits the lowercase role', () => {
  assert.deepEqual(personalRegistrationErrors(faculty), {})
  assert.deepEqual(academicRegistrationErrors(faculty), {})
  const payload = buildRegistrationPayload(faculty)
  assert.equal(payload.role, 'faculty')
  assert.equal(payload.program, 'BSIT')
  assert.equal(payload.email, 'faculty@example.invalid')
  assert(!('year' in payload))
  assert(!('section' in payload))
  assert(academicRegistrationErrors({ ...faculty, program: '' }).program)
})

test('earlier-step errors remain visible when the server rejects a submission from credentials', () => {
  const errors = { username: ['This username has already been taken.'] }
  assert.equal(registrationErrorStep(errors, 3), 1)
  assert.equal(registrationErrorMessage(errors, 'Validation failed.'), errors.username[0])
  assert.equal(registrationErrorStep({ email: ['Verify your email again.'] }, 3), 2)
  assert.equal(registrationErrorStep({ password: ['Use a stronger password.'] }, 2), 3)
  assert.equal(registrationErrorStep({ registration_challenge: ['Reload to verify.'] }, 3), 3)
})

test('switching from Visitor to Faculty requires an ID while student academic requirements remain intact', () => {
  assert(personalRegistrationErrors({ ...faculty, id_number: '' }).id_number)
  assert.deepEqual(personalRegistrationErrors({ ...faculty, role: 'visitor', id_number: '' }), {})
  const errors = academicRegistrationErrors({ ...faculty, role: 'student' })
  assert(errors.year && errors.section)
})
