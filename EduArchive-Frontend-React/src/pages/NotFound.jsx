import { Link } from 'react-router-dom'
import Brand from '../components/Brand'
export default function NotFound() {
  return <main className="site-container py-10"><Brand /><div className="py-20 max-w-lg"><p className="section-kicker">Page not found</p><h1 className="font-poppins text-3xl font-semibold mb-4">Let’s get you back to the repository.</h1><p className="mb-8" style={{color:'var(--color-text-secondary)'}}>This address may have changed. Return home or open your workspace to continue.</p><div className="hero-actions"><Link to="/dashboard" className="btn-primary">Open my workspace</Link><Link to="/" className="btn-outline">Return home</Link></div></div></main>
}
