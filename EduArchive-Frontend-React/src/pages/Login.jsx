import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ForgotPasswordModal from '../components/ForgotPasswordModal'

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
function LoginIllustration() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between p-12 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-secondary) 50%, var(--color-bg-tertiary) 100%)',
        borderRight: '1px solid var(--color-border)',
        minHeight: '100vh',
        flex: '0 0 45%',
      }}
    >
      {/* Background orbs */}
      <div aria-hidden="true" className="absolute top-[-10%] right-[-20%] w-[400px] h-[400px] rounded-full pointer-events-none animate-blob"
        style={{ background: 'radial-gradient(circle, rgba(91,190,99,0.2) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div aria-hidden="true" className="absolute bottom-[-10%] left-[-15%] w-[350px] h-[350px] rounded-full pointer-events-none animate-float-slow"
        style={{ background: 'radial-gradient(circle, rgba(27,127,91,0.25) 0%, transparent 70%)', filter: 'blur(70px)' }} />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid opacity-40 pointer-events-none" aria-hidden="true" />

      {/* Logo */}
      <div className="relative z-10">
        <Link to="/" className="flex items-center gap-2.5 w-fit group">
          <div style={{
            width: 40, height: 40,
            background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent-bright))',
            borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
            boxShadow: '0 4px 16px rgba(91,190,99,0.3)',
          }}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
            </svg>
          </div>
          <span className="font-poppins font-bold text-2xl" style={{ color: 'var(--color-text)' }}>
            Acade<span style={{ color: 'var(--color-primary)' }}>X</span>
          </span>
        </Link>
      </div>

      {/* Center content */}
      <div className="relative z-10 flex-1 flex flex-col justify-center py-12">
        {/* Central abstract visual */}
        <div className="relative mx-auto" style={{ width: 320, height: 320 }}>
          {/* Rotating outer ring */}
          <div className="absolute inset-0 rounded-full border animate-spin-slow"
            style={{ borderColor: 'rgba(91,190,99,0.15)', borderStyle: 'dashed' }} aria-hidden="true" />

          {/* Inner pulsing circle */}
          <div className="absolute inset-8 rounded-full animate-glow-pulse"
            style={{ background: 'rgba(91,190,99,0.06)', border: '1px solid var(--color-border)' }} aria-hidden="true" />

          {/* Center document icon */}
          <div
            className="absolute inset-0 flex items-center justify-center"
          >
            <div style={{
              width: 96, height: 96,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent-bright))',
              borderRadius: 24,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-strong)',
            }}>
              <svg width="48" height="48" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
              </svg>
            </div>
          </div>

          {/* Orbiting badges */}
          {[
            { label: 'PDF Extract', icon: '📄', angle: 0, delay: '0s' },
            { label: 'OCR', icon: '🔍', angle: 90, delay: '0.5s' },
            { label: 'NLP', icon: '🧠', angle: 180, delay: '1s' },
            { label: 'Secure', icon: '🔒', angle: 270, delay: '1.5s' },
          ].map(({ label, icon, angle, delay }) => {
            const rad = (angle * Math.PI) / 180
            const r = 140
            const x = Math.cos(rad) * r
            const y = Math.sin(rad) * r
            return (
              <div
                key={label}
                className="absolute flex items-center gap-1.5 px-2.5 py-1.5 rounded-xl text-xs font-semibold animate-float"
                style={{
                  left: `calc(50% + ${x}px - 44px)`,
                  top: `calc(50% + ${y}px - 16px)`,
                  background: 'var(--color-surface)',
                  backdropFilter: 'blur(12px)',
                  border: '1px solid var(--color-border-strong)',
                  color: 'var(--color-text)',
                  boxShadow: 'var(--shadow-sm)',
                  animationDelay: delay,
                  whiteSpace: 'nowrap',
                }}
              >
                <span>{icon}</span>
                <span>{label}</span>
              </div>
            )
          })}
        </div>

        {/* Description */}
        <div className="text-center mt-8">
          <h2 className="font-poppins font-bold text-2xl mb-3" style={{ color: 'var(--color-text)' }}>
            Academic Research,{' '}
            <span className="text-gradient">Reimagined</span>
          </h2>
          <p className="text-sm leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--color-text-muted)' }}>
            Access thousands of capstone projects from Mindoro State University in one centralized, intelligent repository.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex justify-center gap-8 mt-8">
          {[['1,000+', 'Projects'], ['500+', 'Students'], ['50+', 'Faculty']].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="font-poppins font-bold text-xl" style={{ color: 'var(--color-primary)' }}>{val}</div>
              <div className="text-xs" style={{ color: 'var(--color-text-muted)' }}>{label}</div>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom MinSU branding */}
      <div className="relative z-10">
        <p className="text-xs" style={{ color: 'var(--color-text-faint)' }}>
          © {new Date().getFullYear()} Mindoro State University
        </p>
      </div>
    </div>
  )
}

