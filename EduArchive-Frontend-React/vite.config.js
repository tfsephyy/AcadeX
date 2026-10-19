import { defineConfig, loadEnv } from 'vite'
import { resolveApiBaseUrl } from './src/api/baseUrl.js'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig(({ command, mode }) => {
  const env = loadEnv(mode, process.cwd(), '')
  resolveApiBaseUrl(env.VITE_API_BASE_URL, command === 'build')
  return {
  plugins: [
    react(),
    tailwindcss(),
  ],
  }
})
