import { useEffect, useRef, useState } from 'react'

/* ── Scroll Reveal Hook ────────────────────────────────────── */
function useScrollReveal(threshold = 0.15) {
  const ref = useRef(null)
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const observer = new IntersectionObserver(
      ([entry]) => { if (entry.isIntersecting) setVisible(true) },
      { threshold }
    )
    if (ref.current) observer.observe(ref.current)
    return () => observer.disconnect()
  }, [threshold])
  return [ref, visible]
}

/* ── Why AcadeX: Problem vs Solution ──────────────────────── */
const PROBLEMS = [
  { icon: '📦', text: 'Physical archives and printed copies scattered across departments' },
  { icon: '🗑️', text: 'Lost or deteriorated capstone papers with no backup' },
  { icon: '⏳', text: 'Slow manual retrieval taking days or weeks' },
  { icon: '💾', text: 'Unindexed digital folders with no search capability' },
]

const SOLUTIONS = [
  { icon: '☁️', text: 'Centralized cloud repository accessible anytime, anywhere' },
  { icon: '🔒', text: 'Permanent digital preservation with redundant storage' },
  { icon: '⚡', text: 'Instant search across thousands of capstone projects' },
  { icon: '🔍', text: 'Smart indexing with NLP-powered intelligent search' },
]

/* ── Process Steps ─────────────────────────────────────────── */
const PROCESS_STEPS = [
  {
    step: '01',
    title: 'Upload PDF',
    description: 'Faculty or students upload approved capstone PDFs to the system.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4" /><polyline points="17 8 12 3 7 8" /><line x1="12" y1="3" x2="12" y2="15" />
      </svg>
    ),
  },
  {
    step: '02',
    title: 'Extract Metadata',
    description: 'AI automatically extracts title, authors, abstract, keywords, and year.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
  },
  {
    step: '03',
    title: 'Organize Repository',
    description: 'Projects are categorized, tagged, and indexed for fast discovery.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <rect x="3" y="3" width="7" height="7" /><rect x="14" y="3" width="7" height="7" /><rect x="14" y="14" width="7" height="7" /><rect x="3" y="14" width="7" height="7" />
      </svg>
    ),
  },
  {
    step: '04',
    title: 'Search Easily',
    description: 'Users find research in seconds using keywords, tags, or author names.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
  },
  {
    step: '05',
    title: 'Preserve Research',
    description: 'Academic knowledge is permanently secured and available for generations.',
    icon: (
      <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
  },
]

