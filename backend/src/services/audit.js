import { pool } from '../db/pool.js'

export async function auditAdminAction({
  adminUserId,
  action,
  targetType = null,
  targetId = null,
  meta = null,
  ip = null,
  userAgent = null,
}) {
  if (!adminUserId || !action) return
  await pool.query(
    `insert into admin_audit_logs (admin_user_id, action, target_type, target_id, meta, ip, user_agent)
     values ($1,$2,$3,$4,$5,$6,$7)`,
    [
      adminUserId,
      String(action),
      targetType ? String(targetType) : null,
      targetId ? String(targetId) : null,
      meta ?? null,
      ip ? String(ip) : null,
      userAgent ? String(userAgent) : null,
    ],
  )
}


