import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

export default function ProtectedRoute({ children, roles }) {
  const { user, loading } = useAuth()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-[#0f2f1b]">
        <div className="w-10 h-10 border-4 border-[#8BC34A] border-t-transparent rounded-full animate-spin" />
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (roles && !roles.includes(user.role)) {
    if (user.role === 'admin') return <Navigate to="/admin/dashboard" replace />
    if (user.role === 'faculty') return <Navigate to="/faculty/dashboard" replace />
    if (user.role === 'student') return <Navigate to="/student/uploads" replace />
    return <Navigate to="/dashboard" replace />
  }

  return children
}
