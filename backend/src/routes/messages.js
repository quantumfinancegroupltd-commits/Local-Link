import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { requireAuth } from '../middleware/auth.js'
import { maskOffPlatformLinks, maskPhoneNumbers, recordPolicyEvent } from '../services/policy.js'
import { notify } from '../services/notifications.js'

export const messagesRouter = Router()

const asyncHandler =
  (fn) =>
  (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next)
  }

const SendSchema = z.object({
  message: z.string().min(1).max(4000),
  // for orders only (buyer can pick who they want to message)
  to: z.enum(['farmer', 'driver']).optional(),
})

// Inbox: last message per (context + other user), with unread counts.
messagesRouter.get('/inbox', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const r = await pool.query(
    `
    with base as (
      select
        case
          when job_id is not null then 'job'
          when order_id is not null then 'order'
          when job_post_id is not null then 'jobpost'
          else 'unknown'
        end as context_type,
        coalesce(job_id, order_id, job_post_id) as context_id,
        case when sender_id = $1 then receiver_id else sender_id end as other_user_id,
        id,
        sender_id,
        receiver_id,
        job_id,
        order_id,
        job_post_id,
        message,
        read,
        created_at
      from messages
      where (sender_id = $1 or receiver_id = $1)
        and (job_id is not null or order_id is not null or job_post_id is not null)
    ),
    latest as (
      select distinct on (context_type, context_id, other_user_id)
        context_type,
        context_id,
        other_user_id,
        message,
        created_at
      from base
      order by context_type, context_id, other_user_id, created_at desc
    )
    select
      l.context_type,
      l.context_id,
      l.other_user_id,
      u.name as other_name,
      u.email as other_email,
      l.message as last_message,
      l.created_at as last_at,
      (
        select count(*)
        from messages m
        where m.receiver_id = $1
          and m.read = false
          and (
            (l.context_type = 'job' and m.job_id = l.context_id) or
            (l.context_type = 'order' and m.order_id = l.context_id) or
            (l.context_type = 'jobpost' and m.job_post_id = l.context_id)
          )
          and m.sender_id = l.other_user_id
      ) as unread_count
    from latest l
    join users u on u.id = l.other_user_id
    order by l.created_at desc
    limit 200
    `,
    [userId],
  )
  return res.json(r.rows)
}))

async function getJobParticipants(jobId) {
  const jobRes = await pool.query('select * from jobs where id = $1', [jobId])
  const job = jobRes.rows[0]
  if (!job) return { job: null }

  let artisanUserId = null
  if (job.assigned_artisan_id) {
    const a = await pool.query('select user_id from artisans where id = $1', [job.assigned_artisan_id])
    artisanUserId = a.rows[0]?.user_id ?? null
  }
  return { job, buyerId: job.buyer_id ?? null, artisanUserId }
}

// Job thread (buyer <-> assigned artisan)
messagesRouter.get('/jobs/:jobId', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const { job, buyerId, artisanUserId } = await getJobParticipants(req.params.jobId)
  if (!job) return res.status(404).json({ message: 'Job not found' })

  const isBuyer = buyerId && buyerId === userId
  const isArtisan = artisanUserId && artisanUserId === userId
  const isAdmin = req.user.role === 'admin'
  if (!isBuyer && !isArtisan && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  const r = await pool.query(
    `select m.*,
            su.name as sender_name,
            su.role as sender_role,
            ru.name as receiver_name,
            ru.role as receiver_role
     from messages m
     left join users su on su.id = m.sender_id
     left join users ru on ru.id = m.receiver_id
     where m.job_id = $1
     order by m.created_at asc
     limit 500`,
    [req.params.jobId],
  )

  // mark received messages as read
  await pool.query(`update messages set read = true where job_id = $1 and receiver_id = $2 and read = false`, [
    req.params.jobId,
    userId,
  ])

  return res.json({
    context_type: 'job',
    context_id: req.params.jobId,
    participants: { buyer_id: buyerId, artisan_user_id: artisanUserId },
    messages: r.rows,
  })
}))

