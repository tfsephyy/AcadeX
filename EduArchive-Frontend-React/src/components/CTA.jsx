import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'

function useScrollReveal(threshold = 0.2) {
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

export default function CTA() {
  const [ref, visible] = useScrollReveal(0.2)

  return (
    <section
      ref={ref}
      className="py-24 md:py-32 relative overflow-hidden"
      style={{ background: 'var(--color-bg-secondary)' }}
      aria-labelledby="cta-heading"
    >
      {/* Animated background orbs */}
      <div
        aria-hidden="true"
        className="absolute top-[-30%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none animate-float-slow"
        style={{
          background: 'radial-gradient(circle, rgba(91,190,99,0.15) 0%, transparent 70%)',
          filter: 'blur(60px)',
        }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-30%] left-[-10%] w-[450px] h-[450px] rounded-full pointer-events-none animate-float-delayed"
        style={{
          background: 'radial-gradient(circle, rgba(27,127,91,0.2) 0%, transparent 70%)',
          filter: 'blur(70px)',
        }}
      />

      {/* Grid overlay */}
      <div className="absolute inset-0 bg-grid opacity-50 pointer-events-none" aria-hidden="true" />

      <div className="relative z-10 max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

        {/* Badge */}
        <div
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease, transform 0.5s ease',
          }}
        >
          <span className="hero-badge mb-6 inline-flex">
            Ready to Get Started?
          </span>
        </div>

        {/* Headline */}
        <h2
          id="cta-heading"
          className="font-poppins font-bold mb-5"
          style={{
            fontSize: 'clamp(1.75rem, 4.5vw, 3rem)',
            color: 'var(--color-text)',
            letterSpacing: '-0.02em',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(24px)',
            transition: 'opacity 0.5s ease 0.1s, transform 0.5s ease 0.1s',
          }}
        >
          Join AcadeX and Preserve{' '}
          <span className="text-gradient">Academic Excellence</span>
        </h2>

        <p
          className="text-base leading-relaxed mb-10 max-w-2xl mx-auto"
          style={{
            color: 'var(--color-text-secondary)',
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease 0.2s, transform 0.5s ease 0.2s',
          }}
        >
          Gain instant access to a growing repository of capstone projects from Mindoro State University.
          Search smarter, research better, collaborate everywhere.
        </p>

        {/* CTA Buttons */}
        <div
          className="flex flex-col sm:flex-row gap-4 justify-center"
          style={{
            opacity: visible ? 1 : 0,
            transform: visible ? 'translateY(0)' : 'translateY(20px)',
            transition: 'opacity 0.5s ease 0.3s, transform 0.5s ease 0.3s',
          }}
        >
          <Link to="/register" className="btn-primary" style={{ padding: '1rem 2.5rem', fontSize: '1rem' }}>
            Create Free Account
          </Link>
          <Link to="/login" className="btn-outline" style={{ padding: '1rem 2.5rem', fontSize: '1rem' }}>
            Sign In
          </Link>
        </div>

        {/* Trust indicators */}
        <div
          className="mt-10 flex flex-wrap items-center justify-center gap-6 text-xs"
          style={{
            color: 'var(--color-text-muted)',
            opacity: visible ? 1 : 0,
            transition: 'opacity 0.5s ease 0.45s',
          }}
        >
          {['No credit card required', 'MinSU students & faculty', 'Secure & private'].map(item => (
            <span key={item} className="flex items-center gap-1.5">
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="var(--color-primary)" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                <polyline points="20 6 9 17 4 12" />
              </svg>
              {item}
            </span>
          ))}
        </div>
      </div>
    </section>
  )
}
