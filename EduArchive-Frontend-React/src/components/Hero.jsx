import { Link } from 'react-router-dom'
import { HiArrowRight, HiOutlineBookOpen } from 'react-icons/hi'
import { BrandImage } from './Brand'

function AcademicCollection() {
  return <Link to="/login" className="academic-collection" aria-label="Explore the AcadeX capstone collection">
    <div className="collection-folio" aria-hidden="true">
      <div className="folio-sheet folio-sheet-back" />
      <div className="folio-sheet folio-sheet-middle" />
      <div className="folio-cover">
        <div className="folio-institution">MINDORO<br />STATE UNIVERSITY</div>
        <div className="folio-rule" />
        <HiOutlineBookOpen className="folio-mark" />
        <div className="folio-title">Capstone<br />Research</div>
        <div className="folio-subtitle">Ideas today.<br />References for tomorrow.</div>
        <div className="folio-imprint"><BrandImage compact /><span>Digital repository</span></div>
      </div>
    </div>
    <div className="collection-caption"><span className="collection-caption-label">The AcadeX collection</span><p>Preserving work.<br />Connecting ideas.</p><span className="collection-caption-detail">A shared academic record.</span><span className="collection-open">Explore the collection <HiArrowRight aria-hidden="true" /></span></div>
  </Link>
}

export default function Hero() {
  return <section id="home" className="repository-hero" aria-labelledby="hero-title">
    <div className="site-container hero-layout">
      <div className="hero-copy">
        <p className="section-kicker">Mindoro State University</p>
        <h1 id="hero-title">Preserve ideas.<br /><span>Discover research.</span></h1>
        <p className="hero-description">The capstone repository for the MinSU community. Find research, share your work, and keep knowledge connected.</p>
        <div className="hero-actions"><Link to="/login" className="btn-primary">Explore capstones <HiArrowRight aria-hidden="true" /></Link><Link to="/register" className="btn-outline">Create an account</Link></div>
        <p className="hero-access"><HiOutlineBookOpen aria-hidden="true" /> A place for every student’s contribution.</p>
      </div>
      <AcademicCollection />
    </div>
  </section>
}
