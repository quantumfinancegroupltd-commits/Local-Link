import { Router } from 'express'
import { requireAuth } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { getTimelineForUser } from '../services/timeline.js'

export const timelineRouter = Router()

/**
 * GET /api/timeline
 * - Authenticated: returns timeline for the current user (req.user.sub).
 * - Admin only with ?user_id=: returns timeline for that user.
 * Query: limit (default 50, max 100), before (ISO date cursor).
 */
timelineRouter.get(
  '/',
  requireAuth,
  asyncHandler(async (req, res) => {
    const userIdParam = req.query.user_id
    let userId = req.user.sub
    if (userIdParam) {
      if (req.user.role !== 'admin') return res.status(403).json({ message: 'Forbidden' })
      userId = userIdParam
    }
    const limit = req.query.limit ? Math.min(Number(req.query.limit), 100) : 50
    const before = req.query.before && String(req.query.before).trim() ? String(req.query.before).trim() : undefined
    const events = await getTimelineForUser(userId, { limit, before })
    return res.json({ events })
  }),
)
