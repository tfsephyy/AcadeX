import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'

const navLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
]

export default function Navbar() {
  const [menuOpen, setMenuOpen] = useState(false)
  const [scrolled, setScrolled] = useState(false)

  useEffect(() => {
    const handleScroll = () => setScrolled(window.scrollY > 20)
    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  return (
    <nav
      className={`fixed top-0 left-0 right-0 z-50 transition-all duration-300 ${
        scrolled
          ? 'bg-[#0f2f1b]/95 backdrop-blur-md shadow-lg shadow-black/30'
          : 'bg-transparent'
      }`}
      aria-label="Main navigation"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16 md:h-20">
          {/* Logo */}
          <a href="#home" className="flex items-center gap-2 group" aria-label="EduArchive Home">
            <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#8BC34A] shadow-md group-hover:bg-[#a5d65e] transition-colors duration-200">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-5 h-5 text-[#0f2f1b]"
                viewBox="0 0 24 24"
                fill="currentColor"
                aria-hidden="true"
              >
                <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
              </svg>
            </div>
            <span className="font-poppins font-bold text-xl text-[#F1F8E9] tracking-tight">
              Edu<span className="text-[#8BC34A]">Archive</span>
            </span>
          </a>

          {/* Desktop Links */}
          <div className="hidden md:flex items-center gap-8">
            {navLinks.map((link) => (
              <a
                key={link.label}
                href={link.href}
                className="relative text-[#c8e6c9] font-medium text-sm tracking-wide
                  after:absolute after:bottom-[-4px] after:left-0 after:h-[2px] after:w-0
                  after:bg-[#8BC34A] after:transition-all after:duration-300
                  hover:text-[#F1F8E9] hover:after:w-full transition-colors duration-200"
              >
                {link.label}
              </a>
            ))}
          </div>

          {/* Desktop Auth Buttons */}
          <div className="hidden md:flex items-center gap-3">
            <Link
              to="/login"
              className="px-5 py-2 rounded-xl text-sm font-semibold text-[#8BC34A] border border-[#8BC34A]/60
                hover:bg-[#8BC34A]/10 transition-all duration-200"
            >
              Login
            </Link>
            <Link
              to="/register"
              className="px-5 py-2 rounded-xl text-sm font-semibold bg-[#2E7D32] text-[#F1F8E9]
                hover:bg-[#388e3c] shadow-md hover:shadow-green-900/40 transition-all duration-200"
            >
              Register
            </Link>
          </div>

          {/* Mobile Hamburger */}
          <button
            className="md:hidden flex flex-col gap-1.5 p-2 rounded-lg hover:bg-white/10 transition-colors duration-200"
            onClick={() => setMenuOpen(!menuOpen)}
            aria-label="Toggle mobile menu"
            aria-expanded={menuOpen}
          >
            <span
              className={`block w-6 h-0.5 bg-[#F1F8E9] transition-all duration-300 ${
                menuOpen ? 'rotate-45 translate-y-2' : ''
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-[#F1F8E9] transition-all duration-300 ${
                menuOpen ? 'opacity-0' : ''
              }`}
            />
            <span
              className={`block w-6 h-0.5 bg-[#F1F8E9] transition-all duration-300 ${
                menuOpen ? '-rotate-45 -translate-y-2' : ''
              }`}
            />
          </button>
        </div>
      </div>

      {/* Mobile Menu */}
      <div
        className={`md:hidden overflow-hidden transition-all duration-300 ${
          menuOpen ? 'max-h-80 opacity-100' : 'max-h-0 opacity-0'
        } bg-[#0f2f1b]/98 backdrop-blur-md border-t border-white/10`}
      >
        <div className="max-w-7xl mx-auto px-4 py-4 flex flex-col gap-3">
          {navLinks.map((link) => (
            <a
              key={link.label}
              href={link.href}
              onClick={() => setMenuOpen(false)}
              className="text-[#c8e6c9] font-medium py-2 px-3 rounded-lg hover:bg-white/10 hover:text-[#F1F8E9] transition-colors duration-200"
            >
              {link.label}
            </a>
          ))}
          <div className="pt-2 flex flex-col gap-2 border-t border-white/10">
            <Link
              to="/login"
              onClick={() => setMenuOpen(false)}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold text-center text-[#8BC34A] border border-[#8BC34A]/60
                hover:bg-[#8BC34A]/10 transition-all duration-200"
            >
              Login
            </Link>
            <Link
              to="/register"
              onClick={() => setMenuOpen(false)}
              className="py-2.5 px-4 rounded-xl text-sm font-semibold text-center bg-[#2E7D32] text-[#F1F8E9]
                hover:bg-[#388e3c] transition-all duration-200"
            >
              Register
            </Link>
          </div>
        </div>
      </div>
    </nav>
  )
}
