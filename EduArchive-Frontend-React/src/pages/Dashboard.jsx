import { useAuth } from '../context/AuthContext'
import { useNavigate } from 'react-router-dom'

export default function Dashboard() {
  const { user, logout } = useAuth()
  const navigate = useNavigate()

  const handleLogout = async () => {
    await logout()
    navigate('/', { replace: true })
  }

  return (
    <div
      className="min-h-screen"
      style={{ background: 'linear-gradient(135deg, #0f2f1b 0%, #1B5E20 60%, #2E7D32 100%)' }}
    >
      {/* Top Bar */}
      <header className="bg-[#0f2f1b]/90 backdrop-blur-md border-b border-[#2E7D32]/40 shadow-lg">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="flex items-center justify-center w-8 h-8 rounded-lg bg-[#8BC34A]">
              <svg xmlns="http://www.w3.org/2000/svg" className="w-4 h-4 text-[#0f2f1b]" viewBox="0 0 24 24" fill="currentColor">
                <path d="M4 6H2v14a2 2 0 002 2h14v-2H4V6zm16-4H8a2 2 0 00-2 2v12a2 2 0 002 2h12a2 2 0 002-2V4a2 2 0 00-2-2zm-1 9H9V9h10v2zm-4 4H9v-2h6v2zm4-8H9V5h10v2z" />
              </svg>
            </div>
            <span className="font-poppins font-bold text-lg text-[#F1F8E9]">
              Edu<span className="text-[#8BC34A]">Archive</span>
            </span>
          </div>

          <div className="flex items-center gap-4">
            <div className="text-right hidden sm:block">
              <p className="text-[#F1F8E9] text-sm font-medium">{user?.name}</p>
              <p className="text-[#8BC34A] text-xs capitalize">{user?.role}</p>
            </div>
            <button
              onClick={handleLogout}
              className="px-4 py-2 rounded-xl text-sm font-semibold text-[#F1F8E9] bg-red-600/80
                hover:bg-red-600 transition-all duration-200"
            >
              Logout
            </button>
          </div>
        </div>
      </header>

      {/* Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10">
        <div className="mb-8">
          <h1 className="font-poppins font-bold text-2xl sm:text-3xl text-[#F1F8E9]">
            Welcome back, <span className="text-[#8BC34A]">{user?.name}</span>
          </h1>
          <p className="text-[#a5d6a7] text-sm mt-1">
            Logged in as <span className="font-medium capitalize text-[#c8e6c9]">{user?.role}</span>
            {' · '}{user?.id_number}
          </p>
        </div>

        {/* Info Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
          <InfoCard
            title="Profile"
            items={[
              ['Name', user?.name],
              ['Username', user?.username],
              ['Email', user?.email],
              ['ID Number', user?.id_number],
              ['Role', user?.role],
            ]}
          />

          {user?.student_profile && (
            <InfoCard
              title="Student Profile"
              items={[
                ['Program', user.student_profile.program],
                ['Year', user.student_profile.year],
                ['Section', user.student_profile.section],
              ]}
            />
          )}

          <div className="bg-white/5 backdrop-blur-sm border border-[#2E7D32]/40 rounded-2xl p-6 shadow-md">
            <h3 className="font-poppins font-semibold text-[#F1F8E9] text-base mb-4">Quick Actions</h3>
            <div className="space-y-2">
              <ActionButton label="Browse Capstone Projects" />
              <ActionButton label="Upload Research" />
              <ActionButton label="Search Repository" />
            </div>
          </div>
        </div>
      </main>
    </div>
  )
}

function InfoCard({ title, items }) {
  return (
    <div className="bg-white/5 backdrop-blur-sm border border-[#2E7D32]/40 rounded-2xl p-6 shadow-md">
      <h3 className="font-poppins font-semibold text-[#F1F8E9] text-base mb-4">{title}</h3>
      <dl className="space-y-2">
        {items.map(([label, value]) => (
          <div key={label} className="flex justify-between text-sm">
            <dt className="text-[#a5d6a7]">{label}</dt>
            <dd className="text-[#F1F8E9] font-medium capitalize">{value || '—'}</dd>
          </div>
        ))}
      </dl>
    </div>
  )
}

function ActionButton({ label }) {
  return (
    <button
      className="w-full text-left px-4 py-3 rounded-xl bg-white/5 border border-[#2E7D32]/30
        text-[#c8e6c9] text-sm hover:bg-white/10 hover:border-[#8BC34A]/40 hover:text-[#F1F8E9]
        transition-all duration-200"
    >
      {label}
    </button>
  )
}
