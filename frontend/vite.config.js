import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// Inject a build fingerprint into index.html so deploy can be verified (View Page Source).
function buildFingerprint() {
  return {
    name: 'build-fingerprint',
    transformIndexHtml(html) {
      const ts = new Date().toISOString()
      return html.replace('</body>', `<!-- build ${ts} -->\n  </body>`)
    },
  }
}

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), buildFingerprint()],
  server: {
    // Use 5173 (Vite default). Port 5060 is blocked by Chromium as unsafe.
    port: 5173,
    proxy: {
      '/api': 'http://localhost:4000',
    },
  },
})
