import { useEffect, useState, useRef } from 'react'
import { Link } from 'react-router-dom'
import { HiOutlineSun, HiOutlineMoon, HiOutlineMenu, HiOutlineX } from 'react-icons/hi'
import { useTheme } from '../context/useTheme'
import Brand from './Brand'

const links = [['Home', '#home'], ['The repository', '#features'], ['About', '#about'], ['How it works', '#process']]
export default function Navbar() {
  const { theme, toggleTheme } = useTheme()
  const [menuOpen, setMenuOpen] = useState(false)
  const [activeSection, setActiveSection] = useState('home')
  const menuButton = useRef(null)
  useEffect(() => {
    const close = e => { if (e.key === 'Escape') { setMenuOpen(false); menuButton.current?.focus() } }
    document.addEventListener('keydown', close)
    return () => document.removeEventListener('keydown', close)
  }, [])
  useEffect(() => {
    const observer = new IntersectionObserver(entries => {
      for (const entry of entries) if (entry.isIntersecting) setActiveSection(entry.target.id)
    }, { rootMargin: '-15% 0px -60% 0px', threshold: 0 })
    links.forEach(([, href]) => { const section = document.querySelector(href); if (section) observer.observe(section) })
    return () => observer.disconnect()
  }, [])
  return <header className="site-header"><a className="skip-link" href="#main-content">Skip to content</a><div className="site-container site-header-inner">
    <Brand to="/#home" />
    <nav className="site-desktop-nav" aria-label="Main navigation">{links.map(([name, href]) => <a key={href} href={href} aria-current={activeSection === href.slice(1) ? 'location' : undefined}>{name}</a>)}</nav>
    <div className="site-header-actions"><button type="button" className="theme-toggle header-theme-toggle" onClick={toggleTheme} aria-label={`Switch to ${theme === 'dark' ? 'light' : 'dark'} mode`}>{theme === 'dark' ? <HiOutlineSun /> : <HiOutlineMoon />}</button><Link className="btn-primary header-signin" to="/login">Sign in</Link><button ref={menuButton} type="button" className="theme-toggle site-menu-toggle" onClick={() => setMenuOpen(!menuOpen)} aria-label={menuOpen ? 'Close navigation' : 'Open navigation'} aria-expanded={menuOpen} aria-controls="mobile-navigation">{menuOpen ? <HiOutlineX /> : <HiOutlineMenu />}</button></div>
  </div>
    {menuOpen && <nav id="mobile-navigation" className="site-mobile-nav site-container" aria-label="Mobile navigation">{links.map(([name, href]) => <a key={href} href={href} aria-current={activeSection === href.slice(1) ? 'location' : undefined} onClick={() => setMenuOpen(false)}>{name}</a>)}<Link to="/register" onClick={() => setMenuOpen(false)}>Create an account</Link><button type="button" className="mobile-theme-control" onClick={toggleTheme}>{theme === 'dark' ? <HiOutlineSun aria-hidden="true" /> : <HiOutlineMoon aria-hidden="true" />} Switch to {theme === 'dark' ? 'light' : 'dark'} mode</button></nav>}
  </header>
}
