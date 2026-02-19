import { Router } from 'express'
import { z } from 'zod'
import { pool } from '../db/pool.js'
import { optionalAuth, requireAuth, requireIdVerified, requireRole } from '../middleware/auth.js'
import { asyncHandler } from '../middleware/asyncHandler.js'

export const productsRouter = Router()

productsRouter.get('/mine', requireAuth, requireRole(['farmer']), asyncHandler(async (req, res) => {
  const includeCancelled =
    String(req.query.include_cancelled ?? '').toLowerCase() === '1' ||
    String(req.query.include_cancelled ?? '').toLowerCase() === 'true'

  const r = await pool.query(
    `select p.*,
            f.farm_location,
            f.farm_place_id,
            f.farm_lat,
            f.farm_lng,
            u.id as farmer_user_id,
            u.name as farmer_name,
            u.verified as farmer_verified,
            u.trust_score as farmer_trust_score,
            coalesce(v.level, 'unverified') as verification_tier
     from products p
     left join farmers f on f.id = p.farmer_id
     left join users u
       on u.id = f.user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
     left join verification_levels v on v.user_id = u.id
     where u.id = $1
       and ($2::boolean = true or p.status <> 'cancelled')
     order by p.created_at desc
     limit 500`,
    [req.user.sub, includeCancelled],
  )
  const list = r.rows.map((row) => ({
    ...row,
    location: row.farm_location,
    farm_place_id: row.farm_place_id ?? null,
    farm_lat: row.farm_lat ?? null,
    farm_lng: row.farm_lng ?? null,
    farmer_trust_score: row.farmer_trust_score ?? null,
    farmer: row.farmer_user_id
      ? {
          id: row.farmer_user_id,
          name: row.farmer_name,
          verified: row.farmer_verified,
          trust_score: row.farmer_trust_score ?? null,
          farm_location: row.farm_location,
          farm_place_id: row.farm_place_id ?? null,
          farm_lat: row.farm_lat ?? null,
          farm_lng: row.farm_lng ?? null,
          verification_tier: row.verification_tier,
        }
      : null,
  }))
  return res.json(list)
}))

