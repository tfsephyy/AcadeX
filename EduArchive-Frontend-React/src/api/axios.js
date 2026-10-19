import axios from 'axios'
import { resolveApiBaseUrl } from './baseUrl'

const api = axios.create({
  baseURL: resolveApiBaseUrl(import.meta.env.VITE_API_BASE_URL, import.meta.env.PROD),
  withCredentials: true, // send cookies with every request
  headers: {
    'Content-Type': 'application/json',
    Accept: 'application/json',
  },
})

let csrfToken = null
let csrfRequest = null

// Host-only API cookies cannot be read by a sibling frontend hostname.
// Fetch Laravel's session-bound CSRF token as JSON and retain it in memory.
api.interceptors.request.use(async (config) => {
  if (['post', 'put', 'patch', 'delete'].includes(config.method?.toLowerCase())) {
    if (!csrfToken) {
      csrfRequest ??= api.get('/csrf-token').then(({ data }) => {
        csrfToken = data.csrf_token
      }).finally(() => { csrfRequest = null })
      await csrfRequest
    }
    config.headers['X-CSRF-TOKEN'] = csrfToken
  }
  return config
})

// Response interceptor — redirect to login on 401
api.interceptors.response.use(
  (response) => {
    if (response.data?.data?.csrf_token) csrfToken = response.data.data.csrf_token
    return response
  },
  (error) => {
    if ([401, 419].includes(error.response?.status)) csrfToken = null
    if (error.response?.status === 401) {
      // Only redirect if not already on login/register
      const path = window.location.pathname
      if (path !== '/' && path !== '/login' && path !== '/register') {
        window.location.href = '/login'
      }
    }
    return Promise.reject(error)
  }
)

export default api