messagesRouter.post('/jobs/:jobId', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const parsed = SendSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { job, buyerId, artisanUserId } = await getJobParticipants(req.params.jobId)
  if (!job) return res.status(404).json({ message: 'Job not found' })
  if (!buyerId || !artisanUserId) return res.status(400).json({ message: 'Messaging is available once a job is assigned.' })

  const isBuyer = buyerId === userId
  const isArtisan = artisanUserId === userId
  const isAdmin = req.user.role === 'admin'
  if (!isBuyer && !isArtisan && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  const receiverId = isBuyer ? artisanUserId : isArtisan ? buyerId : null
  if (!receiverId) return res.status(400).json({ message: 'Admin must specify a receiver (not supported yet).' })

  const maskedPhone = maskPhoneNumbers(parsed.data.message)
  const maskedLinks = maskOffPlatformLinks(maskedPhone.text)
  if (maskedPhone.changed) {
    await recordPolicyEvent({
      userId,
      kind: 'phone_leak',
      contextType: 'job',
      contextId: req.params.jobId,
      meta: { masked: true },
    }).catch(() => {})
  }
  if (maskedLinks.changed) {
    await recordPolicyEvent({
      userId,
      kind: 'off_platform_link',
      contextType: 'job',
      contextId: req.params.jobId,
      meta: { masked: true },
    }).catch(() => {})
  }

  const r = await pool.query(
    `insert into messages (sender_id, receiver_id, job_id, message, read)
     values ($1,$2,$3,$4,false)
     returning *`,
    [userId, receiverId, req.params.jobId, maskedLinks.text],
  )
  // In-app notification (best-effort)
  notify({
    userId: receiverId,
    type: 'message',
    title: 'New message',
    body: 'You received a new message.',
    meta: { url: `/messages/job/${req.params.jobId}`, context: 'job', context_id: req.params.jobId, from_user_id: userId },
    dedupeKey: `job:${req.params.jobId}:from:${userId}`,
  }).catch(() => {})
  return res.status(201).json(r.rows[0])
}))

async function getOrderParticipants(orderId) {
  const orderRes = await pool.query(
    `select o.*,
            f.user_id as farmer_user_id
     from orders o
     left join farmers f on f.id = o.farmer_id
     where o.id = $1`,
    [orderId],
  )
  const order = orderRes.rows[0]
  if (!order) return { order: null }

  const deliveryRes = await pool.query('select driver_user_id from deliveries where order_id = $1', [orderId])
  const driverUserId = deliveryRes.rows[0]?.driver_user_id ?? null

  return {
    order,
    buyerId: order.buyer_id ?? null,
    farmerUserId: order.farmer_user_id ?? null,
    driverUserId,
  }
}

// Order thread: buyer can choose farmer/driver; farmer/driver always chat with buyer.
messagesRouter.get('/orders/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const withWho = String(req.query.with || 'farmer') // buyer pick
  const { order, buyerId, farmerUserId, driverUserId } = await getOrderParticipants(req.params.orderId)
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const isBuyer = buyerId && buyerId === userId
  const isFarmer = farmerUserId && farmerUserId === userId
  const isDriver = driverUserId && driverUserId === userId
  const isAdmin = req.user.role === 'admin'
  if (!isBuyer && !isFarmer && !isDriver && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  let otherId = null
  if (isBuyer) {
    otherId = withWho === 'driver' ? driverUserId : farmerUserId
    if (!otherId) return res.status(400).json({ message: `No ${withWho} assigned for this order yet.` })
  } else {
    otherId = buyerId
  }

  const r = await pool.query(
    `select m.*,
            su.name as sender_name,
            su.role as sender_role,
            ru.name as receiver_name,
            ru.role as receiver_role
     from messages m
     left join users su on su.id = m.sender_id
     left join users ru on ru.id = m.receiver_id
     where m.order_id = $1
       and (
         (m.sender_id = $2 and m.receiver_id = $3) or
         (m.sender_id = $3 and m.receiver_id = $2)
       )
     order by m.created_at asc
     limit 500`,
    [req.params.orderId, userId, otherId],
  )

  await pool.query(
    `update messages set read = true
     where order_id = $1 and receiver_id = $2 and sender_id = $3 and read = false`,
    [req.params.orderId, userId, otherId],
  )

  return res.json({
    context_type: 'order',
    context_id: req.params.orderId,
    participants: { buyer_id: buyerId, farmer_user_id: farmerUserId, driver_user_id: driverUserId },
    with: withWho,
    messages: r.rows,
  })
}))

