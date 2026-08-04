import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import ForgotPasswordModal from '../components/ForgotPasswordModal'

export default function Login() {
  const { login } = useAuth()
  const navigate = useNavigate()
  const location = useLocation()

  // Remember Me — load saved email on mount
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

  // Show registration success message
  useEffect(() => {
    if (location.state?.registered) {
      setSuccessMessage('Account created successfully! An admin will review and activate your account shortly.')
      const timer = setTimeout(() => setSuccessMessage(''), 6000)
      return () => clearTimeout(timer)
    }
  }, [location.state?.registered])

  const handleChange = (e) => {
    setForm({ ...form, [e.target.name]: e.target.value })
    setErrors({ ...errors, [e.target.name]: '' })
    setGlobalError('')
  }

  const handleSubmit = async (e) => {
    e.preventDefault()
    setLoading(true)
    setErrors({})
    setGlobalError('')

    // Remember Me — save or clear email
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

      // Special banner for pending-approval accounts (HTTP 423)
      if (status === 423) {
        setGlobalError('Your account is pending approval. Please wait for an administrator to activate your access.')
      } else if (data?.errors) {
        setErrors(data.errors)
      } else {
        setGlobalError(data?.message || 'An error occurred. Please try again.')
      }
    } finally {
      setLoading(false)
    }
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center px-4 py-12"
      style={{ background: 'linear-gradient(135deg, #0f2f1b 0%, #1B5E20 60%, #2E7D32 100%)' }}
    >
      <div className="w-full max-w-md">
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
          <p className="text-[#a5d6a7] text-sm mt-2">Sign in to your account</p>
        </div>

        {/* Card */}
        <div className="bg-white/5 backdrop-blur-md border border-[#2E7D32]/40 rounded-2xl p-8 shadow-2xl">
          {globalError && (
            <div className="mb-5 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-400 text-sm text-center">
              {globalError}
            </div>
          )}

          {successMessage && (
            <div className="mb-5 p-3 rounded-xl bg-green-500/10 border border-green-500/30 text-green-400 text-sm text-center">
              {successMessage}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-5">
            {/* Email */}
            <div>
              <label htmlFor="email" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">
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
                className="w-full px-4 py-3 rounded-xl bg-white/5 border border-[#2E7D32]/40 text-[#F1F8E9] placeholder-[#6a9f78]
                  focus:outline-none focus:ring-2 focus:ring-[#8BC34A]/50 focus:border-[#8BC34A] transition-all duration-200"
                placeholder="your.email@gmail.com"
              />
              {errors.email && <p className="text-red-400 text-xs mt-1">{errors.email[0]}</p>}
            </div>

            {/* Password */}
            <div>
              <label htmlFor="password" className="block text-[#c8e6c9] text-sm font-medium mb-1.5">
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
                  className="w-full px-4 py-3 pr-12 rounded-xl bg-white/5 border border-[#2E7D32]/40 text-[#F1F8E9] placeholder-[#6a9f78]
                    focus:outline-none focus:ring-2 focus:ring-[#8BC34A]/50 focus:border-[#8BC34A] transition-all duration-200"
                  placeholder="Enter your password"
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
              {errors.password && <p className="text-red-400 text-xs mt-1">{errors.password[0]}</p>}
            </div>

            {/* Remember Me & Forgot Password */}
            <div className="flex items-center justify-between">
              <label className="flex items-center gap-2 cursor-pointer group">
                <input
                  type="checkbox"
                  checked={rememberMe}
                  onChange={(e) => setRememberMe(e.target.checked)}
                  className="w-4 h-4 rounded border-[#2E7D32] bg-white/5 text-[#8BC34A] focus:ring-[#8BC34A]/50 focus:ring-offset-0 cursor-pointer"
                />
                <span className="text-sm text-[#a5d6a7] group-hover:text-[#c8e6c9] transition-colors">Remember Me</span>
              </label>
              <button
                type="button"
                onClick={() => setForgotOpen(true)}
                className="text-sm text-[#8BC34A] hover:text-[#a5d6a7] font-medium hover:underline transition-colors"
              >
                Forgot Password?
              </button>
            </div>

            {/* Submit */}
            <button
              type="submit"
              disabled={loading}
              className="w-full py-3.5 rounded-xl bg-[#2E7D32] text-[#F1F8E9] font-semibold text-sm
                hover:bg-[#388e3c] focus:ring-2 focus:ring-[#8BC34A]/50 shadow-lg shadow-green-900/40
                transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed
                flex items-center justify-center gap-2"
            >
              {loading && (
                <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
              )}
              {loading ? 'Signing in…' : 'Sign In'}
            </button>
          </form>

          <p className="mt-6 text-center text-[#a5d6a7] text-sm">
            Don&apos;t have an account?{' '}
            <Link to="/register" className="text-[#8BC34A] font-medium hover:underline">
              Create one
            </Link>
          </p>
        </div>

        <p className="text-center text-[#6a9f78] text-xs mt-6">
          © 2026 Mindoro State University. All rights reserved.
        </p>
      </div>

      {/* Forgot Password Modal */}
      <ForgotPasswordModal open={forgotOpen} onClose={() => setForgotOpen(false)} />
    </div>
  )
}
