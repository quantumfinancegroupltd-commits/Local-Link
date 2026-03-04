import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  define: {
    '__BUILD_ID__': JSON.stringify(new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)),
  },
  server: {
    // Use 5173 (Vite default). Port 5060 is blocked by Chromium as unsafe.
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
