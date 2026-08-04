const features = [
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M14 2H6a2 2 0 00-2 2v16a2 2 0 002 2h12a2 2 0 002-2V8l-6-6zm-1 1.5L18.5 9H13V3.5zM6 20V4h5v7h7v9H6z" />
        <path d="M8 12h8v1.5H8zm0 3h8v1.5H8zm0 3h5v1.5H8z" />
      </svg>
    ),
    title: 'PDF Data Extraction',
    description:
      'Automatically extracts key metadata — title, authors, abstract, keywords, and year — from uploaded PDF capstone files with precision.',
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M15.5 14h-.79l-.28-.27A6.47 6.47 0 0016 9.5 6.5 6.5 0 109.5 16c1.61 0 3.09-.59 4.23-1.57l.27.28v.79l5 4.99L20.49 19l-4.99-5zm-6 0C7.01 14 5 11.99 5 9.5S7.01 5 9.5 5 14 7.01 14 9.5 11.99 14 9.5 14z" />
      </svg>
    ),
    title: 'Intelligent Search',
    description:
      'Search capstone projects by keywords, title, author, or year. Powered by smart indexing for fast and relevant academic results.',
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M12 1L3 5v6c0 5.55 3.84 10.74 9 12 5.16-1.26 9-6.45 9-12V5l-9-4zm0 4a3 3 0 110 6 3 3 0 010-6zm0 14.2c-2.5 0-4.71-1.28-6-3.22c.03-1.99 4-3.08 6-3.08 1.99 0 5.97 1.09 6 3.08-1.29 1.94-3.5 3.22-6 3.22z" />
      </svg>
    ),
    title: 'Role-Based Access',
    description:
      'Secure authentication system with distinct roles for Students, Faculty, and Administrators — each with tailored access and permissions.',
  },
  {
    icon: (
      <svg className="w-7 h-7" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
        <path d="M20 6h-2.18c.07-.44.18-.88.18-1.36C18 2.53 15.47 0 12.36 0c-1.73 0-3.24.82-4.22 2.09L7 3.5l-1.14-1.4C4.88.82 3.37 0 1.64 0L1.5 0C-1.61 0-4 2.39-4 5.5c0 3.78 3.4 6.86 8.55 11.54L12 19.35l3.45-2.31C20.6 12.36 24 9.28 24 5.5 24 2.42 21.58 0 18.5 0z" />
        <path d="M4 6H2v14c0 1.1.9 2 2 2h14v-2H4V6zm16-4H8c-1.1 0-2 .9-2 2v12c0 1.1.9 2 2 2h12c1.1 0 2-.9 2-2V4c0-1.1-.9-2-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
      </svg>
    ),
    title: 'Centralized Digital Repository',
    description:
      'Organized, searchable, and secure online storage for all approved capstone projects — accessible anytime, anywhere.',
  },
]

export default function Features() {
  return (
    <section
      id="features"
      className="py-20 md:py-28 bg-[#0f2f1b]"
      aria-labelledby="features-heading"
    >
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        {/* Header */}
        <div className="text-center mb-14">
          <span className="inline-block text-[#8BC34A] text-xs font-semibold tracking-widest uppercase mb-3">
            What We Offer
          </span>
          <h2
            id="features-heading"
            className="font-poppins font-bold text-3xl sm:text-4xl text-[#F1F8E9] mb-4"
          >
            Core System Features
          </h2>
          <p className="text-[#a5d6a7] max-w-xl mx-auto text-base leading-relaxed">
            EduArchive integrates modern technologies to streamline how capstone research is
            submitted, stored, and discovered at MinSU.
          </p>
        </div>

        {/* Feature Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
          {features.map((feature) => (
            <div
              key={feature.title}
              className="group relative bg-white/5 border border-[#2E7D32]/40 rounded-2xl p-6
                hover:bg-white/10 hover:border-[#8BC34A]/50 hover:-translate-y-1
                transition-all duration-300 shadow-md hover:shadow-lg hover:shadow-green-900/30
                backdrop-blur-sm"
            >
              {/* Top accent line */}
              <div className="absolute top-0 left-6 right-6 h-0.5 bg-gradient-to-r from-transparent via-[#8BC34A]/60 to-transparent rounded-full opacity-0 group-hover:opacity-100 transition-opacity duration-300" aria-hidden="true" />

              <div className="w-12 h-12 rounded-xl bg-[#1B5E20] border border-[#2E7D32] flex items-center justify-center text-[#8BC34A] mb-5 shadow-md">
                {feature.icon}
              </div>
              <h3 className="font-poppins font-semibold text-[#F1F8E9] text-lg mb-2">
                {feature.title}
              </h3>
              <p className="text-[#a5d6a7] text-sm leading-relaxed">{feature.description}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  )
}
