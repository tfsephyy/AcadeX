import { HiOutlineBookOpen, HiOutlineDocumentText, HiOutlineSearch } from 'react-icons/hi'
import Brand from './Brand'
export default function AuthAside() {
  return <aside className="auth-aside"><Brand /><div className="auth-aside-copy"><p className="section-kicker">Mindoro State University</p><h2>Research worth<br />keeping connected.</h2><p>One place to preserve capstone work and discover the ideas that came before yours.</p><ul><li><HiOutlineBookOpen aria-hidden="true" /> An organized academic collection</li><li><HiOutlineDocumentText aria-hidden="true" /> Guided PDF submission and review</li><li><HiOutlineSearch aria-hidden="true" /> Research discovery and reference tools</li></ul></div><p className="auth-aside-footer">AcadeX · Capstone Project Repository</p></aside>
}
