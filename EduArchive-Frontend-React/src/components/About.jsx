import { HiOutlineAcademicCap, HiOutlineBookOpen, HiOutlineUserGroup, HiOutlineCog } from 'react-icons/hi'

const roles = [
  { Icon: HiOutlineAcademicCap, name: 'Students', text: 'Submit capstone work, review extracted details, and follow the status of your submissions.' },
  { Icon: HiOutlineUserGroup, name: 'Faculty', text: 'Manage your projects and review student submissions assigned to you as an adviser.' },
  { Icon: HiOutlineCog, name: 'Administrators', text: 'Oversee accounts, review submissions, and maintain the repository and its activity records.' },
  { Icon: HiOutlineBookOpen, name: 'Visitors', text: 'Discover approved research and read the documents made available to your account.' },
]
const steps = [
  ['Upload your document', 'Select a capstone PDF of up to 128 MiB. Scanned documents can be processed, too.'],
  ['Review the details', 'Check suggested metadata and add the required information. Large PDFs use the first 12 pages for suggestions.'],
  ['Submit for review', 'Complete the existing submission process and follow your project’s review status in your library.'],
  ['Discover and reference', 'Explore approved research, view available documents, and use the repository’s citation tools.'],
]
export default function About() {
  return <>
    <section id="about" className="site-section" aria-labelledby="about-heading"><div className="site-container about-layout">
      <div className="section-heading"><p className="section-kicker">Our academic community</p><h2 id="about-heading">Keep knowledge connected.</h2><p>AcadeX helps the Mindoro State University community keep capstone research organized, discoverable, and available according to its access permissions.</p><p>Each role has a clear place in the work, from a first submission to a maintained research collection.</p></div>
      <div className="role-list">{roles.map(({ Icon, name, text }) => <article key={name}><Icon aria-hidden="true" /><div><h3>{name}</h3><p>{text}</p></div></article>)}</div>
    </div></section>
    <section id="process" className="site-section repository-process" aria-labelledby="process-heading"><div className="site-container">
      <div className="section-heading"><p className="section-kicker">How it works</p><h2 id="process-heading">From submission to discovery.</h2><p>A guided process, with the opportunity to check your work along the way.</p></div>
      <ol className="process-list">{steps.map(([title, text], i) => <li key={title}><span className="process-number" aria-hidden="true">{i + 1}</span><h3>{title}</h3><p>{text}</p></li>)}</ol>
    </div></section>
  </>
}