// Buyer: subscribe to restock notification for a product (when out of stock or low)
productsRouter.post('/:id/notify-restock', requireAuth, requireRole(['buyer']), asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select id, name, status, quantity from products where id = $1`,
    [req.params.id],
  )
  const product = r.rows[0]
  if (!product) return res.status(404).json({ message: 'Product not found' })
  await pool.query(
    `insert into product_restock_notifications (product_id, user_id)
     values ($1, $2)
     on conflict (product_id, user_id) do nothing`,
    [product.id, req.user.sub],
  )
  return res.status(201).json({ ok: true, message: "We'll notify you when this product is back in stock." })
}))

// Public marketplace browse (only shows available listings; excludes out_of_stock).
// Optional ?farmer_user_id=uuid returns only that farmer's products (e.g. for profile page).
productsRouter.get('/', asyncHandler(async (req, res) => {
  const farmerUserId = req.query.farmer_user_id ? String(req.query.farmer_user_id).trim() : null
  const r = await pool.query(
    `select p.*,
            f.farm_location,
            f.farm_place_id,
            f.farm_lat,
            f.farm_lng,
            u.id as farmer_user_id,
            u.name as farmer_name,
            u.verified as farmer_verified,
            u.trust_score as farmer_trust_score,
            coalesce(v.level, 'unverified') as verification_tier
     from products p
     left join farmers f on f.id = p.farmer_id
     left join users u
       on u.id = f.user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
     left join verification_levels v on v.user_id = u.id
     where p.status = 'available'
       and (p.quantity is null or p.quantity > 0)
       and ($1::uuid is null or u.id = $1)
     order by p.created_at desc`,
    [farmerUserId || null],
  )
  const list = r.rows.map((row) => ({
    ...row,
    location: row.farm_location,
    farm_place_id: row.farm_place_id ?? null,
    farm_lat: row.farm_lat ?? null,
    farm_lng: row.farm_lng ?? null,
    farmer_trust_score: row.farmer_trust_score ?? null,
    farmer: row.farmer_user_id
      ? {
          id: row.farmer_user_id,
          name: row.farmer_name,
          verified: row.farmer_verified,
          trust_score: row.farmer_trust_score ?? null,
          farm_location: row.farm_location,
          farm_place_id: row.farm_place_id ?? null,
          farm_lat: row.farm_lat ?? null,
          farm_lng: row.farm_lng ?? null,
          verification_tier: row.verification_tier,
        }
      : null,
  }))
  return res.json(list)
}))

// Public product details:
// - unauthenticated viewers can only see available listings
// - authenticated owner farmer/admin can see any status
productsRouter.get('/:id', optionalAuth, asyncHandler(async (req, res) => {
  const r = await pool.query(
    `select p.*,
            f.farm_location,
            f.farm_place_id,
            f.farm_lat,
            f.farm_lng,
            f.user_id as farmer_owner_user_id,
            u.id as farmer_user_id,
            u.name as farmer_name,
            u.verified as farmer_verified,
            u.trust_score as farmer_trust_score,
            coalesce(v.level, 'unverified') as verification_tier
     from products p
     left join farmers f on f.id = p.farmer_id
     left join users u
       on u.id = f.user_id
      and u.deleted_at is null
      and (u.suspended_until is null or u.suspended_until <= now())
     left join verification_levels v on v.user_id = u.id
     where p.id = $1`,
    [req.params.id],
  )
  const row = r.rows[0]
  if (!row || !row.farmer_user_id) return res.status(404).json({ message: 'Product not found' })

  // Buyers should only see active listings. Farmers/admin can view any status.
  const viewerRole = req.user?.role
  const viewerId = req.user?.sub
  const isAdmin = viewerRole === 'admin'
  const isOwnerFarmer = viewerRole === 'farmer' && row.farmer_owner_user_id === viewerId
  if (!isAdmin && !isOwnerFarmer && row.status !== 'available') {
    return res.status(404).json({ message: 'Product not found' })
  }

  return res.json({
    ...row,
    location: row.farm_location,
    farm_place_id: row.farm_place_id ?? null,
    farm_lat: row.farm_lat ?? null,
    farm_lng: row.farm_lng ?? null,
    farmer_trust_score: row.farmer_trust_score ?? null,
    farmer: row.farmer_user_id
      ? {
          id: row.farmer_user_id,
          name: row.farmer_name,
          verified: row.farmer_verified,
          trust_score: row.farmer_trust_score ?? null,
          farm_location: row.farm_location,
          farm_place_id: row.farm_place_id ?? null,
          farm_lat: row.farm_lat ?? null,
          farm_lng: row.farm_lng ?? null,
          verification_tier: row.verification_tier,
        }
      : null,
  })
}))

const CreateSchema = z.object({
  name: z.string().min(1),
  category: z.string().min(1),
  quantity: z.number().int().positive(),
  unit: z.string().min(1),
  price: z.number().positive(),
  // Accept internal upload URLs like "/api/uploads/<file>" (not a full absolute URL).
  image_url: z.string().min(1).optional().nullable(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        kind: z.enum(['image', 'video']).optional(),
        mime: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .optional()
    .nullable(),
  recipe: z.string().max(2000).optional().nullable(),
})

productsRouter.post('/', requireAuth, requireRole(['farmer']), requireIdVerified(), asyncHandler(async (req, res) => {
  const parsed = CreateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  // Ensure farmer profile exists
  const farmerRes = await pool.query('select id from farmers where user_id = $1', [req.user.sub])
  const farmer = farmerRes.rows[0]
  if (!farmer) {
    // auto-create basic farmer profile for MVP
    const created = await pool.query('insert into farmers (user_id) values ($1) returning id', [req.user.sub])
    farmerRes.rows[0] = created.rows[0]
  }

  const { name, category, quantity, unit, price, image_url, media, recipe } = parsed.data
  const mediaJson = media == null ? null : JSON.stringify(media)
  const r = await pool.query(
    `insert into products (farmer_id, name, category, quantity, unit, price, image_url, media, recipe, status, created_at, updated_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8::jsonb,$9,'available',now(),now())
     returning *`,
    [farmerRes.rows[0].id, name, category, quantity, unit, price, image_url ?? null, mediaJson, recipe ?? null],
  )

  return res.status(201).json(r.rows[0])
}))

const UpdateSchema = z.object({
  name: z.string().min(1).optional(),
  category: z.string().min(1).optional(),
  quantity: z.number().int().positive().optional(),
  unit: z.string().min(1).optional(),
  price: z.number().positive().optional(),
  status: z.enum(['available', 'sold', 'pending', 'cancelled', 'out_of_stock']).optional(),
  image_url: z.string().min(1).nullable().optional(),
  recipe: z.string().max(2000).optional().nullable(),
  media: z
    .array(
      z.object({
        url: z.string().min(1),
        kind: z.enum(['image', 'video']).optional(),
        mime: z.string().optional(),
        size: z.number().optional(),
      }),
    )
    .nullable()
    .optional(),
})

productsRouter.put('/:id', requireAuth, asyncHandler(async (req, res) => {
  const parsed = UpdateSchema.safeParse(req.body)
  if (!parsed.success) return res.status(400).json({ message: 'Invalid input', issues: parsed.error.issues })

  const client = await pool.connect()
  try {
    await client.query('begin')

    const pRes = await client.query(
      `select p.*,
              f.user_id as farmer_user_id
       from products p
       left join farmers f on f.id = p.farmer_id
       where p.id = $1
       for update`,
      [req.params.id],
    )
    const product = pRes.rows[0]
    if (!product) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Product not found' })
    }

    const isAdmin = req.user.role === 'admin'
    const isOwnerFarmer = req.user.role === 'farmer' && product.farmer_user_id === req.user.sub
    if (!isAdmin && !isOwnerFarmer) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }

    const next = {
      name: parsed.data.name ?? product.name,
      category: parsed.data.category ?? product.category,
      quantity: parsed.data.quantity ?? product.quantity,
      unit: parsed.data.unit ?? product.unit,
      price: parsed.data.price ?? product.price,
      status: parsed.data.status ?? product.status,
      image_url: parsed.data.image_url === undefined ? product.image_url : parsed.data.image_url,
      media: parsed.data.media === undefined ? product.media : parsed.data.media,
      recipe: parsed.data.recipe === undefined ? product.recipe : parsed.data.recipe,
    }

    const mediaJson = next.media == null ? null : JSON.stringify(next.media)

    const wasOutOfStock = Number(product.quantity ?? 0) <= 0
    const nowInStock = Number(next.quantity ?? 0) > 0
    const statusToSet = wasOutOfStock && nowInStock ? 'available' : next.status

    const updated = await client.query(
      `update products
       set name=$2,
           category=$3,
           quantity=$4,
           unit=$5,
           price=$6,
           status=$7,
           image_url=$8,
           media=$9::jsonb,
           recipe=$10,
           updated_at=now()
       where id=$1
       returning *`,
      [
        product.id,
        next.name,
        next.category,
        next.quantity,
        next.unit,
        next.price,
        statusToSet,
        next.image_url ?? null,
        mediaJson,
        next.recipe ?? null,
      ],
    )

    if (wasOutOfStock && nowInStock) {
      const notif = await client.query(
        `select user_id from product_restock_notifications where product_id = $1 and notified_at is null`,
        [product.id],
      )
      const { notify } = await import('../services/notifications.js')
      for (const r of notif.rows || []) {
        notify({
          userId: r.user_id,
          type: 'product_restock',
          title: 'Back in stock',
          body: `${next.name ?? 'A product'} you wanted is back in stock.`,
          meta: { url: `/marketplace/products/${product.id}`, product_id: product.id },
          dedupeKey: `restock:${product.id}:${r.user_id}`,
        }).catch(() => {})
      }
      await client.query(
        `update product_restock_notifications set notified_at = now() where product_id = $1`,
        [product.id],
      )
    }

    await client.query('commit')
    return res.json(updated.rows[0])
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))

productsRouter.delete('/:id', requireAuth, asyncHandler(async (req, res) => {
  const client = await pool.connect()
  try {
    await client.query('begin')
    const pRes = await client.query(
      `select p.*,
              f.user_id as farmer_user_id
       from products p
       left join farmers f on f.id = p.farmer_id
       where p.id = $1
       for update`,
      [req.params.id],
    )
    const product = pRes.rows[0]
    if (!product) {
      await client.query('rollback')
      return res.status(404).json({ message: 'Product not found' })
    }

    const isAdmin = req.user.role === 'admin'
    const isOwnerFarmer = req.user.role === 'farmer' && product.farmer_user_id === req.user.sub
    if (!isAdmin && !isOwnerFarmer) {
      await client.query('rollback')
      return res.status(403).json({ message: 'Forbidden' })
    }

    const updated = await client.query(
      `update products
       set status='cancelled', updated_at=now()
       where id=$1
       returning *`,
      [product.id],
    )
    await client.query('commit')
    return res.json({ ok: true, product: updated.rows[0] })
  } catch (e) {
    try {
      await client.query('rollback')
    } catch {}
    throw e
  } finally {
    client.release()
  }
}))


