import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './components/Notification'
import { ThemeProvider } from './context/ThemeContext'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Register from './pages/Register'
import Dashboard from './pages/Dashboard'

// Admin pages
import AdminLayout from './components/admin/AdminLayout'
import AdminDashboard from './pages/admin/AdminDashboard'
import CapstoneMainPage from './pages/admin/CapstoneMainPage'
import CapstoneLibrary from './pages/admin/CapstoneLibrary'
import UserManagement from './pages/admin/UserManagement'
import PublishedCapstones from './pages/admin/PublishedCapstones'
import AdminProfile from './pages/admin/AdminProfile'
import ActivityLogs from './pages/admin/ActivityLogs'

// Faculty pages
import FacultyLayout from './components/faculty/FacultyLayout'
import FacultyCapstoneLibrary from './pages/faculty/FacultyCapstoneLibrary'
import FacultyUploadedCapstones from './pages/faculty/FacultyUploadedCapstones'
import FacultyProfile from './pages/faculty/FacultyProfile'

// Student pages
import StudentLayout from './components/student/StudentLayout'
import StudentUploadedCapstones from './pages/student/StudentUploadedCapstones'
import StudentCapstoneMainPage from './pages/student/StudentCapstoneMainPage'
import StudentProfile from './pages/student/StudentProfile'

function AdminRoute({ children }) {
  return (
    <ProtectedRoute roles={['admin']}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  )
}

function FacultyRoute({ children }) {
  return (
    <ProtectedRoute roles={['faculty']}>
      <FacultyLayout>{children}</FacultyLayout>
    </ProtectedRoute>
  )
}

function StudentRoute({ children }) {
  return (
    <ProtectedRoute roles={['student']}>
      <StudentLayout>{children}</StudentLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <NotificationProvider>
          <AuthProvider>
            <Routes>
            {/* Public landing page */}
            <Route path="/" element={<Landing />} />

            {/* Guest-only (redirect to dashboard if logged in) */}
            <Route path="/login" element={<GuestRoute><Login /></GuestRoute>} />
            <Route path="/register" element={<GuestRoute><Register /></GuestRoute>} />

            {/* Protected (must be logged in) */}
            <Route path="/dashboard" element={<ProtectedRoute><Dashboard /></ProtectedRoute>} />

            {/* Admin routes */}
            <Route path="/admin/dashboard" element={<AdminRoute><AdminDashboard /></AdminRoute>} />
            <Route path="/admin/capstones/:id" element={<AdminRoute><CapstoneMainPage /></AdminRoute>} />
            <Route path="/admin/capstone-library" element={<AdminRoute><CapstoneLibrary /></AdminRoute>} />
            <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
            <Route path="/admin/published" element={<AdminRoute><PublishedCapstones /></AdminRoute>} />
            <Route path="/admin/activity-logs" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
            <Route path="/admin/profile" element={<AdminRoute><AdminProfile /></AdminRoute>} />
            <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

            {/* Faculty routes */}
            <Route path="/faculty/capstone-library" element={<FacultyRoute><FacultyCapstoneLibrary /></FacultyRoute>} />
            <Route path="/faculty/uploads" element={<FacultyRoute><FacultyUploadedCapstones /></FacultyRoute>} />
            <Route path="/faculty/capstones/:id" element={<FacultyRoute><CapstoneMainPage /></FacultyRoute>} />
            <Route path="/faculty/profile" element={<FacultyRoute><FacultyProfile /></FacultyRoute>} />
            <Route path="/faculty" element={<Navigate to="/faculty/uploads" replace />} />
            <Route path="/faculty/dashboard" element={<Navigate to="/faculty/uploads" replace />} />

            {/* Student routes */}
            <Route path="/student/uploads" element={<StudentRoute><StudentUploadedCapstones /></StudentRoute>} />
            <Route path="/student/capstones/:id" element={<StudentRoute><StudentCapstoneMainPage /></StudentRoute>} />
            <Route path="/student/profile" element={<StudentRoute><StudentProfile /></StudentRoute>} />
            <Route path="/student" element={<Navigate to="/student/uploads" replace />} />
            </Routes>
          </AuthProvider>
        </NotificationProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
