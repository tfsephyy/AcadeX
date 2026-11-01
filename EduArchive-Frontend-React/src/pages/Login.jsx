import AuthAside from '../components/AuthAside'
import Brand from '../components/Brand'
import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
import { useTheme } from '../context/useTheme'
import ForgotPasswordModal from '../components/ForgotPasswordModal'
import VerifyAccountEmailModal from '../components/VerifyAccountEmailModal'

/* ── Eye icons ─────────────────────────────────────────────── */
function EyeIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" />
      <circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

/* ── Sun / Moon ─────────────────────────────────────────────── */
function SunIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" /><line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" /><line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" /><line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" /><line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

/* ── Left illustration panel ─────────────────────────────────── */
export default function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(() => {
    const savedEmail = localStorage.getItem('acadex_remember_email') || ''
    return { email: savedEmail, password: '' }
  })
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('acadex_remember_email'))
  const [showPwd, setShowPwd] = useState(false)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
  const [verifyOpen, setVerifyOpen] = useState(false)
  const [shake, setShake] = useState(false)

  // Show registration success message
  useEffect(() => {
    if (location.state?.registered) {
      setSuccessMessage('Account created! An admin will review and activate your account shortly.')
      const timer = setTimeout(() => setSuccessMessage(''), 7000)
      return () => clearTimeout(timer)
    }
  }, [location.state?.registered])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
    setGlobalError('')
  }

  const triggerShake = () => {
    setShake(true)
    setTimeout(() => setShake(false), 500)
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setGlobalError('')

    if (rememberMe) {
      localStorage.setItem('acadex_remember_email', form.email)
    } else {
      localStorage.removeItem('acadex_remember_email')
    }

    try {
      const res = await login(form.email, form.password)
      const role = res?.data?.user?.role
      if (role === 'admin') {
        navigate('/admin/dashboard', { replace: true })
      } else if (role === 'faculty') {
        navigate('/faculty/dashboard', { replace: true })
      } else if (role === 'student') {
        navigate('/student/uploads', { replace: true })
      } else {
        navigate('/dashboard', { replace: true })
      }
    } catch (err) {
      const status = err.response?.status
      const data = err.response?.data
      triggerShake()
      if (status === 423) {
        setGlobalError(data?.message || 'Account unavailable. Contact your administrator.')
        if (data?.email_verification_required) setVerifyOpen(true)
      } else if (data?.errors) {
        setErrors(data.errors)
      } else {
        setGlobalError(data?.message || 'Invalid credentials. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="auth-layout"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Left — illustration */}
      <AuthAside />

      {/* Right — form */}
      <div
        className="auth-form-panel"
        style={{ background: 'var(--color-bg)' }}
      >
        {/* Theme toggle — top right */}
        <button
          className="theme-toggle absolute top-6 right-6"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
        >
          {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
        </button>

        <div
          className="w-full"
          style={{
            maxWidth: 400,
            animation: 'fade-in-up 0.5s ease both',
          }}
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center mb-5"><Brand /></div>

          {/* Heading */}
          <div className="mb-5">
            <h1 className="font-poppins font-bold text-2xl mb-1" style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              Welcome back
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Sign in to your AcadeX account
            </p>
          </div>

          {/* Success banner */}
          {successMessage && (
            <div
              className="mb-4 p-3 rounded-xl animate-fade-in-up"
              style={{
                background: 'rgba(91,190,99,0.08)',
                border: '1px solid rgba(91,190,99,0.3)',
                color: 'var(--color-primary)',
                fontSize: '0.8rem',
              }}
            >
              ✓ {successMessage}
            </div>
          )}

          {/* Error banner */}
          {globalError && (
            <div
              className="mb-4 p-3 rounded-xl animate-fade-in-up"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
                fontSize: '0.8rem',
              }}
            >
              {globalError}
            </div>
          )}

          {/* Form card */}
          <div
            className="glass-card p-5"
            style={{
              animation: shake
                ? 'shake 0.4s ease'
                : 'none',
            }}
          >
            <style>{`
              @keyframes shake {
                0%, 100% { transform: translateX(0); }
                20% { transform: translateX(-8px); }
                40% { transform: translateX(8px); }
                60% { transform: translateX(-5px); }
                80% { transform: translateX(5px); }
              }
            `}</style>

            <form onSubmit={handleSubmit} noValidate>
              {/* Email */}
              <div className="mb-3.5">
                <label
                  htmlFor="email"
                  className="block font-medium mb-1.5"
                  style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
                >
                  Email Address
                </label>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={form.email}
                  onChange={handleChange}
                  className={`input-field ${errors.email ? 'error' : ''}`}
                  placeholder="you@minsu.edu.ph"
                  style={{ padding: '0.55rem 0.875rem', fontSize: '0.875rem' }}
                />
                {errors.email && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.email[0]}</p>
                )}
              </div>

              {/* Password */}
              <div className="mb-3.5">
                <label
                  htmlFor="password"
                  className="block font-medium mb-1.5"
                  style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}
                >
                  Password
                </label>
                <div className="relative">
                  <input
                    id="password"
                    name="password"
                    type={showPwd ? 'text' : 'password'}
                    autoComplete="current-password"
                    required
                    value={form.password}
                    onChange={handleChange}
                    className={`input-field pr-12 ${errors.password ? 'error' : ''}`}
                    placeholder="Enter your password"
                    style={{ padding: '0.55rem 0.875rem', fontSize: '0.875rem' }}
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd(!showPwd)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                    style={{ color: 'var(--color-text-muted)' }}
                    aria-label={showPwd ? 'Hide password' : 'Show password'}
                    onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
                    onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                  >
                    {showPwd ? <EyeOffIcon /> : <EyeIcon />}
                  </button>
                </div>
                {errors.password && (
                  <p className="text-xs mt-1" style={{ color: '#f87171' }}>{errors.password[0]}</p>
                )}
              </div>

              {/* Remember Me & Forgot */}
              <div className="flex items-center justify-between mb-4">
                <label className="flex items-center gap-2.5 cursor-pointer group">
                  <div
                    className="relative w-4 h-4 rounded flex items-center justify-center flex-shrink-0 transition-all duration-200"
                    style={{
                      background: rememberMe ? 'var(--color-primary)' : 'var(--input-bg)',
                      border: `1.5px solid ${rememberMe ? 'var(--color-primary)' : 'var(--input-border)'}`,
                    }}
                  >
                    <input
                      type="checkbox"
                      checked={rememberMe}
                      onChange={(e) => setRememberMe(e.target.checked)}
                      className="absolute inset-0 opacity-0 w-full h-full cursor-pointer"
                      aria-label="Remember me"
                    />
                    {rememberMe && (
                      <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                    )}
                  </div>
                  <span className="text-sm" style={{ color: 'var(--color-text-muted)' }}>Remember me</span>
                </label>

                <button
                  type="button"
                  onClick={() => setForgotOpen(true)}
                  className="text-sm font-medium transition-colors duration-200"
                  style={{ color: 'var(--color-primary)' }}
                  onMouseEnter={e => e.target.style.color = 'var(--color-accent-bright)'}
                  onMouseLeave={e => e.target.style.color = 'var(--color-primary)'}
                >
                  Forgot password?
                </button>
              </div>

              {/* Submit */}
              <button
                type="submit"
                disabled={loading}
                className="btn-primary w-full"
                style={{
                  padding: '0.65rem',
                  fontSize: '0.875rem',
                  opacity: loading ? 0.7 : 1,
                  cursor: loading ? 'not-allowed' : 'pointer',
                }}
              >
                {loading ? (
                  <>
                    <div
                      className="w-4 h-4 rounded-full border-2 border-white border-t-transparent"
                      style={{ animation: 'spin 0.7s linear infinite' }}
                      aria-hidden="true"
                    />
                    Signing in…
                  </>
                ) : (
                  'Sign In'
                )}
              </button>
            </form>

            <p className="mt-4 text-center" style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
              Don't have an account?{' '}
              <Link
                to="/register"
                className="font-semibold transition-colors duration-200"
                style={{ color: 'var(--color-primary)' }}
                onMouseEnter={e => e.target.style.color = 'var(--color-accent-bright)'}
                onMouseLeave={e => e.target.style.color = 'var(--color-primary)'}
              >
                Create one
              </Link>
            </p>
          </div>

          {/* Back to home */}
          <div className="mt-4 text-center">
            <Link
              to="/"
              className="text-xs transition-colors duration-200 inline-flex items-center gap-1.5"
              style={{ color: 'var(--color-text-faint)' }}
              onMouseEnter={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
              onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-faint)'}
            >
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
              Back to AcadeX
            </Link>
          </div>
        </div>
      </div>

      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
      {verifyOpen && <VerifyAccountEmailModal email={form.email} password={form.password}
        onClose={() => setVerifyOpen(false)} onVerified={() => {
          setVerifyOpen(false)
          setSuccessMessage('Email verified. You can sign in once your account is approved.')
          setGlobalError('')
        }} />}
    </div>
  )
}
