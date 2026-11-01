import { Link } from 'react-router-dom'
import Brand from './Brand'
export default function Footer() {
  return <footer className="site-footer" aria-label="Site footer"><div className="site-container">
    <div className="footer-layout"><div><Brand to="/#home" /><p>A capstone repository for the<br />Mindoro State University community.</p></div>
      <nav aria-label="Repository information"><h2>Repository</h2><a href="#features">Features</a><a href="#about">About AcadeX</a><a href="#process">How it works</a></nav>
      <nav aria-label="Account access"><h2>Your account</h2><Link to="/login">Sign in</Link><Link to="/register">Create an account</Link></nav>
      <div className="footer-university"><h2>Mindoro State University</h2><p>Calapan City, Oriental Mindoro<br />Philippines</p><a href="mailto:research@minsu.edu.ph">research@minsu.edu.ph</a></div>
    </div><div className="footer-bottom"><span>© {new Date().getFullYear()} Mindoro State University</span><span>AcadeX · Capstone Project Repository</span></div>
  </div></footer>
}