messagesRouter.post('/orders/:orderId', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const parsed = SendSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const { order, buyerId, farmerUserId, driverUserId } = await getOrderParticipants(req.params.orderId)
  if (!order) return res.status(404).json({ message: 'Order not found' })

  const isBuyer = buyerId && buyerId === userId
  const isFarmer = farmerUserId && farmerUserId === userId
  const isDriver = driverUserId && driverUserId === userId
  const isAdmin = req.user.role === 'admin'
  if (!isBuyer && !isFarmer && !isDriver && !isAdmin) return res.status(403).json({ message: 'Forbidden' })

  let receiverId = null
  if (isBuyer) {
    const to = parsed.data.to ?? 'farmer'
    receiverId = to === 'driver' ? driverUserId : farmerUserId
    if (!receiverId) return res.status(400).json({ message: `No ${to} available for this order yet.` })
  } else if (isFarmer || isDriver) {
    receiverId = buyerId
  } else {
    return res.status(400).json({ message: 'Admin must specify a receiver (not supported yet).' })
  }

  const maskedPhone = maskPhoneNumbers(parsed.data.message)
  const maskedLinks = maskOffPlatformLinks(maskedPhone.text)
  if (maskedPhone.changed) {
    await recordPolicyEvent({
      userId,
      kind: 'phone_leak',
      contextType: 'order',
      contextId: req.params.orderId,
      meta: { masked: true },
    }).catch(() => {})
  }
  if (maskedLinks.changed) {
    await recordPolicyEvent({
      userId,
      kind: 'off_platform_link',
      contextType: 'order',
      contextId: req.params.orderId,
      meta: { masked: true },
    }).catch(() => {})
  }

  const r = await pool.query(
    `insert into messages (sender_id, receiver_id, order_id, message, read)
     values ($1,$2,$3,$4,false)
     returning *`,
    [userId, receiverId, req.params.orderId, maskedLinks.text],
  )
  // In-app notification (best-effort)
  notify({
    userId: receiverId,
    type: 'message',
    title: 'New message',
    body: 'You received a new message.',
    meta: { url: `/messages/order/${req.params.orderId}`, context: 'order', context_id: req.params.orderId, from_user_id: userId },
    dedupeKey: `order:${req.params.orderId}:from:${userId}`,
  }).catch(() => {})
  return res.status(201).json(r.rows[0])
}))

async function getJobPostParticipants(jobPostId) {
  const r = await pool.query(
    `select jp.id as job_post_id,
            jp.title,
            c.owner_user_id as company_owner_user_id,
            c.id as company_id
     from job_posts jp
     join companies c on c.id = jp.company_id
     where jp.id = $1
     limit 1`,
    [jobPostId],
  )
  const row = r.rows[0] ?? null
  if (!row) return { jobPost: null }
  return { jobPost: row, companyOwnerUserId: row.company_owner_user_id }
}

// Job post thread (company <-> applicant). Company must specify ?with=<applicant_user_id>.
messagesRouter.get('/job-posts/:jobPostId', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const withId = String(req.query.with ?? '').trim() || null
  const { jobPost, companyOwnerUserId } = await getJobPostParticipants(req.params.jobPostId)
  if (!jobPost) return res.status(404).json({ message: 'Job not found' })

  const isCompanyOwner = userId === companyOwnerUserId
  const isAdmin = req.user.role === 'admin'

  let otherUserId = null
  if (isCompanyOwner || isAdmin) {
    if (!withId) return res.status(400).json({ message: 'Missing ?with=<applicant_user_id>' })
    // Ensure the applicant actually applied to this job
    const a = await pool.query(
      'select 1 from job_applications where job_id = $1 and applicant_user_id = $2 limit 1',
      [req.params.jobPostId, withId],
    )
    if (a.rowCount === 0) return res.status(403).json({ message: 'Not an applicant for this job' })
    otherUserId = withId
  } else {
    // Applicant side: must have applied
    const a = await pool.query(
      'select 1 from job_applications where job_id = $1 and applicant_user_id = $2 limit 1',
      [req.params.jobPostId, userId],
    )
    if (a.rowCount === 0) return res.status(403).json({ message: 'Forbidden' })
    otherUserId = companyOwnerUserId
  }

  const r = await pool.query(
    `select m.*,
            su.name as sender_name,
            su.role as sender_role,
            ru.name as receiver_name,
            ru.role as receiver_role
     from messages m
     left join users su on su.id = m.sender_id
     left join users ru on ru.id = m.receiver_id
     where m.job_post_id = $1
       and (
         (m.sender_id = $2 and m.receiver_id = $3) or
         (m.sender_id = $3 and m.receiver_id = $2)
       )
     order by m.created_at asc
     limit 500`,
    [req.params.jobPostId, userId, otherUserId],
  )

  await pool.query(
    `update messages set read = true
     where job_post_id = $1 and receiver_id = $2 and sender_id = $3 and read = false`,
    [req.params.jobPostId, userId, otherUserId],
  )

  return res.json({
    context_type: 'jobpost',
    context_id: req.params.jobPostId,
    participants: { company_owner_user_id: companyOwnerUserId },
    with: otherUserId,
    messages: r.rows,
  })
}))

