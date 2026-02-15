import { Router } from 'express'
import { requireAuth, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'
import { buildTrustReport } from '../services/trustReport.js'

export const trustRouter = Router()

// User-facing trust report (actionable, no sensitive raw signals)
trustRouter.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const report = await buildTrustReport(req.user.sub, { includeRaw: false })
    if (!report) return res.status(404).json({ message: 'User not found' })
    return res.json(report)
  }),
)

// Admin-only trust breakdown (includes raw counts)
trustRouter.get(
  '/admin/users/:id',
  requireAuth,
  requireRole(['admin']),
  asyncHandler(async (req, res) => {
    const report = await buildTrustReport(req.params.id, { includeRaw: true })
    if (!report) return res.status(404).json({ message: 'User not found' })
    return res.json(report)
  }),
)


