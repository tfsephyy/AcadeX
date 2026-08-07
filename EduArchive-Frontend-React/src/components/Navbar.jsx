import { useState, useEffect, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { useTheme } from '../context/ThemeContext'

const NAV_LINKS = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
  { label: 'Process', href: '#process' },
]

/* ── Sun / Moon Icons ──────────────────────────────────────────── */
function SunIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <circle cx="12" cy="12" r="5" />
      <line x1="12" y1="1" x2="12" y2="3" />
      <line x1="12" y1="21" x2="12" y2="23" />
      <line x1="4.22" y1="4.22" x2="5.64" y2="5.64" />
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78" />
      <line x1="1" y1="12" x2="3" y2="12" />
      <line x1="21" y1="12" x2="23" y2="12" />
      <line x1="4.22" y1="19.78" x2="5.64" y2="18.36" />
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22" />
    </svg>
  )
}

function MoonIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="M21 12.79A9 9 0 1111.21 3 7 7 0 0021 12.79z" />
    </svg>
  )
}

/* ── AcadeX Logo Mark ──────────────────────────────────────────── */
function LogoMark({ size = 36 }) {
  return (
    <div
      style={{ width: size, height: size }}
      className="flex items-center justify-center rounded-xl shadow-lg flex-shrink-0"
      style={{
        width: size,
        height: size,
        background: 'linear-gradient(135deg, var(--color-primary) 0%, var(--color-accent-bright) 100%)',
        borderRadius: 12,
        boxShadow: '0 4px 16px rgba(91, 190, 99, 0.35)',
      }}
    >
      <svg width={size * 0.55} height={size * 0.55} viewBox="0 0 24 24" fill="white" aria-hidden="true">
        <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
      </svg>
    </div>
  )
}

export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)
  const [activeSection, setActiveSection] = useState('home')

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 30)
    window.addEventListener('scroll', handleScroll, { passive: true })
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Active section tracking via IntersectionObserver
  useEffect(() => {
    const sectionIds = NAV_LINKS.map(l => l.href.slice(1))
    const observers = []

    sectionIds.forEach(id => {
      const el = document.getElementById(id)
      if (!el) return
      const obs = new IntersectionObserver(
        ([entry]) => { if (entry.isIntersecting) setActiveSection(id) },
        { threshold: 0.35 }
      )
      obs.observe(el)
      observers.push(obs)
    })

    return () => observers.forEach(obs => obs.disconnect())
  }, [])

  const closeMenu = useCallback(() => setMenuOpen(false), [])

  return (
    <nav
      className="fixed top-0 left-0 right-0 z-50 transition-all duration-300"
      style={{
        background: scrolled
          ? 'var(--color-surface)'
          : 'transparent',
        backdropFilter: scrolled ? 'blur(20px)' : 'none',
        WebkitBackdropFilter: scrolled ? 'blur(20px)' : 'none',
        borderBottom: scrolled ? '1px solid var(--color-border)' : '1px solid transparent',
        boxShadow: scrolled ? 'var(--shadow-sm)' : 'none',
      }}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-18" style={{ height: 68 }}>

          {/* Logo */}
          <a
            href="#home"
            className="flex items-center gap-2.5 group"
            aria-label="AcadeX Home"
            onClick={closeMenu}
          >
            <LogoMark size={36} />
            <span
              className="font-poppins font-bold text-xl tracking-tight"
              style={{ color: 'var(--color-text)' }}
            >
              Acade<span style={{ color: 'var(--color-primary)' }}>X</span>
            </span>
          </a>

          {/* Desktop Nav Links */}
          <div className="hidden md:flex items-center gap-7">
            {NAV_LINKS.map(link => (
              <a
                key={link.label}
                href={link.href}
                className={`nav-link ${activeSection === link.href.slice(1) ? 'active' : ''}`}
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop Right Actions */}
          <div className="hidden md:flex items-center gap-3">
            {/* Theme Toggle */}
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
              title={theme === 'dark' ? 'Light mode' : 'Dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <Link
              to="/login"
              className="btn-outline"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              className="btn-primary"
              style={{ padding: '0.5rem 1.25rem', fontSize: '0.875rem' }}
            >
              Get Started
            </Link>
          </div>

          {/* Mobile right: theme toggle + hamburger */}
          <div className="md:hidden flex items-center gap-2">
            <button
              className="theme-toggle"
              onClick={toggleTheme}
              aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
            >
              {theme === 'dark' ? <SunIcon /> : <MoonIcon />}
            </button>

            <button
              className="flex flex-col gap-1.5 p-2 rounded-xl transition-colors duration-200"
              style={{
                background: menuOpen ? 'var(--color-surface)' : 'transparent',
                border: '1px solid',
                borderColor: menuOpen ? 'var(--color-border)' : 'transparent',
              }}
              onClick={() => setMenuOpen(prev => !prev)}
              aria-label="Toggle mobile menu"
              aria-expanded={menuOpen}
            >
              <span
                className="block w-5 h-0.5 rounded transition-all duration-300"
                style={{
                  background: 'var(--color-text)',
                  transform: menuOpen ? 'rotate(45deg) translate(2px, 6px)' : 'none',
                }}
              />
              <span
                className="block w-5 h-0.5 rounded transition-all duration-300"
                style={{
                  background: 'var(--color-text)',
                  opacity: menuOpen ? 0 : 1,
                }}
              />
              <span
                className="block w-5 h-0.5 rounded transition-all duration-300"
                style={{
                  background: 'var(--color-text)',
                  transform: menuOpen ? 'rotate(-45deg) translate(2px, -6px)' : 'none',
                }}
              />
            </button>
          </div>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className="md:hidden overflow-hidden"
        style={{
          maxHeight: menuOpen ? '400px' : '0',
          opacity: menuOpen ? 1 : 0,
          transition: 'max-height 0.35s ease, opacity 0.25s ease',
          background: 'var(--color-surface)',
          backdropFilter: 'blur(20px)',
          WebkitBackdropFilter: 'blur(20px)',
          borderTop: '1px solid var(--color-border)',
        }}
      >
        <div className="max-w-7xl mx-auto px-4 py-5 flex flex-col gap-2">
          {NAV_LINKS.map(link => (
            <a
              key={link.label}
              href={link.href}
              onClick={closeMenu}
              className="py-2.5 px-4 rounded-xl font-medium text-sm transition-colors duration-200"
              style={{
                color: activeSection === link.href.slice(1) ? 'var(--color-primary)' : 'var(--color-text-secondary)',
                background: activeSection === link.href.slice(1) ? 'rgba(91,190,99,0.08)' : 'transparent',
              }}
            >
              {link.label}
            </a>
          ))}
          <div className="pt-3 flex flex-col gap-2.5 border-t" style={{ borderColor: 'var(--color-border)' }}>
            <Link
              to="/login"
              onClick={closeMenu}
              className="btn-outline text-center"
              style={{ padding: '0.75rem', fontSize: '0.875rem' }}
            >
              Sign In
            </Link>
            <Link
              to="/register"
              onClick={closeMenu}
              className="btn-primary text-center"
              style={{ padding: '0.75rem', fontSize: '0.875rem' }}
            >
              Get Started
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
