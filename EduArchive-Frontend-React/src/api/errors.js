/**
 * Turn Laravel's validation/error payloads into a message suitable for the
 * upload notification. Prefer the top-level message, then the first field
 * error, so a server upload-limit message is never replaced by a generic one.
 */
export function getApiErrorMessage(error, fallback = 'Something went wrong. Please try again.') {
  const data = error?.response?.data

  if (typeof data === 'string' && data.trim()) return data.trim()

  if (data && typeof data.message === 'string' && data.message.trim()) {
    return data.message.trim()
  }

  const errors = data?.errors
  if (errors && typeof errors === 'object') {
    for (const value of Object.values(errors)) {
      const first = Array.isArray(value) ? value.find(item => typeof item === 'string' && item.trim()) : value
      if (typeof first === 'string' && first.trim()) return first.trim()
    }
  }

  return fallback
}
