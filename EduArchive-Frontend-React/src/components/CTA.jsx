import { Link } from 'react-router-dom'

export default function CTA() {
  return (
    <section
      className="py-20 md:py-28 relative overflow-hidden"
      style={{ background: 'linear-gradient(135deg, #1B5E20 0%, #0f2f1b 100%)' }}
      aria-labelledby="cta-heading"
    >
      {/* Decorative elements */}
      <div
        aria-hidden="true"
        className="absolute top-[-40%] right-[-10%] w-[400px] h-[400px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #8BC34A, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-40%] left-[-10%] w-[400px] h-[400px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #2E7D32, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-3xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
        <span className="inline-block text-[#8BC34A] text-xs font-semibold tracking-widest uppercase mb-4">
          Ready to Get Started?
        </span>
        <h2
          id="cta-heading"
          className="font-poppins font-bold text-3xl sm:text-4xl text-[#F1F8E9] mb-5 leading-tight"
        >
          Start Exploring Academic Research Today
        </h2>
        <p className="text-[#a5d6a7] text-base leading-relaxed mb-8 max-w-xl mx-auto">
          Join EduArchive and gain instant access to a growing repository of capstone projects
          from Mindoro State University. Research smarter, collaborate better.
        </p>
        <Link
          to="/register"
          className="inline-block px-10 py-4 rounded-xl bg-[#8BC34A] text-[#0f2f1b] font-bold text-sm
            hover:bg-[#a5d65e] shadow-lg shadow-green-900/40 hover:shadow-green-900/60
            hover:-translate-y-0.5 transition-all duration-200"
        >
          Create Account
        </Link>
      </div>
    </section>
  )
}
