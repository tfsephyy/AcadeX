import { Link } from 'react-router-dom'

const anchorLinks = [
  { label: 'Home', href: '#home' },
  { label: 'Features', href: '#features' },
  { label: 'About', href: '#about' },
]

export default function Footer() {
  return (
    <footer
      className="bg-[#071a0e] border-t border-[#1B5E20]/40"
      aria-label="Site footer"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14">
        <div className="flex flex-col md:flex-row justify-between gap-10">

          {/* Left — Branding */}
          <div className="max-w-xs">
            <div className="flex items-center gap-2 mb-4">
              <div className="flex items-center justify-center w-9 h-9 rounded-lg bg-[#8BC34A] shadow-md">
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
              <span className="font-poppins font-bold text-xl text-[#F1F8E9]">
                Edu<span className="text-[#8BC34A]">Archive</span>
              </span>
            </div>
            <p className="text-[#a5d6a7] text-sm leading-relaxed mb-2">
              Capstone Project Mining System
            </p>
            <p className="text-[#6a9f78] text-sm">Mindoro State University</p>
          </div>

          {/* Right — Quick Links */}
          <div>
            <h3 className="font-poppins font-semibold text-[#F1F8E9] text-sm mb-4 tracking-wide uppercase">
              Quick Links
            </h3>
            <ul className="space-y-2.5">
              {anchorLinks.map((link) => (
                <li key={link.label}>
                  <a
                    href={link.href}
                    className="text-[#a5d6a7] text-sm hover:text-[#8BC34A] transition-colors duration-200"
                  >
                    {link.label}
                  </a>
                </li>
              ))}
              <li>
                <Link
                  to="/login"
                  className="text-[#a5d6a7] text-sm hover:text-[#8BC34A] transition-colors duration-200"
                >
                  Login
                </Link>
              </li>
            </ul>
          </div>

          {/* Contact / Info */}
          <div>
            <h3 className="font-poppins font-semibold text-[#F1F8E9] text-sm mb-4 tracking-wide uppercase">
              Contact
            </h3>
            <ul className="space-y-2.5 text-sm text-[#a5d6a7]">
              <li>Calapan City, Oriental Mindoro</li>
              <li>Philippines</li>
              <li className="mt-2">
                <a
                  href="mailto:research@minsu.edu.ph"
                  className="hover:text-[#8BC34A] transition-colors duration-200"
                >
                  research@minsu.edu.ph
                </a>
              </li>
            </ul>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 pt-6 border-t border-[#1B5E20]/40 flex flex-col sm:flex-row justify-between items-center gap-3 text-xs text-[#6a9f78]">
          <p>© 2026 Mindoro State University. All rights reserved.</p>
          <p>EduArchive — Capstone Project Mining System</p>
        </div>
      </div>
    </footer>
  )
}