export default function About() {
  const [whyRef, whyVisible] = useScrollReveal(0.1)
  const [processRef, processVisible] = useScrollReveal(0.1)

  return (
    <>
      {/* ── Why AcadeX Section ─────────────────────────────────── */}
      <section
        id="about"
        ref={whyRef}
        className="py-24 md:py-32"
        style={{ background: 'var(--color-bg)' }}
        aria-labelledby="about-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div
            className="text-center mb-16"
            style={{
              opacity: whyVisible ? 1 : 0,
              transform: whyVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <span className="hero-badge mb-5 inline-flex">Why AcadeX</span>
            <h2
              id="about-heading"
              className="font-poppins font-bold mb-4"
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              From Chaos to{' '}
              <span className="text-gradient">Clarity</span>
            </h2>
            <p className="max-w-2xl mx-auto text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              MinSU's capstone research used to be buried in dusty shelves and scattered folders.
              AcadeX changes everything.
            </p>
          </div>

          {/* Problem vs Solution comparison */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-8 max-w-5xl mx-auto">

            {/* Problem */}
            <div
              className="rounded-2xl p-7"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid rgba(239,68,68,0.2)',
                boxShadow: 'var(--shadow-sm)',
                opacity: whyVisible ? 1 : 0,
                transform: whyVisible ? 'translateX(0)' : 'translateX(-30px)',
                transition: 'opacity 0.6s ease 0.1s, transform 0.6s ease 0.1s',
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
                  style={{ background: 'rgba(239,68,68,0.1)', border: '1px solid rgba(239,68,68,0.2)' }}>
                  ⚠️
                </div>
                <h3 className="font-poppins font-semibold text-base" style={{ color: 'var(--color-text)' }}>
                  Before AcadeX
                </h3>
              </div>
              <div className="space-y-4">
                {PROBLEMS.map((p, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3"
                    style={{
                      opacity: whyVisible ? 1 : 0,
                      transform: whyVisible ? 'translateX(0)' : 'translateX(-15px)',
                      transition: `opacity 0.5s ease ${0.2 + i * 0.08}s, transform 0.5s ease ${0.2 + i * 0.08}s`,
                    }}
                  >
                    <span className="text-xl flex-shrink-0">{p.icon}</span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>{p.text}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Solution */}
            <div
              className="rounded-2xl p-7"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border-strong)',
                boxShadow: 'var(--shadow-md), var(--shadow-glow)',
                opacity: whyVisible ? 1 : 0,
                transform: whyVisible ? 'translateX(0)' : 'translateX(30px)',
                transition: 'opacity 0.6s ease 0.2s, transform 0.6s ease 0.2s',
              }}
            >
              <div className="flex items-center gap-3 mb-6">
                <div className="w-9 h-9 rounded-xl flex items-center justify-center text-sm"
                  style={{ background: 'rgba(91,190,99,0.12)', border: '1px solid var(--color-border)' }}>
                  ✨
                </div>
                <h3 className="font-poppins font-semibold text-base" style={{ color: 'var(--color-text)' }}>
                  With AcadeX
                </h3>
              </div>
              <div className="space-y-4">
                {SOLUTIONS.map((s, i) => (
                  <div
                    key={i}
                    className="flex items-start gap-3"
                    style={{
                      opacity: whyVisible ? 1 : 0,
                      transform: whyVisible ? 'translateX(0)' : 'translateX(15px)',
                      transition: `opacity 0.5s ease ${0.3 + i * 0.08}s, transform 0.5s ease ${0.3 + i * 0.08}s`,
                    }}
                  >
                    <span className="text-xl flex-shrink-0">{s.icon}</span>
                    <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>{s.text}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ── Process / Workflow Section ─────────────────────────── */}
      <section
        id="process"
        ref={processRef}
        className="py-24 md:py-32"
        style={{ background: 'var(--color-bg-tertiary)' }}
        aria-labelledby="process-heading"
      >
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

          {/* Header */}
          <div
            className="text-center mb-16"
            style={{
              opacity: processVisible ? 1 : 0,
              transform: processVisible ? 'translateY(0)' : 'translateY(20px)',
              transition: 'opacity 0.5s ease, transform 0.5s ease',
            }}
          >
            <span className="hero-badge mb-5 inline-flex">How It Works</span>
            <h2
              id="process-heading"
              className="font-poppins font-bold mb-4"
              style={{
                fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
                color: 'var(--color-text)',
                letterSpacing: '-0.02em',
              }}
            >
              From Upload to{' '}
              <span className="text-gradient">Discovery</span>
            </h2>
            <p className="max-w-xl mx-auto text-base leading-relaxed" style={{ color: 'var(--color-text-secondary)' }}>
              AcadeX handles the entire research lifecycle — from PDF upload to permanent preservation.
            </p>
          </div>

          {/* Steps */}
          <div className="relative">
            {/* Connector line — desktop */}
            <div
              className="hidden lg:block absolute top-10 left-0 right-0 h-0.5 pointer-events-none"
              style={{
                background: 'linear-gradient(90deg, transparent, var(--color-border-strong) 15%, var(--color-primary) 50%, var(--color-border-strong) 85%, transparent)',
                top: 28,
                left: '10%',
                right: '10%',
              }}
              aria-hidden="true"
            />

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-8 lg:gap-4">
              {PROCESS_STEPS.map((step, i) => (
                <div
                  key={step.step}
                  className="relative flex flex-col items-center text-center"
                  style={{
                    opacity: processVisible ? 1 : 0,
                    transform: processVisible ? 'translateY(0)' : 'translateY(30px)',
                    transition: `opacity 0.5s ease ${i * 0.12}s, transform 0.5s ease ${i * 0.12}s`,
                  }}
                >
                  {/* Step circle */}
                  <div
                    className="w-14 h-14 rounded-2xl flex items-center justify-center mb-5 relative z-10"
                    style={{
                      background: 'var(--color-surface)',
                      border: '2px solid var(--color-border-strong)',
                      color: 'var(--color-primary)',
                      boxShadow: processVisible ? 'var(--shadow-glow)' : 'none',
                      transition: 'box-shadow 0.5s ease',
                    }}
                  >
                    {step.icon}
                  </div>

                  {/* Step number badge */}
                  <div
                    className="absolute -top-1 -right-1 lg:right-auto lg:left-auto w-5 h-5 rounded-full flex items-center justify-center z-20 text-white font-bold"
                    style={{
                      fontSize: '0.6rem',
                      background: 'var(--color-primary)',
                      left: 'calc(50% + 10px)',
                    }}
                    aria-hidden="true"
                  >
                    {i + 1}
                  </div>

                  <h3
                    className="font-poppins font-semibold text-sm mb-2"
                    style={{ color: 'var(--color-text)' }}
                  >
                    {step.title}
                  </h3>
                  <p className="text-xs leading-relaxed" style={{ color: 'var(--color-text-muted)', maxWidth: 160 }}>
                    {step.description}
                  </p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>
    </>
  )
}
