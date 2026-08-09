import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

/* ── Floating metadata card data ─────────────────────────────── */
const SAMPLE_CARDS = [
  {
    title: 'AI-Based Crop Disease Detection Using CNN',
    authors: 'J. Santos, M. Cruz',
    year: '2024',
    tag: 'BSIT',
  },
  {
    title: 'Web-Based Student Portal with Real-Time Notifications',
    authors: 'A. Reyes, K. Lim',
    year: '2023',
    tag: 'BSCpE',
  },
]

/* ── Abstract SVG Illustration ───────────────────────────────── */
function HeroIllustration() {
  return (
    <div className="relative w-full" style={{ maxWidth: 520 }}>
      {/* Main card */}
      <div
        className="rounded-2xl p-6 relative overflow-hidden"
        style={{
          background: 'var(--color-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-lg), var(--shadow-glow)',
        }}
      >
        {/* Mock document header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0"
            style={{ background: 'linear-gradient(135deg, var(--color-primary), var(--color-accent-bright))' }}>
            <svg width="20" height="20" viewBox="0 0 24 24" fill="white" aria-hidden="true">
              <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
              <path d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold mb-0.5" style={{ color: 'var(--color-primary)' }}>PDF Metadata Extracted</p>
            <p className="text-xs" style={{ color: 'var(--color-text-muted)' }}>Automated · Instant · Accurate</p>
          </div>
          <div className="ml-auto">
            <span className="text-xs font-semibold px-2.5 py-1 rounded-full"
              style={{ background: 'rgba(91,190,99,0.12)', color: 'var(--color-primary)', border: '1px solid var(--color-border)' }}>
              Verified
            </span>
          </div>
        </div>

        {/* Metadata rows */}
        {[
          { label: 'Title', value: 'Smart Irrigation System Using IoT and ML', full: true },
          { label: 'Authors', value: 'Dela Cruz, Santos, Reyes' },
          { label: 'Year', value: '2024' },
          { label: 'Program', value: 'BSIT' },
          { label: 'Keywords', value: 'IoT · Machine Learning · Agriculture', full: true },
        ].map((row, i) => (
          <div
            key={row.label}
            className={`mb-3 ${row.full ? '' : 'inline-block mr-4'}`}
          >
            <p className="text-xs mb-0.5 font-medium" style={{ color: 'var(--color-text-muted)' }}>{row.label}</p>
            <div className="h-7 rounded-lg flex items-center px-3 text-xs font-medium"
              style={{
                background: 'var(--color-bg-tertiary)',
                color: 'var(--color-text-secondary)',
                border: '1px solid var(--color-border)',
                animationDelay: `${i * 0.1}s`,
              }}>
              {row.value}
            </div>
          </div>
        ))}

        {/* Progress bar - "Indexing" */}
        <div className="mt-4 pt-4" style={{ borderTop: '1px solid var(--color-border)' }}>
          <div className="flex justify-between text-xs mb-2" style={{ color: 'var(--color-text-muted)' }}>
            <span>Indexing to repository…</span>
            <span style={{ color: 'var(--color-primary)' }}>94%</span>
          </div>
          <div className="h-1.5 rounded-full overflow-hidden" style={{ background: 'var(--color-bg-tertiary)' }}>
            <div className="h-full rounded-full" style={{
              width: '94%',
              background: 'linear-gradient(90deg, var(--color-primary), var(--color-accent-bright))',
            }} />
          </div>
        </div>
      </div>

      {/* Floating card 1 — bottom left */}
      <div
        className="absolute -bottom-6 -left-8 rounded-xl p-3.5 animate-float"
        style={{
          background: 'var(--color-surface)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-md)',
          animationDelay: '0.5s',
          zIndex: 10,
          minWidth: 180,
        }}
      >
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center flex-shrink-0"
            style={{ background: 'rgba(91,190,99,0.15)' }}>
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M22 11.08V12a10 10 0 11-5.93-9.14" /><polyline points="22 4 12 14.01 9 11.01" />
            </svg>
          </div>
          <div>
            <p className="text-xs font-semibold" style={{ color: 'var(--color-text)' }}>OCR Processed</p>
            <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Scanned PDF ready</p>
          </div>
        </div>
      </div>

      {/* Floating card 2 — top right */}
      <div
        className="absolute -top-5 -right-6 rounded-xl p-3 animate-float-delayed"
        style={{
          background: 'var(--color-surface)',
          backdropFilter: 'blur(16px)',
          WebkitBackdropFilter: 'blur(16px)',
          border: '1px solid var(--color-border-strong)',
          boxShadow: 'var(--shadow-md)',
          zIndex: 10,
        }}
      >
        <p className="text-xs font-bold font-poppins" style={{ color: 'var(--color-primary)' }}>1,000+</p>
        <p style={{ fontSize: '0.7rem', color: 'var(--color-text-muted)' }}>Projects Archived</p>
      </div>

      {/* Glow ring */}
      <div className="absolute inset-0 rounded-2xl pointer-events-none animate-glow-pulse" aria-hidden="true" />
    </div>
  )
}

/* ── Animated counter hook ───────────────────────────────────── */
function useCountUp(target, duration = 1800, shouldStart = false) {
  const [count, setCount] = useState(0)
  useEffect(() => {
    if (!shouldStart) return
    let start = 0
    const step = Math.ceil(target / (duration / 16))
    const timer = setInterval(() => {
      start = Math.min(start + step, target)
      setCount(start)
      if (start >= target) clearInterval(timer)
    }, 16)
    return () => clearInterval(timer)
  }, [target, duration, shouldStart])
  return count
}

