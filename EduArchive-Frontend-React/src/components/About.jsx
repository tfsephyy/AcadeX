const bullets = [
  'Faster retrieval of research documents and records',
  'Prevents physical document loss and deterioration',
  'Supports MinSU\'s digital transformation roadmap',
  'Encourages knowledge sharing and academic collaboration',
]

export default function About() {
  return (
    <section
      id="about"
      className="py-20 md:py-28"
      style={{ background: 'linear-gradient(180deg, #0f2f1b 0%, #122d19 100%)' }}
      aria-labelledby="about-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex flex-col lg:flex-row items-center gap-12 lg:gap-20">

          {/* Left — Image */}
          <div className="flex-1 w-full max-w-lg mx-auto lg:max-w-none">
            <div className="relative">
              <img
                src="https://images.unsplash.com/photo-1488190211105-8b0e65b80b4e?w=800&q=80&auto=format&fit=crop"
                alt="Academic research and archiving"
                className="w-full h-72 sm:h-80 lg:h-[440px] object-cover rounded-2xl shadow-2xl"
                loading="lazy"
              />
              {/* Overlay badge */}
              <div className="absolute bottom-6 right-6 bg-[#1B5E20]/90 backdrop-blur-md border border-[#8BC34A]/30 rounded-xl p-4 shadow-xl max-w-[200px]">
                <p className="text-[#8BC34A] font-bold text-2xl font-poppins">2026</p>
                <p className="text-[#c8e6c9] text-xs mt-1">Launched at Mindoro State University</p>
              </div>
              {/* Subtle border glow */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl pointer-events-none"
                style={{ boxShadow: 'inset 0 0 0 1px rgba(139,195,74,0.15)' }}
              />
            </div>
          </div>

          {/* Right — Content */}
          <div className="flex-1">
            <span className="inline-block text-[#8BC34A] text-xs font-semibold tracking-widest uppercase mb-3">
              About the System
            </span>
            <h2
              id="about-heading"
              className="font-poppins font-bold text-3xl sm:text-4xl text-[#F1F8E9] leading-tight mb-6"
            >
              Solving the Problem of{' '}
              <span className="text-[#8BC34A]">Unorganized Research Archives</span>
            </h2>
            <p className="text-[#a5d6a7] text-base leading-relaxed mb-6">
              EduArchive addresses the long-standing problem of manual and unorganized storage of
              capstone projects at Mindoro State University. Printed copies scattered across
              departments and unindexed digital folders made research retrieval slow, unreliable,
              and prone to permanent loss.
            </p>
            <p className="text-[#a5d6a7] text-base leading-relaxed mb-8">
              By replacing these outdated processes with a centralized digital repository powered by
              intelligent PDF data extraction, EduArchive enhances accessibility, ensures long-term
              preservation, and fosters a culture of academic collaboration within the university.
            </p>

            {/* Bullet Points */}
            <ul className="space-y-3" aria-label="Key benefits">
              {bullets.map((point) => (
                <li key={point} className="flex items-start gap-3">
                  <span
                    className="mt-1 flex-shrink-0 w-5 h-5 rounded-full bg-[#8BC34A]/20 border border-[#8BC34A]/40 flex items-center justify-center"
                    aria-hidden="true"
                  >
                    <svg className="w-3 h-3 text-[#8BC34A]" viewBox="0 0 24 24" fill="currentColor">
                      <path d="M9 16.17L4.83 12l-1.42 1.41L9 19 21 7l-1.41-1.41L9 16.17z" />
                    </svg>
                  </span>
                  <span className="text-[#c8e6c9] text-sm leading-relaxed">{point}</span>
                </li>
              ))}
            </ul>
          </div>

        </div>
      </div>
    </section>
  )
}
