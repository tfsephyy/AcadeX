import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/useAuth'
const destinations = { admin: '/admin/dashboard', faculty: '/faculty/uploads', student: '/student/uploads', visitor: '/visitor/capstones' }
export default function Dashboard() {
  const { user } = useAuth()
  return <Navigate to={destinations[user?.role] || '/login'} replace />
}