const STATS = [
  { value: 1000, suffix: '+', label: 'Capstone Projects' },
  { value: 500, suffix: '+', label: 'Students' },
  { value: 50, suffix: '+', label: 'Faculty Members' },
]

function StatsRow({ started }) {
  const counts = [
    useCountUp(STATS[0].value, 1800, started),
    useCountUp(STATS[1].value, 1600, started),
    useCountUp(STATS[2].value, 1400, started),

  ]

  return (
    <div className="flex flex-wrap gap-8 justify-center lg:justify-start mt-12">
      {STATS.map((stat, i) => (
        <div key={stat.label} className="text-center lg:text-left animate-fade-in-up" style={{ animationDelay: `${0.6 + i * 0.1}s` }}>
          <div className="font-poppins font-bold text-3xl" style={{ color: 'var(--color-primary)' }}>
            {counts[i]}{stat.suffix}
          </div>
          <div className="text-xs mt-1 font-medium" style={{ color: 'var(--color-text-muted)' }}>{stat.label}</div>
        </div>
      ))}
    </div>
  )
}

/* ── Main Hero Section ───────────────────────────────────────── */
export default function Hero() {
  const sectionRef = useRef(null)
  const [statsStarted, setStatsStarted] = useState(false)

  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setStatsStarted(true) },
      { threshold: 0.3 }
    )
    if (sectionRef.current) observer.observe(sectionRef.current)
    return () => observer.disconnect()
  }, [])

  return (
    <section
      id="home"
      ref={sectionRef}
      className="relative min-h-screen flex items-center overflow-hidden bg-grid"
      style={{ background: 'var(--gradient-hero)', paddingTop: 80 }}
    >
      {/* Background orbs */}
      <div aria-hidden="true" className="absolute top-[-5%] right-[-10%] w-[700px] h-[700px] rounded-full opacity-20 pointer-events-none animate-blob"
        style={{ background: 'radial-gradient(circle, rgba(91,190,99,0.3) 0%, transparent 70%)', filter: 'blur(60px)' }} />
      <div aria-hidden="true" className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-15 pointer-events-none"
        style={{ background: 'radial-gradient(circle, rgba(27,127,91,0.4) 0%, transparent 70%)', filter: 'blur(80px)' }} />
      <div aria-hidden="true" className="absolute top-[40%] left-[40%] w-[300px] h-[300px] rounded-full opacity-10 pointer-events-none animate-float-slow"
        style={{ background: 'radial-gradient(circle, rgba(91,190,99,0.2) 0%, transparent 70%)', filter: 'blur(40px)' }} />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-20 md:py-28 w-full">
        <div className="flex flex-col lg:flex-row items-center gap-14 lg:gap-20">

          {/* Left — Content */}
          <div className="flex-1 text-center lg:text-left">
            {/* University badge */}
            <div className="hero-badge mb-6 inline-flex animate-fade-in-up" style={{ animationDelay: '0.1s' }}>
              <span className="w-2 h-2 rounded-full animate-pulse" style={{ background: 'var(--color-primary)' }} aria-hidden="true" />
              Mindoro State University
            </div>

            <h1
              className="font-poppins font-bold leading-tight mb-6 animate-fade-in-up"
              style={{
                fontSize: 'clamp(2.25rem, 5vw, 4rem)',
                color: 'var(--color-text)',
                animationDelay: '0.2s',
                letterSpacing: '-0.02em',
              }}
            >
              Preserve. Discover.{' '}
              <span className="text-gradient">Empower</span>
              <br />
              Academic Research.
            </h1>

            <p
              className="text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0 animate-fade-in-up"
              style={{ color: 'var(--color-text-secondary)', animationDelay: '0.35s' }}
            >
              AcadeX is Mindoro State University's centralized repository for securely storing,
              managing, and discovering approved capstone projects with automated PDF metadata extraction.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start animate-fade-in-up" style={{ animationDelay: '0.45s' }}>
              <Link to="/register" className="btn-primary" style={{ padding: '0.9rem 2rem', fontSize: '0.95rem' }}>
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                  <path d="M5 12h14M12 5l7 7-7 7" />
                </svg>
                Get Started
              </Link>
              <a href="#features" className="btn-outline" style={{ padding: '0.9rem 2rem', fontSize: '0.95rem' }}>
                Learn More
              </a>
            </div>

            <StatsRow started={statsStarted} />
          </div>

          {/* Right — Illustration */}
          <div className="flex-1 flex justify-center lg:justify-end w-full animate-fade-in-up" style={{ animationDelay: '0.3s' }}>
            <HeroIllustration />
          </div>

        </div>
      </div>

      {/* Bottom wave divider */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none pointer-events-none" aria-hidden="true">
        <svg viewBox="0 0 1440 70" xmlns="http://www.w3.org/2000/svg" className="w-full" style={{ height: 70, display: 'block' }} preserveAspectRatio="none">
          <path fill="var(--color-bg-secondary)" d="M0,40 C240,80 480,10 720,50 C960,90 1200,20 1440,45 L1440,70 L0,70 Z" />
        </svg>
      </div>
    </section>
  )
}
