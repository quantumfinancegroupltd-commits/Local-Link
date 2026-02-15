import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
import * as Sentry from '@sentry/node'
import { env, corsOrigins } from './config.js'
import { requestContext } from './middleware/requestContext.js'
import { authRouter } from './routes/auth.js'
import { jobsRouter } from './routes/jobs.js'
import { quotesRouter } from './routes/quotes.js'
import { artisansRouter } from './routes/artisans.js'
import { productsRouter } from './routes/products.js'
import { ordersRouter } from './routes/orders.js'
import { adminRouter } from './routes/admin.js'
import { walletsRouter } from './routes/wallets.js'
import { escrowRouter } from './routes/escrow.js'
import { subscriptionsRouter } from './routes/subscriptions.js'
import { webhooksRouter } from './routes/webhooks.js'
import { pool } from './db/pool.js'
import { bootstrapRouter } from './routes/bootstrap.js'
import { uploadsRouter } from './routes/uploads.js'
import { driversRouter } from './routes/drivers.js'
import { deliveriesRouter } from './routes/deliveries.js'
import { messagesRouter } from './routes/messages.js'
import { reviewsRouter } from './routes/reviews.js'
import { farmersRouter } from './routes/farmers.js'
import { verificationRouter } from './routes/verification.js'
import { profileRouter } from './routes/profile.js'
import { postsRouter } from './routes/posts.js'
import { matchRouter } from './routes/match.js'
import { deliveryQuoteRouter } from './routes/deliveryQuote.js'
import { featuresRouter } from './routes/features.js'
import { notificationsRouter } from './routes/notifications.js'
import { supportRouter } from './routes/support.js'
import { trustRouter } from './routes/trust.js'
import { idVerificationRouter } from './routes/idVerification.js'
import { corporateRouter } from './routes/corporate.js'
import { newsRouter } from './routes/news.js'
import { followsRouter } from './routes/follows.js'
import { endorsementsRouter } from './routes/endorsements.js'

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

  if (env.SENTRY_DSN?.trim()) {
    Sentry.init({
      dsn: env.SENTRY_DSN,
      environment: env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    })
    app.use(Sentry.Handlers.requestHandler())
    app.use(Sentry.Handlers.tracingHandler())
  }

  app.use(requestContext)
  app.use(
    pinoHttp({
      quietReqLogger: true,
      genReqId: (req) => req.id,
      customProps: (req) => ({ reqId: req.id }),
    }),
  )

  app.use(
    helmet({
      crossOriginResourcePolicy: { policy: 'cross-origin' },
    }),
  )

  const origins = corsOrigins()
  app.use(
    cors({
      origin: (origin, cb) => {
        if (!origin) return cb(null, true) // curl / server-to-server
        if (env.NODE_ENV !== 'production') return cb(null, true)
        if (origins.includes(origin)) return cb(null, true)
        return cb(new Error('Not allowed by CORS'))
      },
      credentials: true,
    }),
  )

  app.use(
    rateLimit({
      windowMs: 60_000,
      limit: 300,
      skip: () => env.NODE_ENV !== 'production',
      standardHeaders: 'draft-7',
      legacyHeaders: false,
    }),
  )

  // IMPORTANT: webhooks must be registered BEFORE express.json so we can verify signatures using raw body.
  app.use('/api/webhooks', webhooksRouter)

  // Allow small base64 uploads (job photos). For large/production uploads use object storage.
  app.use(express.json({ limit: '6mb' }))

  // Bootstrap routes should not require auth, but should be protected by a secret env var.
  // They need JSON parsing, so they must be registered AFTER express.json.
  app.use('/api/bootstrap', bootstrapRouter)

  app.get('/api/health', (req, res) => res.json({ ok: true }))
  app.get('/api/ready', async (req, res) => {
    try {
      await pool.query('select 1')
      return res.json({ ok: true })
    } catch (e) {
      return res.status(503).json({
        ok: false,
        code: e?.code,
        message: env.NODE_ENV !== 'production' ? e?.message : undefined,
      })
    }
  })

  app.use('/api', authRouter)
  app.use('/api/features', featuresRouter)
  app.use('/api/uploads', uploadsRouter)
  app.use('/api/jobs', jobsRouter)
  app.use('/api/quotes', quotesRouter)
  app.use('/api/artisans', artisansRouter)
  app.use('/api/farmers', farmersRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/drivers', driversRouter)
  // Delivery service endpoints (status/tracking) + quote endpoint
  app.use('/api/deliveries', deliveryQuoteRouter)
  app.use('/api/deliveries', deliveriesRouter)
  app.use('/api/messages', messagesRouter)
  app.use('/api/notifications', notificationsRouter)
  app.use('/api/support', supportRouter)
  app.use('/api/trust', trustRouter)
  app.use('/api/reviews', reviewsRouter)
  app.use('/api/profile', profileRouter)
  app.use('/api/posts', postsRouter)
  app.use('/api/follows', followsRouter)
  app.use('/api/endorsements', endorsementsRouter)
  app.use('/api/news', newsRouter)
  app.use('/api/match', matchRouter)
  app.use('/api/verification', verificationRouter)
  app.use('/api/id-verification', idVerificationRouter)
  app.use('/api/corporate', corporateRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/wallets', walletsRouter)
  app.use('/api/escrow', escrowRouter)
  app.use('/api/subscriptions', subscriptionsRouter)

  if (env.SENTRY_DSN?.trim()) {
    app.use(Sentry.Handlers.errorHandler())
  }

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err)
    if (String(err?.message || '') === 'Not allowed by CORS') {
      return res.status(403).json({ message: 'Origin not allowed', reqId: req.id })
    }
    res.status(500).json({ message: 'Internal server error', reqId: req.id })
  })

  return app
}


