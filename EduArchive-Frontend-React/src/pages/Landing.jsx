import Navbar from '../components/Navbar'
import Hero from '../components/Hero'
import Features from '../components/Features'
import About from '../components/About'
import CTA from '../components/CTA'
import Footer from '../components/Footer'

export default function Landing() {
  return (
    <div style={{ background: 'var(--color-bg)', color: 'var(--color-text)' }}>
      <Navbar />
      <main>
        <Hero />
        <Features />
        <About />
        <CTA />
      </main>
      <Footer />
    </div>
  )
}
