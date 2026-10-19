import { useState } from 'react'
import { sendVerificationCode, verifyEmailCode } from '../api/admin'

export default function VerifyAccountEmailModal({ email, password, onClose, onVerified }) {
  const [code, setCode] = useState('')
  const [sent, setSent] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const submit = async (event) => {
    event.preventDefault()
    setBusy(true)
    setError('')
    try {
      if (!sent) {
        await sendVerificationCode(email, { purpose: 'account_verification', current_password: password })
        setSent(true)
      } else {
        await verifyEmailCode({ email, code })
        onVerified()
      }
    } catch (failure) {
      setError(failure.response?.data?.message || 'Email verification failed. Please try again.')
    } finally { setBusy(false) }
  }
  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/60 p-4">
      <form onSubmit={submit} role="dialog" aria-modal="true" aria-labelledby="verify-account-heading"
        className="w-full max-w-md rounded-xl p-6" style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
        <h2 id="verify-account-heading" className="text-xl font-semibold">Verify your email</h2>
        <p className="my-3">Confirm ownership of {email} before signing in. Administrator approval is still required.</p>
        {sent && <input className="input-field" aria-label="Verification code" value={code}
          onChange={event => setCode(event.target.value)} required maxLength={7} autoComplete="one-time-code" />}
        {error && <p role="alert" className="my-3 text-red-500">{error}</p>}
        <div className="mt-4 flex gap-3">
          <button type="submit" disabled={busy} className="btn-primary">{busy ? 'Please wait…' : sent ? 'Verify email' : 'Send code'}</button>
          <button type="button" onClick={onClose} disabled={busy}>Cancel</button>
        </div>
      </form>
    </div>
  )
}
