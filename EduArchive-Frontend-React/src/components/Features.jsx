import { useId, useState } from 'react'
import { HiOutlineSearch, HiOutlineDocumentText, HiOutlineLibrary, HiOutlineShieldCheck, HiOutlineChatAlt2, HiOutlineClipboardList, HiOutlineBookmark } from 'react-icons/hi'

const paths = [
  { id: 'discover', label: 'Discover research', introduction: 'Build on the work that came before yours.', items: [
    { Icon: HiOutlineSearch, title: 'Find a useful starting point', text: 'Search titles, authors, and keywords, with related search suggestions. Filter the collection by year, program, or category.' },
    { Icon: HiOutlineBookmark, title: 'Keep your references close', text: 'Save relevant capstones, read the documents available to your account, and use citation tools as you develop your own work.' },
  ] },
  { id: 'submit', label: 'Submit your work', introduction: 'Give your capstone a place in the collection.', items: [
    { Icon: HiOutlineDocumentText, title: 'Start with your PDF', text: 'Upload your document and get metadata suggestions from text or scanned pages. Review the title, authors, abstract, and keywords before submitting.' },
    { Icon: HiOutlineClipboardList, title: 'Follow the review process', text: 'Complete your project information, submit for review, and follow its status in your library. Keep the document and supporting resources together.' },
  ] },
  { id: 'manage', label: 'Review & manage', introduction: 'Keep the academic collection well maintained.', items: [
    { Icon: HiOutlineLibrary, title: 'Support the research lifecycle', text: 'Faculty review assigned student work. Administrators oversee accounts, submissions, publication, and repository activity.' },
    { Icon: HiOutlineShieldCheck, title: 'Make access intentional', text: 'Role-based permissions and document access rules keep each account connected to the information and tools it is permitted to use.' },
  ] },
]
export default function Features() {
  const [selected, setSelected] = useState(0)
  const baseId = useId()
  const handleTabKey = e => {
    let next
    if (e.key === 'ArrowRight') next = (selected + 1) % paths.length
    if (e.key === 'ArrowLeft') next = (selected + paths.length - 1) % paths.length
    if (e.key === 'Home') next = 0
    if (e.key === 'End') next = paths.length - 1
    if (next !== undefined) { e.preventDefault(); setSelected(next); e.currentTarget.parentElement.children[next].focus() }
  }
  return <section id="features" className="site-section repository-features" aria-labelledby="features-heading"><div className="site-container">
    <div className="section-heading"><p className="section-kicker">The repository</p><h2 id="features-heading">Research, within reach.</h2><p>From a first reference to a finished capstone, find the tools for your next step.</p></div>
    <div className="repository-paths">
      <div className="repository-path-tabs" role="tablist" aria-label="Ways to use AcadeX">{paths.map((item, i) => <button key={item.id} type="button" role="tab" id={`${baseId}-${item.id}-tab`} aria-controls={`${baseId}-${item.id}-panel`} aria-selected={selected === i} tabIndex={selected === i ? 0 : -1} onClick={() => setSelected(i)} onKeyDown={handleTabKey}>{item.label}</button>)}</div>
      {paths.map((item, i) => <div key={item.id} role="tabpanel" id={`${baseId}-${item.id}-panel`} aria-labelledby={`${baseId}-${item.id}-tab`} tabIndex={0} hidden={selected !== i} className="repository-path-panel"><p className="path-introduction">{item.introduction}</p><div className="feature-list">{item.items.map(({ Icon, title, text }) => <article key={title} className="repository-feature"><Icon aria-hidden="true" /><div><h3>{title}</h3><p>{text}</p></div></article>)}</div></div>)}
      <p className="repository-help"><HiOutlineChatAlt2 aria-hidden="true" /><span>The repository assistant can help you navigate and discover research available to your account.</span></p>
    </div>
  </div></section>
}