messagesRouter.post('/job-posts/:jobPostId', requireAuth, asyncHandler(async (req, res) => {
  const userId = req.user.sub
  const parsed = SendSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const withId = String(req.query.with ?? '').trim() || null
  const { jobPost, companyOwnerUserId } = await getJobPostParticipants(req.params.jobPostId)
  if (!jobPost) return res.status(404).json({ message: 'Job not found' })

  const isCompanyOwner = userId === companyOwnerUserId
  const isAdmin = req.user.role === 'admin'

  let receiverId = null
  if (isCompanyOwner || isAdmin) {
    if (!withId) return res.status(400).json({ message: 'Missing ?with=<applicant_user_id>' })
    const a = await pool.query(
      'select 1 from job_applications where job_id = $1 and applicant_user_id = $2 limit 1',
      [req.params.jobPostId, withId],
    )
    if (a.rowCount === 0) return res.status(403).json({ message: 'Not an applicant for this job' })
    receiverId = withId
  } else {
    const a = await pool.query(
      'select 1 from job_applications where job_id = $1 and applicant_user_id = $2 limit 1',
      [req.params.jobPostId, userId],
    )
    if (a.rowCount === 0) return res.status(403).json({ message: 'Forbidden' })
    receiverId = companyOwnerUserId
  }

  const maskedPhone = maskPhoneNumbers(parsed.data.message)
  const maskedLinks = maskOffPlatformLinks(maskedPhone.text)
  if (maskedPhone.changed) {
    await recordPolicyEvent({
      userId,
      kind: 'phone_leak',
      contextType: 'jobpost',
      contextId: req.params.jobPostId,
      meta: { masked: true },
    }).catch(() => {})
  }
  if (maskedLinks.changed) {
    await recordPolicyEvent({
      userId,
      kind: 'off_platform_link',
      contextType: 'jobpost',
      contextId: req.params.jobPostId,
      meta: { masked: true },
    }).catch(() => {})
  }

  const r = await pool.query(
    `insert into messages (sender_id, receiver_id, job_post_id, message, read)
     values ($1,$2,$3,$4,false)
     returning *`,
    [userId, receiverId, req.params.jobPostId, maskedLinks.text],
  )

  // Corporate quality-of-life: when a company owner messages an applicant, mark the application as "contacted".
  // (Never override terminal states.)
  if (isCompanyOwner && receiverId && receiverId !== companyOwnerUserId) {
    pool
      .query(
        `update job_applications
         set status = 'contacted', updated_at = now()
         where job_id = $1
           and applicant_user_id = $2
           and status not in ('rejected','hired','withdrawn')
           and status <> 'contacted'`,
        [req.params.jobPostId, receiverId],
      )
      .catch(() => {})
  }

  notify({
    userId: receiverId,
    type: 'message',
    title: 'New message',
    body: 'You received a new message.',
    meta: { url: `/messages/jobpost/${req.params.jobPostId}?with=${encodeURIComponent(userId)}`, context: 'jobpost', context_id: req.params.jobPostId, from_user_id: userId },
    dedupeKey: `jobpost:${req.params.jobPostId}:from:${userId}`,
  }).catch(() => {})

  return res.status(201).json(r.rows[0])
}))


