import { Link } from 'react-router-dom'
import { HiArrowRight } from 'react-icons/hi'
export default function CTA() {
  return <section className="repository-cta" aria-labelledby="cta-heading"><div className="site-container cta-layout">
    <div><p className="section-kicker">Start with AcadeX</p><h2 id="cta-heading">Your next reference starts here.</h2><p>Sign in to explore the collection, or create an account to get started.</p></div>
    <div className="hero-actions"><Link to="/register" className="btn-primary">Create an account <HiArrowRight aria-hidden="true" /></Link><Link to="/login" className="btn-outline">Sign in</Link></div>
  </div></section>
}
