const personalFields = ['name', 'username', 'id_number']
const academicFields = ['role', 'email', 'program', 'year', 'section']
const idPattern = /^MBC\d{4}-\d{5}$/

export function personalRegistrationErrors(form) {
  const errors = {}
  if (!form.name.trim()) errors.name = ['Enter your full name.']
  if (!form.username.trim()) errors.username = ['Enter a username.']
  if (form.role !== 'visitor' && !idPattern.test(form.id_number.trim())) {
    errors.id_number = ['Enter an ID number in the format MBC2023-00148.']
  }
  return errors
}

export function academicRegistrationErrors(form) {
  const errors = {}
  if (!['student', 'faculty', 'visitor'].includes(form.role)) errors.role = ['Choose Student, Faculty, or Visitor.']
  if (form.role !== 'visitor' && !['BSIT', 'BSCpE'].includes(form.program)) errors.program = ['Select your program.']
  if (form.role === 'student') {
    if (!form.year) errors.year = ['Select your year.']
    if (!form.section) errors.section = ['Select your section.']
  }
  return errors
}

export function registrationErrorStep(errors, fallbackStep) {
  if (personalFields.some(field => errors[field])) return 1
  if (academicFields.some(field => errors[field])) return 2
  if (errors.password || errors.password_confirmation) return 3
  return fallbackStep
}

export function registrationErrorMessage(errors, fallback) {
  for (const value of Object.values(errors)) {
    const message = Array.isArray(value) ? value.find(item => typeof item === 'string' && item.trim()) : value
    if (typeof message === 'string' && message.trim()) return message
  }
  return fallback
}

export function buildRegistrationPayload(form) {
  const { year, section, program, ...identity } = form
  const payload = { ...identity, name: form.name.trim(), username: form.username.trim(), email: form.email.trim().toLowerCase() }
  if (form.role === 'visitor') delete payload.id_number
  else {
    payload.id_number = form.id_number.trim()
    payload.program = program
    if (form.role === 'student') Object.assign(payload, { year, section })
  }
  return payload
}
