import { useEffect } from 'react'
import { useLocation } from 'react-router-dom'
const titles = {
  '/': 'Capstone Repository', login: 'Sign in', register: 'Create an account', dashboard: 'Dashboard',
  privacy: 'Privacy Policy', terms: 'Terms of Service',
  users: 'User management', published: 'Uploaded capstones', uploads: 'Uploaded capstones',
  'capstone-library': 'Capstone library', 'activity-logs': 'Activity logs', approvals: 'Pending approvals',
  profile: 'Your profile', 'review-data': 'Review extracted details', 'upload-details': 'Submission details',
  saved: 'Saved capstones', capstones: 'Capstone collection',
}
export default function RouteTitle() {
  const { pathname } = useLocation()
  useEffect(() => {
    const last = pathname.split('/').filter(Boolean).at(-1)
    const name = /\/capstones\/\d+$/.test(pathname) ? 'Capstone details' : titles[last || '/'] || 'Page not found'
    document.title = `${name} · AcadeX · Mindoro State University`
  }, [pathname])
  return null
}
