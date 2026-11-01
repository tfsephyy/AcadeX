import { lazy, Suspense } from 'react'
import Loading from './components/Loading'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext'
import { NotificationProvider } from './components/Notification'
import { ThemeProvider } from './context/ThemeContext'
import { ChatbotProvider } from './context/ChatbotContext'
import ProtectedRoute from './components/ProtectedRoute'
import GuestRoute from './components/GuestRoute'
import Landing from './pages/Landing'
const Login = lazy(() => import('./pages/Login'))
const Register = lazy(() => import('./pages/Register'))
const Dashboard = lazy(() => import('./pages/Dashboard'))
import RouteTitle from './components/RouteTitle'
import NotFound from './pages/NotFound'

// Admin pages
const AdminLayout = lazy(() => import('./components/admin/AdminLayout'))
const AdminDashboard = lazy(() => import('./pages/admin/AdminDashboard'))
const CapstoneMainPage = lazy(() => import('./pages/admin/CapstoneMainPage'))
const CapstoneLibrary = lazy(() => import('./pages/admin/CapstoneLibrary'))
const UserManagement = lazy(() => import('./pages/admin/UserManagement'))
const PublishedCapstones = lazy(() => import('./pages/admin/PublishedCapstones'))
const AdminProfile = lazy(() => import('./pages/admin/AdminProfile'))
const ActivityLogs = lazy(() => import('./pages/admin/ActivityLogs'))
const CapstoneApproval = lazy(() => import('./pages/admin/CapstoneApproval'))

// Faculty pages
const FacultyLayout = lazy(() => import('./components/faculty/FacultyLayout'))
const FacultyCapstoneLibrary = lazy(() => import('./pages/faculty/FacultyCapstoneLibrary'))
const FacultyUploadedCapstones = lazy(() => import('./pages/faculty/FacultyUploadedCapstones'))
const FacultyProfile = lazy(() => import('./pages/faculty/FacultyProfile'))
const FacultyCapstoneApproval = lazy(() => import('./pages/faculty/FacultyCapstoneApproval'))

// Student pages
const StudentLayout = lazy(() => import('./components/student/StudentLayout'))
const StudentUploadedCapstones = lazy(() => import('./pages/student/StudentUploadedCapstones'))
const StudentCapstoneMainPage = lazy(() => import('./pages/student/StudentCapstoneMainPage'))
const StudentCapstoneLibrary = lazy(() => import('./pages/student/StudentCapstoneLibrary'))
const StudentProfile = lazy(() => import('./pages/student/StudentProfile'))
const StudentCapstoneAdditionalInfoPage = lazy(() => import('./pages/student/StudentCapstoneAdditionalInfoPage'))

// Faculty extra pages
const CapstoneAdditionalInfoPage = lazy(() => import('./pages/faculty/CapstoneAdditionalInfoPage'))

// Admin extra pages
const AdminCapstoneAdditionalInfoPage = lazy(() => import('./pages/admin/AdminCapstoneAdditionalInfoPage'))

// Shared
const ReviewExtractedDataPage = lazy(() => import('./components/ReviewExtractedDataPage'))

// Visitor pages
const VisitorLayout = lazy(() => import('./components/visitor/VisitorLayout'))
const VisitorCapstones = lazy(() => import('./pages/visitor/VisitorCapstones'))
const VisitorCapstoneMainPage = lazy(() => import('./pages/visitor/VisitorCapstoneMainPage'))
const VisitorProfile = lazy(() => import('./pages/visitor/VisitorProfile'))

function AdminRoute({ children }) {
  return (
    <ProtectedRoute roles={['admin']}>
      <AdminLayout>{children}</AdminLayout>
    </ProtectedRoute>
  )
}

