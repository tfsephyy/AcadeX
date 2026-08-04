import { useState, useMemo, useEffect, useRef } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { sendVerificationCode, verifyEmailCode } from '../api/admin'

const INITIAL = {
  name: '',
  username: '',
  id_number: '',
  email: '',
  role: 'student',
  program: '',
  year: '',
  section: '',
  password: '',
  password_confirmation: '',
}

function passwordStrength(pwd) {
  let score = 0
  if (pwd.length >= 8) score++
  if (/[A-Z]/.test(pwd)) score++
  if (/[a-z]/.test(pwd)) score++
  if (/\d/.test(pwd)) score++
  if (/[\W_]/.test(pwd)) score++
  return score // 0-5
}

const STRENGTH_LABELS = ['', 'Very Weak', 'Weak', 'Fair', 'Strong', 'Very Strong']
const STRENGTH_COLORS = ['', '#ef4444', '#f97316', '#eab308', '#22c55e', '#8BC34A']

// Common passwords list (local check)
const COMMON_PASSWORDS = [
  'password', 'password1', 'password123', '12345678', '123456789',
  'qwerty123', 'admin123', 'letmein12', 'welcome1', 'iloveyou',
]

export default function Register() {
  const { register } = useAuth()
  const navigate = useNavigate()

  const [form, setForm] = useState(INITIAL)
  const [showPwd, setShowPwd] = useState(false)
  const [showConfirmPwd, setShowConfirmPwd] = useState(false)
  const [errors, setErrors] = useState({})
  const [globalError, setGlobalError] = useState('')
  const [loading, setLoading] = useState(false)

  // Email verification state
  const [emailVerified, setEmailVerified] = useState(false)
  const [emailCode, setEmailCode] = useState('')
  const [emailCodeSent, setEmailCodeSent] = useState(false)
  const [emailSending, setEmailSending] = useState(false)
  const [emailVerifying, setEmailVerifying] = useState(false)
  const [emailError, setEmailError] = useState('')
  const [resendCooldown, setResendCooldown] = useState(0)
  const intervalRef = useRef(null)

  const strength = useMemo(() => passwordStrength(form.password), [form.password])

  // Password validation checks
  const passwordChecks = {
    minLength: form.password.length >= 8,
    hasUpper: /[A-Z]/.test(form.password),
    hasLower: /[a-z]/.test(form.password),
    hasNumber: /\d/.test(form.password),
    notCommon: form.password.length === 0 || !COMMON_PASSWORDS.includes(form.password.toLowerCase()),
  }

  // Resend cooldown timer
  useEffect(() => {
    if (resendCooldown > 0) {
      intervalRef.current = setInterval(() => {
        setResendCooldown(prev => {
          if (prev <= 1) {
            clearInterval(intervalRef.current)
            return 0
          }
          return prev - 1
        })
      }, 1000)
      return () => clearInterval(intervalRef.current)
    }
  }, [resendCooldown])

  useEffect(() => {
    return () => {
      if (intervalRef.current) clearInterval(intervalRef.current)
    }
  }, [])

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
    if (!form.email.trim()) {
      setEmailError('Please enter your email address first.')
      return
    }
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
    if (!emailCode.trim()) {
      setEmailError('Please enter the verification code.')
      return
    }
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

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setGlobalError('')

    // Client-side validation
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
      if (data?.errors) {
        setErrors(data.errors)
      } else {
        setGlobalError(data?.message || 'Registration failed. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  const inputClass =
    'w-full px-4 py-3 rounded-xl bg-white/5 border border-[#2E7D32]/40 text-[#F1F8E9] placeholder-[#6a9f78] focus:outline-none focus:ring-2 focus:ring-[#8BC34A]/50 focus:border-[#8BC34A] transition-all duration-200'

  const selectClass = inputClass + ' appearance-none cursor-pointer'

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #0f2f1b 0%, #1B5E20 60%, #2E7D32 100%)' }}
    >
      <div className="w-full max-w-lg">
        {/* Logo */}
        <div className="text-center mb-8">
          <Link to="/" className="inline-flex items-center gap-2 group">
            <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-[#8BC34A] shadow-md">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-5 h-5 text-[#0f2f1b]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
              </svg>
            </div>
            <span className="font-poppins font-bold text-2xl text-[#F1F8E9]">
              Edu<span className="text-[#8BC34A]">Archive</span>
            </span>
          </Link>
          <p className="text-[#a5d6a7] text-sm mt-2">Create your EduArchive account</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-[#2E7D32]/40 rounded-2xl p-8 shadow-2xl">
          {globalError && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {globalError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Row: Name / Username */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="Full Name" name="name" value={form.name} onChange={handleChange}
                placeholder="Juan Dela Cruz" errors={errors} inputClass={inputClass} />
              <Field label="Username" name="username" value={form.username} onChange={handleChange}
                placeholder="juandc" errors={errors} inputClass={inputClass} />
            </div>

            {/* Row: ID Number / Email with Verification */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Field label="ID Number" name="id_number" value={form.id_number} onChange={handleChange}
                placeholder="MBC2023-*****" errors={errors} inputClass={inputClass} />
              <div>
                <label htmlFor="email" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">
                  Email
                </label>
                <div className="flex items-center gap-2">
                  <input
                    id="email"
                    name="email"
                    type="email"
                    value={form.email}
                    onChange={handleChange}
                    className={(inputClass + (emailVerified ? ' border-[#8BC34A]' : '') + ' min-w-0 flex-1')}
                    placeholder="you@minsu.edu.ph"
                    required
                  />
                  {emailVerified && (
                    <span className="text-[#8BC34A] shrink-0" aria-label="Email verified">
                      <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                    </span>
                  )}
                </div>
                {errors?.email && <p className="text-red-400 text-xs mt-1">{errors.email[0]}</p>}

                {/* Email Verification Flow */}
                {!emailVerified && form.email.trim() && (
                  <div className="mt-2 space-y-2">
                    {!emailCodeSent ? (
                      <button
                        type="button"
                        onClick={handleSendEmailCode}
                        disabled={emailSending}
                        className="text-xs text-[#8BC34A] hover:text-[#a5d6a7] font-medium hover:underline disabled:opacity-50 flex items-center gap-1"
                      >
                        {emailSending ? (
                          <>
                            <div className="w-3 h-3 border border-[#8BC34A] border-t-transparent rounded-full animate-spin" />
                            Sending...
                          </>
                        ) : 'Send Verification Code'}
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
                            className="min-w-0 flex-1 px-3 py-1.5 rounded-lg bg-white/10 border border-[#2E7D32]/60 text-[#F1F8E9] placeholder-[#6a9f78] text-xs font-mono tracking-wider uppercase focus:outline-none focus:ring-1 focus:ring-[#8BC34A]/50"
                          />
                          <button
                            type="button"
                            onClick={handleVerifyEmailCode}
                            disabled={emailVerifying}
                            className="w-28 shrink-0 whitespace-nowrap px-3 py-1.5 bg-[#8BC34A]/20 text-[#8BC34A] text-xs font-medium rounded-lg hover:bg-[#8BC34A]/30 disabled:opacity-50 transition-colors"
                          >
                            {emailVerifying ? 'Verifying...' : 'Verify'}
                          </button>
                        </div>
                        <button
                          type="button"
                          onClick={handleSendEmailCode}
                          disabled={resendCooldown > 0 || emailSending}
                          className="text-[10px] text-[#6a9f78] hover:text-[#8BC34A] disabled:text-[#4a7a58] disabled:cursor-not-allowed transition-colors"
                        >
                          {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : "Didn't receive? Resend"}
                        </button>
                      </div>
                    )}
                  </div>
                )}
                {emailError && <p className="text-red-400 text-xs mt-1">{emailError}</p>}
              </div>
            </div>

            {/* Role */}
            <div>
              <label htmlFor="role" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Role</label>
              <select
                id="role"
                name="role"
                value={form.role}
                onChange={handleChange}
                className={selectClass}
              >
                <option value="student" className="bg-[#1B5E20] text-[#F1F8E9]">Student</option>
                <option value="faculty" className="bg-[#1B5E20] text-[#F1F8E9]">Faculty</option>
              </select>
              {errors.role && <p className="text-red-400 text-xs mt-1">{errors.role[0]}</p>}
            </div>

            {/* Conditional student fields — DROPDOWNS */}
            {form.role === 'student' && (
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 p-4 rounded-xl bg-white/5 border border-[#2E7D32]/30">
                <div>
                  <label htmlFor="program" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Program</label>
                  <select
                    id="program"
                    name="program"
                    value={form.program}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-[#1B5E20] text-[#6a9f78]">Select</option>
                    <option value="BSIT" className="bg-[#1B5E20] text-[#F1F8E9]">BSIT</option>
                    <option value="BSCpE" className="bg-[#1B5E20] text-[#F1F8E9]">BSCpE</option>
                  </select>
                  {errors?.program && <p className="text-red-400 text-xs mt-1">{errors.program[0]}</p>}
                </div>
                <div>
                  <label htmlFor="year" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Year</label>
                  <select
                    id="year"
                    name="year"
                    value={form.year}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-[#1B5E20] text-[#6a9f78]">Select</option>
                    <option value="1" className="bg-[#1B5E20] text-[#F1F8E9]">1</option>
                    <option value="2" className="bg-[#1B5E20] text-[#F1F8E9]">2</option>
                    <option value="3" className="bg-[#1B5E20] text-[#F1F8E9]">3</option>
                    <option value="4" className="bg-[#1B5E20] text-[#F1F8E9]">4</option>
                  </select>
                  {errors?.year && <p className="text-red-400 text-xs mt-1">{errors.year[0]}</p>}
                </div>
                <div>
                  <label htmlFor="section" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Section</label>
                  <select
                    id="section"
                    name="section"
                    value={form.section}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-[#1B5E20] text-[#6a9f78]">Select</option>
                    <option value="1" className="bg-[#1B5E20] text-[#F1F8E9]">1</option>
                    <option value="2" className="bg-[#1B5E20] text-[#F1F8E9]">2</option>
                    <option value="3" className="bg-[#1B5E20] text-[#F1F8E9]">3</option>
                  </select>
                  {errors?.section && <p className="text-red-400 text-xs mt-1">{errors.section[0]}</p>}
                </div>
              </div>
            )}

            {/* Conditional faculty fields */}
            {form.role === 'faculty' && (
              <div className="p-4 rounded-xl bg-white/5 border border-[#2E7D32]/30">
                <div>
                  <label htmlFor="faculty-program" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Program</label>
                  <select
                    id="faculty-program"
                    name="program"
                    value={form.program}
                    onChange={handleChange}
                    className={selectClass}
                    required
                  >
                    <option value="" className="bg-[#1B5E20] text-[#6a9f78]">Select</option>
                    <option value="BSIT" className="bg-[#1B5E20] text-[#F1F8E9]">BSIT</option>
                    <option value="BSCpE" className="bg-[#1B5E20] text-[#F1F8E9]">BSCpE</option>
                  </select>
                  {errors?.program && <p className="text-red-400 text-xs mt-1">{errors.program[0]}</p>}
                </div>
              </div>
            )}

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Password</label>
              <div className="relative">
                <input
                  id="password"
                  name="password"
                  type={showPwd ? 'text' : 'password'}
                  value={form.password}
                  onChange={handleChange}
                  className={inputClass + ' pr-12'}
                  placeholder="Min 8 chars, A-z, 0-9"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowPwd(!showPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a9f78] hover:text-[#8BC34A] transition-colors duration-200"
                  aria-label={showPwd ? 'Hide password' : 'Show password'}
                >
                  {showPwd ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {/* Strength indicator */}
              {form.password.length > 0 && (
                <div className="mt-2 space-y-2">
                  <div className="flex gap-1">
                    {[1, 2, 3, 4, 5].map((i) => (
                      <div
                        key={i}
                        className="h-1.5 flex-1 rounded-full transition-all duration-300"
                        style={{ backgroundColor: i <= strength ? STRENGTH_COLORS[strength] : '#1B5E20' }}
                      />
                    ))}
                  </div>
                  <p className="text-xs" style={{ color: STRENGTH_COLORS[strength] }}>
                    {STRENGTH_LABELS[strength]}
                  </p>
                  {/* Password requirement checks */}
                  <div className="space-y-0.5">
                    <PwdCheck ok={passwordChecks.minLength} label="At least 8 characters" />
                    <PwdCheck ok={passwordChecks.hasUpper} label="One uppercase letter" />
                    <PwdCheck ok={passwordChecks.hasLower} label="One lowercase letter" />
                    <PwdCheck ok={passwordChecks.hasNumber} label="One number" />
                    {!passwordChecks.notCommon && (
                      <p className="text-[10px] text-red-400 flex items-center gap-1">
                        <span>⚠</span> This password is too common
                      </p>
                    )}
                  </div>
                </div>
              )}
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password[0]}</p>}
            </div>

            {/* Confirm Password */}
            <div>
              <label htmlFor="password_confirmation" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">Confirm Password</label>
              <div className="relative">
                <input
                  id="password_confirmation"
                  name="password_confirmation"
                  type={showConfirmPwd ? 'text' : 'password'}
                  value={form.password_confirmation}
                  onChange={handleChange}
                  className={inputClass + ' pr-12'}
                  placeholder="Re-enter password"
                  required
                />
                <button
                  type="button"
                  onClick={() => setShowConfirmPwd(!showConfirmPwd)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-[#6a9f78] hover:text-[#8BC34A] transition-colors duration-200"
                  aria-label={showConfirmPwd ? 'Hide password' : 'Show password'}
                >
                  {showConfirmPwd ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.878 9.878L3 3m6.878 6.878L21 21" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                      <path strokeLinecap="round" strokeLinejoin="round" d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                    </svg>
                  )}
                </button>
              </div>
              {form.password_confirmation.length > 0 && form.password !== form.password_confirmation && (
                <p className="text-red-400 text-xs mt-1">Passwords do not match.</p>
              )}
              {errors?.password_confirmation && <p className="text-red-400 text-xs mt-1">{errors.password_confirmation[0]}</p>}
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading || !emailVerified}
              className="w-full py-3.5 rounded-xl bg-[#2E7D32] text-[#F1F8E9] font-semibold text-sm
                hover:bg-[#388e3c] focus:ring-2 focus:ring-[#8BC34A]/50 shadow-lg shadow-green-900/40
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2 mt-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? 'Creating account…' : 'Create Account'}
            </button>
          </form>

          <p className="mt-6 text-center text-[#a5d6a7] text-sm">
            Already have an account?{' '}
            <Link to="/login" className="text-[#8BC34A] font-medium hover:underline">
              Sign in
            </Link>
          </p>
        </div>

        <p className="text-center text-[#6a9f78] text-xs mt-6">
          © 2026 Mindoro State University. All rights reserved.
        </p>
      </div>
    </div>
  )
}

/* ── Reusable Field component ─────────────────────────── */
function Field({ label, name, type = 'text', value, onChange, placeholder, errors, inputClass, required = true }) {
  return (
    <div>
      <label htmlFor={name} className="block text-[#c8e6c9] text-sm font-medium mb-1.5">
        {label}
      </label>
      <input
        id={name}
        name={name}
        type={type}
        value={value}
        onChange={onChange}
        className={inputClass}
        placeholder={placeholder}
        required={required}
      />
      {errors?.[name] && <p className="text-red-400 text-xs mt-1">{errors[name][0]}</p>}
    </div>
  )
}

function PwdCheck({ ok, label }) {
  return (
    <div className="flex items-center gap-1.5">
      <div className={`w-3 h-3 rounded-full flex items-center justify-center ${ok ? 'bg-[#8BC34A]/20' : 'bg-white/10'}`}>
        {ok ? (
          <svg className="w-2 h-2 text-[#8BC34A]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
          </svg>
        ) : (
          <div className="w-1 h-1 rounded-full bg-[#6a9f78]" />
        )}
      </div>
      <span className={`text-[10px] ${ok ? 'text-[#8BC34A]' : 'text-[#6a9f78]'}`}>{label}</span>
    </div>
  )
}
