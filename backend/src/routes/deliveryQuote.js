import { Router } from 'express'
import { z } from 'zod'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { env } from '../config.js'
import { deliveryFeeGhs, etaMinutes, haversineKm } from '../services/algorithms.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const deliveryQuoteRouter = Router()

const QuoteSchema = z.object({
  pickup_lat: z.coerce.number(),
  pickup_lng: z.coerce.number(),
  dropoff_lat: z.coerce.number(),
  dropoff_lng: z.coerce.number(),
})

deliveryQuoteRouter.get('/quote', requireAuth, requireRole(['buyer', 'admin']), asyncHandler(async (req, res) => {
  const parsed = QuoteSchema.safeParse(req.query)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const km = haversineKm(parsed.data.pickup_lat, parsed.data.pickup_lng, parsed.data.dropoff_lat, parsed.data.dropoff_lng)
  if (km == null) return res.status(400).json({ message: 'Invalid coordinates' })

  const fee = deliveryFeeGhs(km, env.DELIVERY_BASE_FEE, env.DELIVERY_RATE_PER_KM)
  const eta = etaMinutes(km, env.DELIVERY_SPEED_KMH)

  return res.json({
    distance_km: Math.round(km * 100) / 100,
    base_fee: env.DELIVERY_BASE_FEE,
    rate_per_km: env.DELIVERY_RATE_PER_KM,
    fee_ghs: fee,
    eta_minutes: eta,
    explain: 'delivery_fee = base_fee + (distance_km * rate_per_km)',
  })
}))


