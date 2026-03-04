import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import './index.css'
import App from './App.jsx'
import { initSentry } from './lib/sentry.js'

initSentry()

try {
  document.body.dataset.build = typeof __BUILD_ID__ !== 'undefined' ? __BUILD_ID__ : 'dev'
} catch (_) {}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <BrowserRouter>
      <App />
    </BrowserRouter>
  </StrictMode>,
)
