import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { sendVerificationCode, verifyEmailCode } from '../api/admin'

/* ─── Constants ──────────────────────────────────────────────── */
const INITIAL = {
  name: '', username: '', id_number: '', email: '',
  role: 'student', program: '', year: '', section: '',
  password: '', password_confirmation: '',
}

const VISITOR_ROLE = 'visitor'

function passwordStrength(pwd) {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[\W_]/.test(pwd)) score++
  return score
}

const STRENGTH_LABELS = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#5BBE63']

const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'admin123', 'letmein12', 'welcome1', 'iloveyou',
]

/* ─── Step definitions ───────────────────────────────────────── */
const STEPS = [
  { id: 1, label: 'Personal', sublabel: 'Your identity' },
  { id: 2, label: 'Academic', sublabel: 'Your role' },
  { id: 3, label: 'Credentials', sublabel: 'Password' },
]

/* ─── Icons ──────────────────────────────────────────────────── */
function EyeIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z" /><circle cx="12" cy="12" r="3" />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M17.94 17.94A10.07 10.07 0 0112 20c-7 0-11-8-11-8a18.45 18.45 0 015.06-5.94M9.9 4.24A9.12 9.12 0 0112 4c7 0 11 8 11 8a18.5 18.5 0 01-2.16 3.19m-6.72-1.07a3 3 0 11-4.24-4.24" />
      <line x1="1" y1="1" x2="23" y2="23" />
    </svg>
  )
}

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

/* ─── Reusable Field ─────────────────────────────────────────── */
function Field({ label, name, type = 'text', value, onChange, placeholder, error, required = true, autoComplete }) {
  return (
    <div>
      <label htmlFor={name} className="block font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
        {label} {required && <span style={{ color: 'var(--color-primary)' }}>*</span>}
      </label>
      <input
        id={name} name={name} type={type} value={value} onChange={onChange}
        placeholder={placeholder} required={required} autoComplete={autoComplete}
        className={`input-field ${error ? 'error' : ''}`}
        style={{ padding: '0.55rem 0.875rem', fontSize: '0.875rem' }}
      />
      {error && <p className="text-xs mt-1" style={{ color: '#f87171' }}>{error[0]}</p>}
    </div>
  )
}

/* ─── Password check item ────────────────────────────────────── */
function PwdCheck({ ok, label }) {
  return (
    <div className="flex items-center gap-2">
      <div
        className="w-4 h-4 rounded-full flex items-center justify-center flex-shrink-0 transition-all duration-200"
        style={{
          background: ok ? 'rgba(91,190,99,0.15)' : 'var(--color-bg-tertiary)',
          border: `1.5px solid ${ok ? 'rgba(91,190,99,0.5)' : 'var(--color-border)'}`,
        }}
      >
        {ok && (
          <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="3.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <polyline points="20 6 9 17 4 12" />
          </svg>
        )}
      </div>
      <span className="text-xs transition-colors duration-200" style={{ color: ok ? 'var(--color-primary)' : 'var(--color-text-faint)' }}>
        {label}
      </span>
    </div>
  )
}

/* ─── Step Progress ──────────────────────────────────────────── */
function StepProgress({ currentStep }) {
  return (
    <div className="flex items-center mb-5">
      {STEPS.map((step, i) => (
        <div key={step.id} className="flex items-center" style={{ flex: i < STEPS.length - 1 ? 1 : 0 }}>
          {/* Step dot */}
          <div className="flex flex-col items-center">
            <div
              className={`step-dot ${currentStep === step.id ? 'active' : currentStep > step.id ? 'completed' : ''}`}
            >
              {currentStep > step.id ? (
                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="white" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <polyline points="20 6 9 17 4 12" />
                </svg>
              ) : (
                step.id
              )}
            </div>
            <div className="mt-1 text-center" style={{ minWidth: 52 }}>
              <p className="font-semibold" style={{ color: currentStep >= step.id ? 'var(--color-text)' : 'var(--color-text-faint)', fontSize: '0.7rem' }}>
                {step.label}
              </p>
            </div>
          </div>

          {/* Connector line */}
          {i < STEPS.length - 1 && (
            <div
              className={`step-line mb-5 ${currentStep > step.id ? 'completed' : ''}`}
              style={{ margin: '0 6px', marginBottom: 16 }}
            />
          )}
        </div>
      ))}
    </div>
  )
}