/* ── Main Login Page ─────────────────────────────────────────── */
export default function Login() {
  const { login } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()
  const location = useLocation()

  const [form, setForm] = useState(() => {
    const savedEmail = localStorage.getItem('eduarchive_remember_email') || ''
    return { email: savedEmail, password: '' }
  })
  const [rememberMe, setRememberMe] = useState(() => !!localStorage.getItem('eduarchive_remember_email'))
  const [showPwd, setShowPwd] = useState(false)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [successMessage, setSuccessMessage] = useState('')
  const [loading, setLoading] = useState(false)
  const [forgotOpen, setForgotOpen] = useState(false)
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
      localStorage.setItem('eduarchive_remember_email', form.email)
    } else {
      localStorage.removeItem('eduarchive_remember_email')
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
        setGlobalError('Your account is pending approval. Please wait for an administrator to activate your access.')
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
      className="min-h-screen flex"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Left — illustration */}
      <LoginIllustration />

      {/* Right — form */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-12 min-h-screen relative"
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
            maxWidth: 420,
            animation: 'fade-in-up 0.5s ease both',
          }}
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-8">
            <div style={{
              width: 38, height: 38,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent-bright))',
              borderRadius: 12, display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: '0 4px 16px rgba(91,190,99,0.3)',
            }}>
              <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
              </svg>
            </div>
            <span className="font-poppins font-bold text-2xl" style={{ color: 'var(--color-text)' }}>
              Acade<span style={{ color: 'var(--color-primary)' }}>X</span>
            </span>
          </div>

          {/* Heading */}
          <div className="mb-8">
            <h1 className="font-poppins font-bold text-3xl mb-2" style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              Welcome back
            </h1>
            <p className="text-sm" style={{ color: 'var(--color-text-muted)' }}>
              Sign in to your AcadeX account
            </p>
          </div>

          {/* Success banner */}
          {successMessage && (
            <div
              className="mb-6 p-4 rounded-xl text-sm animate-fade-in-up"
              style={{
                background: 'rgba(91,190,99,0.08)',
                border: '1px solid rgba(91,190,99,0.3)',
                color: 'var(--color-primary)',
              }}
            >
              ✓ {successMessage}
            </div>
          )}

          {/* Error banner */}
          {globalError && (
            <div
              className="mb-6 p-4 rounded-xl text-sm animate-fade-in-up"
              style={{
                background: 'rgba(239,68,68,0.08)',
                border: '1px solid rgba(239,68,68,0.3)',
                color: '#f87171',
              }}
            >
              {globalError}
            </div>
          )}

          {/* Form card */}
          <div
            className="glass-card p-8"
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
              <div className="mb-5">
                <label
                  htmlFor="email"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
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
                />
                {errors.email && (
                  <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.email[0]}</p>
                )}
              </div>

              {/* Password */}
              <div className="mb-5">
                <label
                  htmlFor="password"
                  className="block text-sm font-medium mb-2"
                  style={{ color: 'var(--color-text-secondary)' }}
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
                  <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.password[0]}</p>
                )}
              </div>

              {/* Remember Me & Forgot */}
              <div className="flex items-center justify-between mb-6">
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
                  padding: '0.9rem',
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

            <p className="mt-6 text-center text-sm" style={{ color: 'var(--color-text-muted)' }}>
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
          <div className="mt-6 text-center">
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
    </div>
  )
}
