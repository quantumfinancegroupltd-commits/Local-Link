import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    'globalThis.__LOCAL_LINK_BUILD_TIME__': JSON.stringify(new Date().toISOString()),
    'globalThis.__LOCAL_LINK_BUILD_ID__': JSON.stringify(process.env.VITE_BUILD_ID || process.env.GITHUB_SHA || ''),
  },
  server: {
    // Use 5173 (Vite default). Port 5060 is blocked by Chromium as unsafe.
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