/* ─── Left illustration panel (Register) ─────────────────────── */
function RegisterIllustration() {
  return (
    <div
      className="hidden lg:flex flex-col justify-between p-8 relative overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, var(--color-bg) 0%, var(--color-bg-secondary) 50%, var(--color-bg-tertiary) 100%)',
        borderRight: '1px solid var(--color-border)',
        minHeight: '100vh',
        flex: '0 0 40%',
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
      <div className="relative z-10 flex-1 flex flex-col justify-center py-6">
        {/* Central abstract visual */}
        <div className="relative mx-auto" style={{ width: 240, height: 240 }}>
          {/* Rotating outer ring */}
          <div className="absolute inset-0 rounded-full border animate-spin-slow"
            style={{ borderColor: 'rgba(91,190,99,0.15)', borderStyle: 'dashed' }} aria-hidden="true" />

          {/* Inner pulsing circle */}
          <div className="absolute inset-8 rounded-full animate-glow-pulse"
            style={{ background: 'rgba(91,190,99,0.06)', border: '1px solid var(--color-border)' }} aria-hidden="true" />

          {/* Center icon */}
          <div className="absolute inset-0 flex items-center justify-center">
            <div style={{
              width: 72, height: 72,
              background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent-bright))',
              borderRadius: 18,
              display: 'flex', alignItems: 'center', justifyContent: 'center',
              boxShadow: 'var(--shadow-glow-strong)',
            }}>
              <svg width="36" height="36" viewBox="0 0 24 24" fill="white" aria-hidden="true">
                <path d="M15 12c2.21 0 4-1.79 4-4s-1.79-4-4-4-4 1.79-4 4 1.79 4 4 4zm-9-2V7H4v3H1v2h3v3h2v-3h3v-2H6zm9 4c-2.67 0-8 1.34-8 4v2h16v-2c0-2.66-5.33-4-8-4z" />
              </svg>
            </div>
          </div>

          {/* Orbiting badges */}
          {[
            { label: 'Research', icon: '📚', angle: 0, delay: '0s' },
            { label: 'Capstone', icon: '🎓', angle: 90, delay: '0.5s' },
            { label: 'Collaborate', icon: '🤝', angle: 180, delay: '1s' },
            { label: 'Secure', icon: '🔒', angle: 270, delay: '1.5s' },
          ].map(({ label, icon, angle, delay }) => {
            const rad = (angle * Math.PI) / 180
            const r = 100
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
        <div className="text-center mt-5">
          <h2 className="font-poppins font-bold text-lg mb-2" style={{ color: 'var(--color-text)' }}>
            Join the{' '}
            <span className="text-gradient">Community</span>
          </h2>
          <p className="leading-relaxed max-w-xs mx-auto" style={{ color: 'var(--color-text-muted)', fontSize: '0.78rem' }}>
            Create your AcadeX account and gain access to thousands of capstone projects from Mindoro State University.
          </p>
        </div>

        {/* Stats strip */}
        <div className="flex justify-center gap-6 mt-5">
          {[['1,000+', 'Projects'], ['500+', 'Students'], ['50+', 'Faculty']].map(([val, label]) => (
            <div key={label} className="text-center">
              <div className="font-poppins font-bold text-base" style={{ color: 'var(--color-primary)' }}>{val}</div>
              <div style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>{label}</div>
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

/* ─── Main Register Component ─────────────────────────────────── */
export default function Register() {
  const { register } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const navigate = useNavigate()

  const [step, setStep] = useState(1)
  const [form, setForm] = useState(INITIAL)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)

  // Email verification
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailVerifying, setEmailVerifying] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const intervalRef = useRef(null)

  const strength = useMemo(() => passwordStrength(form.password), [form.password])

  const passwordChecks = {
    minLength: form.password.length >= 8,
    hasUpper: /[A-Z]/.test(form.password),
    hasLower: /[a-z]/.test(form.password),
    hasNumber: /\d/.test(form.password),
    notCommon: form.password.length === 0 || !COMMON_PASSWORDS.includes(form.password.toLowerCase()),
  }

  // Resend cooldown
  useEffect(() => {
    if (resendCooldown > 0) {
      intervalRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) { clearInterval(intervalRef.current); return 0 }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(intervalRef.current)
    }
  }, [resendCooldown])

  useEffect(() => () => { if (intervalRef.current) clearInterval(intervalRef.current) }, [])

  // Reset email verification when email changes
  useEffect(() => {
    setEmailVerified(false)
    setEmailCodeSent(false)
    setEmailCode('')
    setEmailError('')
  }, [form.email])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
    setGlobalError('')
  }

  const handleSendEmailCode = async () => {
    if (!form.email.trim()) { setEmailError('Please enter your email address first.'); return }
    setEmailSending(true)
    setEmailError('')
    try {
      await sendVerificationCode(form.email.toLowerCase())
      setEmailCodeSent(true)
      setResendCooldown(60)
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Failed to send verification code.')
    } finally {
      setEmailSending(false)
    }
  }

  const handleVerifyEmailCode = async () => {
    if (!emailCode.trim()) { setEmailError('Please enter the verification code.'); return }
    setEmailVerifying(true)
    setEmailError('')
    try {
      await verifyEmailCode({ email: form.email.toLowerCase(), code: emailCode })
      setEmailVerified(true)
      setEmailError('')
    } catch (err) {
      setEmailError(err.response?.data?.message || 'Invalid or expired code.')
    } finally {
      setEmailVerifying(false)
    }
  }

  /* Step navigation */
  const isVisitor = form.role === VISITOR_ROLE
  const canProceedStep1 = form.name.trim() && form.username.trim() && (isVisitor || form.id_number.trim())
  const canProceedStep2 = form.role && emailVerified &&
    (isVisitor || (form.program && (form.role === 'faculty' || (form.year && form.section))))

  const nextStep = () => {
    if (step === 1 && !canProceedStep1) {
      setGlobalError('Please fill in all personal information fields.')
      return
    }
    if (step === 2 && !canProceedStep2) {
      if (!emailVerified) setGlobalError('Please verify your email address first.')
      else setGlobalError('Please complete all academic information.')
      return
    }
    setGlobalError('')
    setStep(s => Math.min(s + 1, 3))
  }

  const prevStep = () => {
    setGlobalError('')
    setStep(s => Math.max(s - 1, 1))
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setGlobalError('')

    if (!emailVerified) {
      setGlobalError('Please verify your email address first.')
      setLoading(false)
      return
    }
    if (!Object.values(passwordChecks).every(Boolean)) {
      setGlobalError('Please meet all password requirements.')
      setLoading(false)
      return
    }
    if (form.password !== form.password_confirmation) {
      setGlobalError('Passwords do not match.')
      setLoading(false)
      return
    }

    try {
      await register({ ...form, email: form.email.toLowerCase() })
      navigate('/login', { replace: true, state: { registered: true } })
    } catch (err) {
      const data = err.response?.data
      if (data?.errors) { setErrors(data.errors) }
      else { setGlobalError(data?.message || 'Registration failed. Please try again.') }
    } finally {
      setLoading(false)
    }
  }

  const selectClass = 'input-field appearance-none cursor-pointer'

  return (
    <div
      className="h-screen flex overflow-hidden"
      style={{ background: 'var(--color-bg)' }}
    >
      {/* Left — illustration */}
      <RegisterIllustration />

      {/* Right — form */}
      <div
        className="flex-1 flex flex-col items-center justify-center px-6 py-4 h-screen relative overflow-y-auto"
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
            maxWidth: 460,
            animation: 'fade-in-up 0.5s ease both',
          }}
        >
          {/* Mobile logo */}
          <div className="flex lg:hidden items-center justify-center gap-2.5 mb-5">
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
          <div className="mb-4">
            <h1 className="font-poppins font-bold text-xl mb-1" style={{ color: 'var(--color-text)', letterSpacing: '-0.02em' }}>
              Create your account
            </h1>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>
              Join the Mindoro State University research repository
            </p>
          </div>

        {/* Card */}
        <div className="glass-card p-5">

          {/* Step progress */}
          <StepProgress currentStep={step} />

          {/* Step label */}
          <div className="mb-3">
            <h2 className="font-poppins font-semibold text-sm" style={{ color: 'var(--color-text)' }}>
              {step === 1 && 'Personal Information'}
              {step === 2 && (isVisitor ? 'Account Role & Email' : 'Academic Information')}
              {step === 3 && 'Set Password'}
            </h2>
            <p className="mt-0.5" style={{ color: 'var(--color-text-muted)', fontSize: '0.75rem' }}>
              {step === 1 && 'Tell us about yourself'}
              {step === 2 && (isVisitor ? 'Verify your email to continue' : 'Your role and program at MinSU')}
              {step === 3 && 'Choose a strong password to secure your account'}
            </p>
          </div>

          {/* Global error */}
          {globalError && (
            <div
              className="mb-3 p-3 rounded-xl animate-fade-in-up"
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

          <form onSubmit={handleSubmit} noValidate>

            {/* ── STEP 1: Personal Information ─── */}
            {step === 1 && (
              <div className="space-y-3 animate-fade-in">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <Field label="Full Name" name="name" value={form.name} onChange={handleChange}
                    placeholder="Juan Dela Cruz" error={errors.name} autoComplete="name" />
                  <Field label="Username" name="username" value={form.username} onChange={handleChange}
                    placeholder="juandc" error={errors.username} autoComplete="username" />
                </div>
                {!isVisitor && (
                  <Field label="ID Number" name="id_number" value={form.id_number} onChange={handleChange}
                    placeholder="MBC2023-*****" error={errors.id_number} />
                )}
              </div>
            )}

            {/* ── STEP 2: Academic Information ─── */}
            {step === 2 && (
              <div className="space-y-3 animate-fade-in">
                {/* Role */}
                <div>
                  <label htmlFor="role" className="block font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                    Role <span style={{ color: 'var(--color-primary)' }}>*</span>
                  </label>
                  <div className="grid grid-cols-3 gap-3">
                    {[
                      { value: 'student', label: '🎓 Student' },
                      { value: 'faculty', label: '👨‍🏫 Faculty' },
                      { value: 'visitor', label: '🌐 Visitor' },
                    ].map(({ value: r, label }) => (
                      <button
                        key={r}
                        type="button"
                        onClick={() => setForm({ ...form, role: r, program: '', year: '', section: '', id_number: r === 'visitor' ? '' : form.id_number })}
                        className="py-3 px-2 rounded-xl text-sm font-semibold transition-all duration-200 capitalize"
                        style={{
                          background: form.role === r ? 'var(--color-primary)' : 'var(--input-bg)',
                          color: form.role === r ? 'white' : 'var(--color-text-muted)',
                          border: `1.5px solid ${form.role === r ? 'var(--color-primary)' : 'var(--input-border)'}`,
                          boxShadow: form.role === r ? '0 4px 15px rgba(91,190,99,0.25)' : 'none',
                        }}
                      >
                        {label}
                      </button>
                    ))}
                  </div>
                  {isVisitor && (
                    <p className="mt-2 text-xs" style={{ color: 'var(--color-text-faint)' }}>
                      Visitors can browse published research. No ID number or program required.
                    </p>
                  )}
                </div>

                {/* Email + verification */}
                <div>
                  <label htmlFor="email" className="block font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                    Email Address <span style={{ color: 'var(--color-primary)' }}>*</span>
                  </label>
                  <div className="flex gap-2">
                    <input
                      id="email" name="email" type="email" value={form.email} onChange={handleChange}
                      placeholder="you@minsu.edu.ph" required
                      className={`input-field flex-1 min-w-0 ${emailVerified ? '' : ''} ${errors.email ? 'error' : ''}`}
                      style={{ borderColor: emailVerified ? 'var(--color-primary)' : undefined }}
                    />
                    {emailVerified && (
                      <div
                        className="flex-shrink-0 w-10 h-10 rounded-xl flex items-center justify-center"
                        style={{ background: 'rgba(91,190,99,0.12)', border: '1px solid rgba(91,190,99,0.3)' }}
                        aria-label="Email verified"
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                          <polyline points="20 6 9 17 4 12" />
                        </svg>
                      </div>
                    )}
                  </div>
                  {errors.email && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.email[0]}</p>}

                  {/* Verification flow */}
                  {!emailVerified && form.email.trim() && (
                    <div className="mt-3 space-y-2">
                      {!emailCodeSent ? (
                        <button
                          type="button"
                          onClick={handleSendEmailCode}
                          disabled={emailSending}
                          className="text-xs font-semibold flex items-center gap-1.5 transition-colors duration-200"
                          style={{ color: 'var(--color-primary)', opacity: emailSending ? 0.6 : 1 }}
                        >
                          {emailSending ? (
                            <>
                              <div className="w-3 h-3 rounded-full border-2 border-current border-t-transparent" style={{ animation: 'spin 0.7s linear infinite' }} />
                              Sending…
                            </>
                          ) : '→ Send verification code'}
                        </button>
                      ) : (
                        <div className="space-y-2">
                          <div className="flex gap-2">
                            <input
                              type="text"
                              value={emailCode}
                              onChange={(e) => setEmailCode(e.target.value.toUpperCase())}
                              placeholder="Enter code"
                              maxLength={7}
                              className="input-field flex-1 min-w-0 font-mono tracking-wider text-sm"
                              style={{ padding: '0.6rem 0.875rem' }}
                            />
                            <button
                              type="button"
                              onClick={handleVerifyEmailCode}
                              disabled={emailVerifying}
                              className="btn-primary flex-shrink-0 whitespace-nowrap"
                              style={{ padding: '0.6rem 1rem', fontSize: '0.8rem', opacity: emailVerifying ? 0.7 : 1 }}
                            >
                              {emailVerifying ? (
                                <div className="w-3.5 h-3.5 rounded-full border-2 border-white border-t-transparent" style={{ animation: 'spin 0.7s linear infinite' }} />
                              ) : 'Verify'}
                            </button>
                          </div>
                          <button
                            type="button"
                            onClick={handleSendEmailCode}
                            disabled={resendCooldown > 0 || emailSending}
                            className="text-xs transition-colors duration-200"
                            style={{
                              color: resendCooldown > 0 ? 'var(--color-text-faint)' : 'var(--color-text-muted)',
                              cursor: resendCooldown > 0 ? 'not-allowed' : 'pointer',
                            }}
                          >
                            {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive? Resend"}
                          </button>
                        </div>
                      )}
                    </div>
                  )}
                  {emailError && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{emailError}</p>}
                </div>

                {/* Program, Year, Section — hidden for visitors */}
                {!isVisitor && (
                  <>
                    {/* Program */}
                    <div>
                      <label htmlFor="program" className="block font-medium mb-1.5" style={{ color: 'var(--color-text-secondary)', fontSize: '0.8rem' }}>
                        Program <span style={{ color: 'var(--color-primary)' }}>*</span>
                      </label>
                      <select
                        id="program" name="program" value={form.program} onChange={handleChange}
                        className={selectClass} required
                      >
                        <option value="">Select program</option>
                        <option value="BSIT">BSIT — BS Information Technology</option>
                        <option value="BSCpE">BSCpE — BS Computer Engineering</option>
                      </select>
                      {errors.program && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.program[0]}</p>}
                    </div>

                    {/* Year + Section (students only) */}
                    {form.role === 'student' && (
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <label htmlFor="year" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Year <span style={{ color: 'var(--color-primary)' }}>*</span>
                          </label>
                          <select id="year" name="year" value={form.year} onChange={handleChange} className={selectClass} required>
                            <option value="">Year</option>
                            {[1, 2, 3, 4].map(y => <option key={y} value={y}>{y}</option>)}
                          </select>
                          {errors.year && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.year[0]}</p>}
                        </div>
                        <div>
                          <label htmlFor="section" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                            Section <span style={{ color: 'var(--color-primary)' }}>*</span>
                          </label>
                          <select id="section" name="section" value={form.section} onChange={handleChange} className={selectClass} required>
                            <option value="">Section</option>
                            {[1, 2, 3].map(s => <option key={s} value={s}>{s}</option>)}
                          </select>
                          {errors.section && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.section[0]}</p>}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* ── STEP 3: Credentials ─── */}
            {step === 3 && (
              <div className="space-y-3 animate-fade-in">
                {/* Password */}
                <div>
                  <label htmlFor="password" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Password <span style={{ color: 'var(--color-primary)' }}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password" name="password" type={showPwd ? 'text' : 'password'}
                      value={form.password} onChange={handleChange}
                      className={`input-field pr-12 ${errors.password ? 'error' : ''}`}
                      placeholder="Min 8 chars, uppercase, number"
                      required autoComplete="new-password"
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

                  {/* Strength meter */}
                  {form.password.length > 0 && (
                    <div className="mt-3 space-y-3">
                      <div>
                        <div className="flex gap-1 mb-1">
                          {[1, 2, 3, 4, 5].map(i => (
                            <div
                              key={i}
                              className="h-1.5 flex-1 rounded-full transition-all duration-300"
                              style={{ background: i <= strength ? STRENGTH_COLORS[strength] : 'var(--color-bg-tertiary)' }}
                            />
                          ))}
                        </div>
                        <p className="text-xs font-medium" style={{ color: STRENGTH_COLORS[strength] }}>
                          {STRENGTH_LABELS[strength]}
                        </p>
                      </div>
                      <div className="grid grid-cols-2 gap-1.5">
                        <PwdCheck ok={passwordChecks.minLength} label="At least 8 characters" />
                        <PwdCheck ok={passwordChecks.hasUpper} label="One uppercase letter" />
                        <PwdCheck ok={passwordChecks.hasLower} label="One lowercase letter" />
                        <PwdCheck ok={passwordChecks.hasNumber} label="One number" />
                      </div>
                      {!passwordChecks.notCommon && (
                        <p className="text-xs flex items-center gap-1.5" style={{ color: '#f87171' }}>
                          <span>⚠</span> This password is too common
                        </p>
                      )}
                    </div>
                  )}
                  {errors.password && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.password[0]}</p>}
                </div>

                {/* Confirm password */}
                <div>
                  <label htmlFor="password_confirmation" className="block text-sm font-medium mb-2" style={{ color: 'var(--color-text-secondary)' }}>
                    Confirm Password <span style={{ color: 'var(--color-primary)' }}>*</span>
                  </label>
                  <div className="relative">
                    <input
                      id="password_confirmation" name="password_confirmation"
                      type={showConfirmPwd ? 'text' : 'password'}
                      value={form.password_confirmation} onChange={handleChange}
                      className={`input-field pr-12 ${
                        form.password_confirmation && form.password !== form.password_confirmation ? 'error' : ''
                      }`}
                      placeholder="Re-enter password"
                      required autoComplete="new-password"
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 transition-colors duration-200"
                      style={{ color: 'var(--color-text-muted)' }}
                      aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                      onMouseEnter={e => e.currentTarget.style.color = 'var(--color-primary)'}
                      onMouseLeave={e => e.currentTarget.style.color = 'var(--color-text-muted)'}
                    >
                      {showConfirmPwd ? <EyeOffIcon /> : <EyeIcon />}
                    </button>
                  </div>
                  {form.password_confirmation.length > 0 && form.password !== form.password_confirmation && (
                    <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>Passwords do not match.</p>
                  )}
                  {form.password_confirmation.length > 0 && form.password === form.password_confirmation && form.password.length >= 8 && (
                    <p className="text-xs mt-1.5 flex items-center gap-1.5" style={{ color: 'var(--color-primary)' }}>
                      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                        <polyline points="20 6 9 17 4 12" />
                      </svg>
                      Passwords match
                    </p>
                  )}
                  {errors.password_confirmation && <p className="text-xs mt-1.5" style={{ color: '#f87171' }}>{errors.password_confirmation[0]}</p>}
                </div>
              </div>
            )}

            {/* Navigation buttons */}
            <div className="flex gap-3 mt-5">
              {step > 1 && (
                <button
                  type="button"
                  onClick={prevStep}
                  className="btn-outline flex-1"
                  style={{ padding: '0.6rem', fontSize: '0.875rem' }}
                >
                  ← Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={nextStep}
                  className="btn-primary flex-1"
                  style={{ padding: '0.6rem', fontSize: '0.875rem' }}
                >
                  Continue →
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={loading || !emailVerified}
                  className="btn-primary flex-1"
                  style={{
                    padding: '0.6rem',
                    fontSize: '0.875rem',
                    opacity: (loading || !emailVerified) ? 0.65 : 1,
                    cursor: (loading || !emailVerified) ? 'not-allowed' : 'pointer',
                  }}
                >
                  {loading ? (
                    <>
                      <div className="w-4 h-4 rounded-full border-2 border-white border-t-transparent" style={{ animation: 'spin 0.7s linear infinite' }} />
                      Creating account…
                    </>
                  ) : '✓ Create Account'}
                </button>
              )}
            </div>
          </form>

          <p className="mt-4 text-center" style={{ color: 'var(--color-text-muted)', fontSize: '0.8rem' }}>
            Already have an account?{' '}
            <Link
              to="/login"
              className="font-semibold transition-colors duration-200"
              style={{ color: 'var(--color-primary)' }}
              onMouseEnter={e => e.target.style.color = 'var(--color-accent-bright)'}
              onMouseLeave={e => e.target.style.color = 'var(--color-primary)'}
            >
              Sign in
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
    </div>
  )
}
