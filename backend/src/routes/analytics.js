import { Router } from 'express'
import { z } from 'zod'
import crypto from 'crypto'
import rateLimit from 'express-rate-limit'
import geoip from 'geoip-lite'
import { pool } from '../db/pool.js'
import { optionalAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const analyticsRouter = Router()

function countryFromIp(ip) {
  if (!ip || typeof ip !== 'string') return null
  const cleaned = ip.replace(/^::ffff:/, '').trim()
  if (!cleaned || cleaned === '::1' || cleaned === '127.0.0.1') return null
  try {
    const lookup = geoip.lookup(cleaned)
    return lookup?.country ?? null
  } catch {
    return null
  }
}

const TrackSchema = z.object({
  event: z.enum(['page_view', 'signup', 'login', 'job_posted', 'order_placed']).default('page_view'),
  path: z.string().max(500).optional().nullable(),
  referrer: z.string().max(500).optional().nullable(),
  title: z.string().max(200).optional().nullable(),
  utm_source: z.string().max(200).optional().nullable(),
  utm_medium: z.string().max(200).optional().nullable(),
  utm_campaign: z.string().max(200).optional().nullable(),
  session_id: z.string().max(128).optional().nullable(),
})

function deviceTypeFromUserAgent(ua) {
  if (!ua || typeof ua !== 'string') return 'unknown'
  const s = ua.toLowerCase()
  if (/bot|crawler|spider|headless/i.test(s)) return 'bot'
  if (/mobile|android|iphone|ipod|webos|blackberry|iemobile|opera mini/i.test(s)) return 'mobile'
  if (/ipad|tablet|playbook|silklite/i.test(s)) return 'tablet'
  return 'desktop'
}

// Public endpoint: rate-limit heavily to prevent abuse
analyticsRouter.post(
  '/track',
  rateLimit({
    windowMs: 60_000,
    limit: 60,
    standardHeaders: 'draft-7',
    legacyHeaders: false,
  }),
  optionalAuth,
  asyncHandler(async (req, res) => {
    const parsed = TrackSchema.safeParse(req.body ?? {})
    if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

    const { event, path, referrer, title, utm_source, utm_medium, utm_campaign, session_id: bodySessionId } = parsed.data
    const userId = req.user?.sub ?? null
    const userAgent = String(req.headers['user-agent'] ?? '').slice(0, 500)
    const referrerHeader = String(req.headers['referer'] ?? req.headers['referrer'] ?? '').slice(0, 500)
    const sessionId =
      (bodySessionId && String(bodySessionId).trim())
        ? String(bodySessionId).trim().slice(0, 128)
        : crypto.createHash('sha256').update(`${req.ip ?? ''}-${Date.now()}-${Math.random()}`).digest('hex').slice(0, 32)
    const deviceType = deviceTypeFromUserAgent(userAgent || req.headers['user-agent'])
    const country = countryFromIp(req.ip ?? req.socket?.remoteAddress ?? null)

    await pool.query(
      `insert into analytics_events (event_type, path, referrer, title, user_id, session_id, user_agent, utm_source, utm_medium, utm_campaign, device_type, country, created_at)
       values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, now())`,
      [
        event,
        path ?? null,
        referrer || referrerHeader || null,
        title ?? null,
        userId,
        sessionId,
        userAgent || null,
        (utm_source && String(utm_source).trim()) || null,
        (utm_medium && String(utm_medium).trim()) || null,
        (utm_campaign && String(utm_campaign).trim()) || null,
        deviceType,
        (country && String(country).trim().slice(0, 2)) || null,
      ],
    ).catch(() => {})

    return res.status(204).send()
  }),
)
