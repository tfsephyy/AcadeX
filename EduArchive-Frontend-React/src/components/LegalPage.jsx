import Brand from './Brand'
import { Link } from 'react-router-dom'

export default function LegalPage({ eyebrow, title, children }) {
  return (
    <div className="legal-page">
      <header className="legal-header">
        <div className="legal-header-inner">
          <Brand to="/" />
          <Link className="legal-back-link" to="/">Back to Acadex</Link>
        </div>
      </header>
      <main className="legal-content">
        <p className="legal-eyebrow">{eyebrow}</p>
        <h1>{title}</h1>
        <p className="legal-updated">Last updated November 5, 2026</p>
        <article className="legal-copy">{children}</article>
      </main>
      <footer className="legal-footer">
        <Link to="/privacy">Privacy Policy</Link>
        <span aria-hidden="true"> · </span>
        <Link to="/terms">Terms of Service</Link>
        <span> · AcadeX · Mindoro State University</span>
      </footer>
    </div>
  )
}
