/**
 * Sentry initialization for frontend.
 * Set VITE_SENTRY_DSN to enable. No-op when not set.
 */
import * as Sentry from '@sentry/react'

const dsn = import.meta.env?.VITE_SENTRY_DSN?.trim()

export function initSentry() {
  if (!dsn) return
  Sentry.init({
    dsn,
    environment: import.meta.env?.MODE || 'development',
    integrations: [Sentry.browserTracingIntegration()],
    tracesSampleRate: 0.1,
  })
}
