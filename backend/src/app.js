import express from 'express'
import cors from 'cors'
import helmet from 'helmet'
import rateLimit from 'express-rate-limit'
import pinoHttp from 'pino-http'
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

export function createApp() {
  const app = express()

  app.set('trust proxy', 1)

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
  // Bootstrap routes should not require auth, but should be protected by a secret env var.
  app.use('/api/bootstrap', bootstrapRouter)

  app.use(express.json({ limit: '1mb' }))

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
  app.use('/api/jobs', jobsRouter)
  app.use('/api/quotes', quotesRouter)
  app.use('/api/artisans', artisansRouter)
  app.use('/api/products', productsRouter)
  app.use('/api/orders', ordersRouter)
  app.use('/api/admin', adminRouter)
  app.use('/api/wallets', walletsRouter)
  app.use('/api/escrow', escrowRouter)
  app.use('/api/subscriptions', subscriptionsRouter)

  // eslint-disable-next-line no-unused-vars
  app.use((err, req, res, next) => {
    // eslint-disable-next-line no-console
    console.error(err)
    res.status(500).json({ message: 'Internal server error', reqId: req.id })
  })

  return app
}


