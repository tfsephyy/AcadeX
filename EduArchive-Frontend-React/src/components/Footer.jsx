import { Link } from 'react-router-dom'

const FOOTER_LINKS = {
  Product: [
    { label: 'Home', href: '#home' },
    { label: 'Features', href: '#features' },
    { label: 'About', href: '#about' },
    { label: 'How It Works', href: '#process' },
  ],
  Access: [
    { label: 'Sign In', to: '/login' },
    { label: 'Create Account', to: '/register' },
  ],
  Legal: [
    { label: 'Privacy Policy', href: '#' },
    { label: 'Terms of Service', href: '#' },
  ],
}

function LogoMark() {
  return (
    <div
      style={{
        width: 38,
        height: 38,
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent-bright) 100%)',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(91, 190, 99, 0.3)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        flexShrink: 0,
      }}
    >
      <svg width="21" height="21" viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
      </svg>
    </div>
  )
}

export default function Footer() {
  const year = new Date().getFullYear()

  return (
    <footer
      style={{
        background: 'var(--color-bg)',
        borderTop: '1px solid var(--color-border)',
      }}
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-5 gap-10">

          {/* Brand column (wider) */}
          <div className="lg:col-span-2">
            <a href="#home" className="flex items-center gap-2.5 mb-5 group w-fit">
              <LogoMark />
              <span
                className="font-poppins font-bold text-xl tracking-tight"
                style={{ color: 'var(--color-text)' }}
              >
                Acade<span style={{ color: 'var(--color-primary)' }}>X</span>
              </span>
            </a>

            <p className="text-sm leading-relaxed mb-5 max-w-xs" style={{ color: 'var(--color-text-muted)' }}>
              The centralized digital repository for capstone project mining, storage, and discovery
              at Mindoro State University.
            </p>

            {/* University info */}
            <div
              className="rounded-xl p-4 text-sm"
              style={{
                background: 'var(--color-surface)',
                border: '1px solid var(--color-border)',
              }}
            >
              <p className="font-semibold mb-1" style={{ color: 'var(--color-text)' }}>
                Mindoro State University
              </p>
              <p style={{ color: 'var(--color-text-muted)' }}>Calapan City, Oriental Mindoro</p>
              <p style={{ color: 'var(--color-text-muted)' }}>Philippines</p>
              <a
                href="mailto:research@minsu.edu.ph"
                className="mt-2 block transition-colors duration-200"
                style={{ color: 'var(--color-primary)' }}
                onMouseEnter={e => e.target.style.color = 'var(--color-accent-bright)'}
                onMouseLeave={e => e.target.style.color = 'var(--color-primary)'}
              >
                research@minsu.edu.ph
              </a>
            </div>
          </div>

          {/* Link columns */}
          {Object.entries(FOOTER_LINKS).map(([section, links]) => (
            <div key={section}>
              <h3
                className="font-poppins font-semibold text-xs uppercase tracking-widest mb-5"
                style={{ color: 'var(--color-text)' }}
              >
                {section}
              </h3>
              <ul className="space-y-3">
                {links.map(link => (
                  <li key={link.label}>
                    {link.to ? (
                      <Link
                        to={link.to}
                        className="text-sm transition-colors duration-200"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => e.target.style.color = 'var(--color-primary)'}
                        onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}
                      >
                        {link.label}
                      </Link>
                    ) : (
                      <a
                        href={link.href}
                        className="text-sm transition-colors duration-200"
                        style={{ color: 'var(--color-text-muted)' }}
                        onMouseEnter={e => e.target.style.color = 'var(--color-primary)'}
                        onMouseLeave={e => e.target.style.color = 'var(--color-text-muted)'}
                      >
                        {link.label}
                      </a>
                    )}
                  </li>
                ))}
              </ul>
            </div>
          ))}
        </div>

        {/* Bottom bar */}
        <div
          className="mt-12 pt-6 flex flex-col sm:flex-row justify-between items-center gap-4 text-xs"
          style={{
            borderTop: '1px solid var(--color-border)',
            color: 'var(--color-text-faint)',
          }}
        >
          <p>© {year} Mindoro State University. All rights reserved.</p>
          <p>
            AcadeX — Capstone Project Mining System{' '}
            <span style={{ color: 'var(--color-primary)' }}>·</span>{' '}
            Built for MinSU Research
          </p>
        </div>
      </div>
    </footer>
  )
}
