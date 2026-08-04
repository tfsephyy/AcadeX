import { Link } from 'react-router-dom'

export default function Hero() {
  return (
    <section
      id="home"
      className="relative min-h-screen flex items-center overflow-hidden"
      style={{
        background: 'linear-gradient(135deg, #0f2f1b 0%, #1B5E20 60%, #2E7D32 100%)',
      }}
    >
      {/* Background decorative blobs */}
      <div
        aria-hidden="true"
        className="absolute top-[-10%] right-[-5%] w-[500px] h-[500px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #8BC34A, transparent 70%)' }}
      />
      <div
        aria-hidden="true"
        className="absolute bottom-[-15%] left-[-10%] w-[600px] h-[600px] rounded-full opacity-10"
        style={{ background: 'radial-gradient(circle, #2E7D32, transparent 70%)' }}
      />

      <div className="relative z-10 max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 pt-24 pb-16 md:pt-32 md:pb-24">
        <div className="flex flex-col-reverse lg:flex-row items-center gap-12 lg:gap-16">

          {/* Left — Content */}
          <div className="flex-1 text-center lg:text-left">
            {/* Badge */}
            <div className="inline-flex items-center gap-2 px-4 py-1.5 rounded-full bg-[#8BC34A]/15 border border-[#8BC34A]/30 mb-6">
              <span className="w-2 h-2 rounded-full bg-[#8BC34A] animate-pulse" aria-hidden="true" />
              <span className="text-[#8BC34A] text-xs font-semibold tracking-widest uppercase">
                Mindoro State University
              </span>
            </div>

            <h1 className="font-poppins font-bold text-3xl sm:text-4xl lg:text-5xl xl:text-6xl text-[#F1F8E9] leading-tight mb-6">
              Preserving Capstone Projects Through{' '}
              <span className="text-[#8BC34A]">Smart Digital Archiving</span>
            </h1>

            <p className="text-[#c8e6c9] text-base sm:text-lg leading-relaxed mb-8 max-w-xl mx-auto lg:mx-0">
              EduArchive is a web-based capstone project mining system that uses PDF data extraction
              and repository integration to improve research accessibility at Mindoro State University.
            </p>

            <div className="flex flex-col sm:flex-row gap-4 justify-center lg:justify-start">
              <Link
                to="/login"
                className="px-8 py-3.5 rounded-xl bg-[#2E7D32] text-[#F1F8E9] font-semibold text-sm
                  hover:bg-[#388e3c] shadow-lg shadow-green-900/40 hover:shadow-green-900/60
                  transition-all duration-200 hover:-translate-y-0.5 text-center"
              >
                Get Started
              </Link>
              <a
                href="#features"
                className="px-8 py-3.5 rounded-xl border border-[#8BC34A]/50 text-[#8BC34A] font-semibold text-sm
                  hover:bg-[#8BC34A]/10 hover:border-[#8BC34A]
                  transition-all duration-200 hover:-translate-y-0.5"
              >
                Learn More
              </a>
            </div>

            {/* Stats Row */}
            <div className="mt-12 flex flex-wrap gap-6 justify-center lg:justify-start">
              {[
                { value: '500+', label: 'Capstone Projects' },
                { value: '1,200+', label: 'Students Served' },
                { value: '100%', label: 'Digital & Secure' },
              ].map((stat) => (
                <div key={stat.label} className="text-center lg:text-left">
                  <div className="font-poppins font-bold text-2xl text-[#8BC34A]">{stat.value}</div>
                  <div className="text-[#a5d6a7] text-xs mt-0.5">{stat.label}</div>
                </div>
              ))}
            </div>
          </div>

          {/* Right — Image */}
          <div className="flex-1 flex justify-center lg:justify-end w-full max-w-lg lg:max-w-none">
            <div className="relative w-full max-w-md lg:max-w-lg">
              {/* Glow ring */}
              <div
                aria-hidden="true"
                className="absolute inset-0 rounded-2xl"
                style={{
                  boxShadow: '0 0 60px 20px rgba(139, 195, 74, 0.12)',
                }}
              />
              <img
                src="https://images.unsplash.com/photo-1541339907198-e08756dedf3f?w=800&q=80&auto=format&fit=crop"
                alt="Students studying at Mindoro State University"
                className="w-full h-72 sm:h-80 lg:h-[480px] object-cover rounded-2xl shadow-2xl"
                loading="eager"
              />
              {/* Floating card */}
              <div className="absolute -bottom-5 -left-5 bg-[#1B5E20]/90 backdrop-blur-md border border-[#8BC34A]/30 rounded-xl p-4 shadow-xl">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-lg bg-[#8BC34A]/20 flex items-center justify-center">
                    <svg className="w-5 h-5 text-[#8BC34A]" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  </div>
                  <div>
                    <p className="text-[#F1F8E9] text-xs font-semibold">PDF Extraction</p>
                    <p className="text-[#a5d6a7] text-xs">Automated &amp; Instant</p>
                  </div>
                </div>
              </div>
              {/* Floating badge */}
              <div className="absolute -top-4 -right-4 bg-[#2E7D32] rounded-xl px-3 py-2 shadow-lg border border-[#8BC34A]/20">
                <p className="text-[#F1F8E9] text-xs font-bold">MinSU Capstone</p>
                <p className="text-[#8BC34A] text-xs">Digital Repository</p>
              </div>
            </div>
          </div>

        </div>
      </div>

      {/* Wave divider */}
      <div className="absolute bottom-0 left-0 right-0 overflow-hidden leading-none" aria-hidden="true">
        <svg
          viewBox="0 0 1440 60"
          xmlns="http://www.w3.org/2000/svg"
          className="w-full h-12 sm:h-16"
          preserveAspectRatio="none"
        >
          <path
            fill="#0f2f1b"
            d="M0,40 C360,80 1080,0 1440,40 L1440,60 L0,60 Z"
          />
        </svg>
      </div>
    </section>
  )
}