// Used for full-page admin flows that render without the sidebar
function AdminBareRoute({ children }) {
  return (
    <ProtectedRoute roles={['admin']}>
      {children}
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

// Full-page faculty flows without the sidebar
function FacultyBareRoute({ children }) {
  return (
    <ProtectedRoute roles={['faculty']}>
      {children}
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

// Full-page student flows without the sidebar
function StudentBareRoute({ children }) {
  return (
    <ProtectedRoute roles={['student']}>
      {children}
    </ProtectedRoute>
  )
}

function VisitorRoute({ children }) {
  return (
    <ProtectedRoute roles={['visitor']}>
      <VisitorLayout>{children}</VisitorLayout>
    </ProtectedRoute>
  )
}

function App() {
  return (
    <ThemeProvider>
      <BrowserRouter>
        <RouteTitle />
        <NotificationProvider>
          <AuthProvider>
            <ChatbotProvider>
              <Suspense fallback={<Loading text="Loading page…" />}><Routes>
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
                <Route path="/admin/capstone-library/review-data" element={<AdminBareRoute><ReviewExtractedDataPage nextPath="/admin/capstone-library/upload-details" backPath="/admin/capstone-library" /></AdminBareRoute>} />
                <Route path="/admin/capstone-library/upload-details" element={<AdminBareRoute><AdminCapstoneAdditionalInfoPage /></AdminBareRoute>} />
                <Route path="/admin/users" element={<AdminRoute><UserManagement /></AdminRoute>} />
                <Route path="/admin/published" element={<AdminRoute><PublishedCapstones /></AdminRoute>} />
                <Route path="/admin/approvals" element={<AdminRoute><CapstoneApproval /></AdminRoute>} />
                <Route path="/admin/activity-logs" element={<AdminRoute><ActivityLogs /></AdminRoute>} />
                <Route path="/admin/profile" element={<AdminRoute><AdminProfile /></AdminRoute>} />
                <Route path="/admin" element={<Navigate to="/admin/dashboard" replace />} />

                {/* Faculty routes */}
                <Route path="/faculty/capstone-library" element={<FacultyRoute><FacultyCapstoneLibrary /></FacultyRoute>} />
                <Route path="/faculty/capstone-library/review-data" element={<FacultyBareRoute><ReviewExtractedDataPage nextPath="/faculty/capstone-library/upload-details" backPath="/faculty/capstone-library" /></FacultyBareRoute>} />
                <Route path="/faculty/capstone-library/upload-details" element={<FacultyBareRoute><CapstoneAdditionalInfoPage /></FacultyBareRoute>} />
                <Route path="/faculty/uploads" element={<FacultyRoute><FacultyUploadedCapstones /></FacultyRoute>} />
                <Route path="/faculty/approvals" element={<FacultyRoute><FacultyCapstoneApproval /></FacultyRoute>} />
                <Route path="/faculty/capstones/:id" element={<FacultyRoute><CapstoneMainPage /></FacultyRoute>} />
                <Route path="/faculty/profile" element={<FacultyRoute><FacultyProfile /></FacultyRoute>} />
                <Route path="/faculty" element={<Navigate to="/faculty/uploads" replace />} />
                <Route path="/faculty/dashboard" element={<Navigate to="/faculty/uploads" replace />} />

                {/* Student routes */}
                <Route path="/student/uploads" element={<StudentRoute><StudentUploadedCapstones /></StudentRoute>} />
                <Route path="/student/capstone-library" element={<StudentRoute><StudentCapstoneLibrary /></StudentRoute>} />
                <Route path="/student/capstone-library/review-data" element={<StudentBareRoute><ReviewExtractedDataPage nextPath="/student/capstone-library/upload-details" backPath="/student/capstone-library" /></StudentBareRoute>} />
                <Route path="/student/capstone-library/upload-details" element={<StudentBareRoute><StudentCapstoneAdditionalInfoPage /></StudentBareRoute>} />
                <Route path="/student/capstones/:id" element={<StudentRoute><StudentCapstoneMainPage /></StudentRoute>} />
                <Route path="/student/profile" element={<StudentRoute><StudentProfile /></StudentRoute>} />
                <Route path="/student" element={<Navigate to="/student/uploads" replace />} />

                {/* Visitor routes */}
                <Route path="/visitor/capstones" element={<VisitorRoute><VisitorCapstones /></VisitorRoute>} />
                <Route path="/visitor/capstones/:id" element={<VisitorRoute><VisitorCapstoneMainPage /></VisitorRoute>} />
                <Route path="/visitor/saved" element={<VisitorRoute><VisitorCapstones /></VisitorRoute>} />
                <Route path="/visitor/profile" element={<VisitorRoute><VisitorProfile /></VisitorRoute>} />
                <Route path="/visitor" element={<Navigate to="/visitor/capstones" replace />} />
                <Route path="*" element={<NotFound />} />
              </Routes></Suspense>
            </ChatbotProvider>
          </AuthProvider>
        </NotificationProvider>
      </BrowserRouter>
    </ThemeProvider>
  )
}

export default App
