import { useEffect, useRef, useState } from 'react'

const FEATURES = [
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8z" />
        <polyline points="14 2 14 8 20 8" />
        <line x1="16" y1="13" x2="8" y2="13" /><line x1="16" y1="17" x2="8" y2="17" /><polyline points="10 9 9 9 8 9" />
      </svg>
    ),
    label: 'Central Repository',
    description: 'Securely store and organize all approved capstone projects in a unified, always-accessible digital archive.',
    color: '#5BBE63',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <polyline points="22 12 18 12 15 21 9 3 6 12 2 12" />
      </svg>
    ),
    label: 'PDF Extraction',
    description: 'Automatically extract title, authors, abstract, keywords, and publication year from any uploaded PDF.',
    color: '#22c55e',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <rect x="3" y="3" width="18" height="18" rx="2" ry="2" />
        <line x1="3" y1="9" x2="21" y2="9" /><line x1="9" y1="21" x2="9" y2="9" />
      </svg>
    ),
    label: 'OCR Integration',
    description: 'Extract readable text from scanned PDFs using advanced Optical Character Recognition technology.',
    color: '#10b981',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="12" cy="12" r="10" />
        <path d="M12 8v4l3 3" />
      </svg>
    ),
    label: 'NLP Processing',
    description: 'Natural Language Processing improves organization, searchability, and intelligent content discovery.',
    color: '#06b6d4',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <circle cx="11" cy="11" r="8" /><line x1="21" y1="21" x2="16.65" y2="16.65" />
      </svg>
    ),
    label: 'Smart Search',
    description: 'Find any project instantly using keywords, tags, categories, authors, or publication year.',
    color: '#8b5cf6',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M22 12h-4l-3 9L9 3l-3 9H2" />
      </svg>
    ),
    label: 'Activity Tracking',
    description: 'Monitor uploads, downloads, and repository activity with comprehensive audit logs.',
    color: '#f59e0b',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M21 15a2 2 0 01-2 2H7l-4 4V5a2 2 0 012-2h14a2 2 0 012 2z" />
      </svg>
    ),
    label: 'Chatbot',
    description: 'Intelligent assistant that helps users navigate the repository, discover research, and answer queries.',
    color: '#ec4899',
  },
  {
    icon: (
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
        <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
      </svg>
    ),
    label: 'Secure Access',
    description: 'Role-based permissions for Administrators, Faculty, Students, and Visitors — each with tailored access.',
    color: '#5BBE63',
  },
]

/* ── Scroll-reveal hook ──────────────────────────────────────── */
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

/* ── Feature Card ────────────────────────────────────────────── */
function FeatureCard({ feature, index, visible }) {
  return (
    <div
      className="feature-card"
      style={{
        opacity: visible ? 1 : 0,
        transform: visible ? 'translateY(0)' : 'translateY(28px)',
        transition: `opacity 0.55s ease ${index * 0.07}s, transform 0.55s ease ${index * 0.07}s`,
      }}
    >
      {/* Icon */}
      <div
        className="w-12 h-12 rounded-2xl flex items-center justify-center mb-5"
        style={{
          background: `${feature.color}18`,
          border: `1.5px solid ${feature.color}35`,
          color: feature.color,
        }}
      >
        {feature.icon}
      </div>

      <h3
        className="font-poppins font-semibold text-base mb-2"
        style={{ color: 'var(--color-text)' }}
      >
        {feature.label}
      </h3>
      <p className="text-sm leading-relaxed" style={{ color: 'var(--color-text-muted)' }}>
        {feature.description}
      </p>

      {/* Hover glow dot */}
      <div
        className="absolute bottom-0 right-0 w-24 h-24 rounded-full opacity-0 group-hover:opacity-100 pointer-events-none"
        style={{
          background: `radial-gradient(circle, ${feature.color}20 0%, transparent 70%)`,
          filter: 'blur(20px)',
          transition: 'opacity 0.4s ease',
        }}
        aria-hidden="true"
      />
    </div>
  )
}

export default function Features() {
  const [sectionRef, visible] = useScrollReveal(0.1)

  return (
    <section
      id="features"
      ref={sectionRef}
      className="py-24 md:py-32"
      style={{ background: 'var(--color-bg-secondary)' }}
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">

        {/* Section header */}
        <div
          className="text-center mb-16"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <span
            className="hero-badge mb-5 inline-flex"
          >
            What We Offer
          </span>
          <h2
            id="features-heading"
            className="font-poppins font-bold mb-4"
            style={{
              fontSize: 'clamp(1.75rem, 4vw, 2.75rem)',
              color: 'var(--color-text)',
              letterSpacing: '-0.02em',
            }}
          >
            Everything You Need to{' '}
            <span className="text-gradient">Manage Research</span>
          </h2>
          <p
            className="max-w-2xl mx-auto text-base leading-relaxed"
            style={{ color: 'var(--color-text-secondary)' }}
          >
            AcadeX integrates modern technologies to streamline how capstone research is
            submitted, stored, and discovered at Mindoro State University.
          </p>
        </div>

        {/* Feature cards grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-5">
          {FEATURES.map((feature, i) => (
            <FeatureCard
              key={feature.label}
              feature={feature}
              index={i}
              visible={visible}
            />
          ))}
        </div>
      </div>
    </section>
  )
}
