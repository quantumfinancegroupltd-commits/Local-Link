/**
 * Seed demo feed: posts from demo users + follows so the feed is populated.
 * Run after seed-demo-users.js. Uses same demo emails; creates user_posts and user_follows.
 *
 * From repo root: cd backend && node scripts/seed-demo-feed.js
 */
import 'dotenv/config'
import { pool } from '../src/db/pool.js'

const DEMO_EMAILS = [
  'akua.mensah@demo.locallink.agency',
  'kofi.asante@demo.locallink.agency',
  'abena.osei@demo.locallink.agency',
  'yaw.boateng@demo.locallink.agency',
  'afia.addo@demo.locallink.agency',
  'ama.serwaa@demo.locallink.agency',
  'kwame.owusu@demo.locallink.agency',
  'esi.tawiah@demo.locallink.agency',
  'kwabena.mensah@demo.locallink.agency',
]

// Free images (Unsplash/Wikimedia) for post media – skills-related
const POST_IMAGES = {
  driver: 'https://images.unsplash.com/photo-1544620347-c4fd4a3d5957?w=800&h=500&fit=crop',
  tomatoes: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Tomato.jpg/800px-Tomato.jpg',
  furniture: 'https://images.unsplash.com/photo-1505693416388-ac5ce068fe85?w=800&h=500&fit=crop',
  cleaning: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=800&h=500&fit=crop',
  carpenter: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=800&h=500&fit=crop',
  catering: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Ghana_Jollof_Rice_with_Chicken.jpg/800px-Ghana_Jollof_Rice_with_Chicken.jpg',
}

async function run() {
  const usersByEmail = {}
  const r = await pool.query(
    "select id, email, name, role from users where email = any($1::text[]) and deleted_at is null",
    [DEMO_EMAILS],
  )
  for (const row of r.rows) {
    usersByEmail[row.email] = row
  }
  const demoCount = Object.keys(usersByEmail).length
  if (demoCount === 0) {
    console.error('No demo users found. Run node scripts/seed-demo-users.js first.')
    process.exit(1)
  }
  console.log(`Found ${demoCount} demo users by email.`)

  const abena = usersByEmail['abena.osei@demo.locallink.agency']
  const yaw = usersByEmail['yaw.boateng@demo.locallink.agency']
  const kwame = usersByEmail['kwame.owusu@demo.locallink.agency']
  const afia = usersByEmail['afia.addo@demo.locallink.agency']
  const ama = usersByEmail['ama.serwaa@demo.locallink.agency']
  const kofi = usersByEmail['kofi.asante@demo.locallink.agency']

  // Get Ama's company and the "Skilled carpenters" job_post
  let carpenterJobPostId = null
  if (ama?.id) {
    const jp = await pool.query(
      `select jp.id from job_posts jp
       join companies c on c.id = jp.company_id
       where c.owner_user_id = $1 and jp.status = 'open' and jp.title ilike '%carpenter%'
       limit 1`,
      [ama.id],
    )
    carpenterJobPostId = jp.rows[0]?.id ?? null
  }

  // Get Kwame's first artisan_service for a boosted service post
  let kwameServiceId = null
  if (kwame?.id) {
    const svc = await pool.query(
      'select id from artisan_services where artisan_user_id = $1 order by created_at limit 1',
      [kwame.id],
    )
    kwameServiceId = svc.rows[0]?.id ?? null
  }

  // Delete existing demo feed data: posts by demo users and follows between them
  const demoIds = Object.values(usersByEmail).map((u) => u.id)
  await pool.query('delete from user_post_likes where post_id in (select id from user_posts where user_id = any($1::uuid[]))', [demoIds])
  await pool.query('delete from user_post_comments where post_id in (select id from user_posts where user_id = any($1::uuid[]))', [demoIds])
  await pool.query('delete from user_posts where user_id = any($1::uuid[])', [demoIds])
  await pool.query('delete from user_follows where follower_id = any($1::uuid[]) and following_id = any($1::uuid[])', [demoIds])

  function insertPost({ userId, body, media, type = 'update', relatedType = null, relatedId = null, sponsored = false }) {
    const mediaJson = media ? JSON.stringify(media) : null
    return pool.query(
      `insert into user_posts (user_id, body, media, type, related_type, related_id, sponsored)
       values ($1, $2, $3::jsonb, $4, $5, $6::uuid, $7)`,
      [userId, body ?? null, mediaJson, type, relatedType, relatedId, sponsored],
    )
  }

  // 1. Yaw Boateng (Driver) – update with delivery image
  if (yaw?.id) {
    await insertPost({
      userId: yaw.id,
      body: "Early morning deliveries in Accra. Let's go! #OnTheMove",
      media: [{ url: POST_IMAGES.driver, kind: 'image' }],
    })
  }

  // 2. Abena Osei (Farmer) – tomatoes
  if (abena?.id) {
    await insertPost({
      userId: abena.id,
      body: 'Fresh tomatoes ready for sale! 🍅 Who needs some?',
      media: [{ url: POST_IMAGES.tomatoes, kind: 'image' }],
    })
  }

  // 3. Kwame Owusu (Artisan) – furniture
  if (kwame?.id) {
    await insertPost({
      userId: kwame.id,
      body: 'New furniture set finished today. What do you think?',
      media: [{ url: POST_IMAGES.furniture, kind: 'image' }],
    })
  }

  // 4. Afia Addo (Artisan) – cleaning / gratitude
  if (afia?.id) {
    await insertPost({
      userId: afia.id,
      body: 'Using LocalLink has really boosted my business! #gratitude',
      media: [{ url: POST_IMAGES.cleaning, kind: 'image' }],
    })
  }

  // 4b. Kofi Asante (Artisan – caterer)
  if (kofi?.id) {
    await insertPost({
      userId: kofi.id,
      body: 'Jollof and chicken ready for your next event. Catering bookings open! 🍛',
      media: [{ url: POST_IMAGES.catering, kind: 'image' }],
    })
  }

  // 5. Ama Serwaa (Company) – sponsored job_post (carpenters)
  if (ama?.id && carpenterJobPostId) {
    await insertPost({
      userId: ama.id,
      body: 'Looking for skilled carpenters! Hiring now! 🛠️ Apply today!',
      media: [{ url: POST_IMAGES.carpenter, kind: 'image' }],
      type: 'job_post',
      relatedType: 'job_post',
      relatedId: carpenterJobPostId,
      sponsored: true,
    })
  }

  // 6. Kwame – boosted service post
  if (kwame?.id && kwameServiceId) {
    await insertPost({
      userId: kwame.id,
      body: 'Leak repairs and plumbing – same-day callouts in Accra & Tema.',
      type: 'service',
      relatedType: 'artisan_service',
      relatedId: kwameServiceId,
      sponsored: true,
    })
  }

  // Follows: everyone follows everyone (except self) so feed is full for any demo login
  let followCount = 0
  for (const follower of Object.values(usersByEmail)) {
    for (const following of Object.values(usersByEmail)) {
      if (follower.id === following.id) continue
      await pool.query(
        `insert into user_follows (follower_id, following_id, status, requested_at, accepted_at)
         values ($1, $2, 'accepted', now(), now())
         on conflict (follower_id, following_id) do update set status = 'accepted', accepted_at = now()`,
        [follower.id, following.id],
      )
      followCount += 1
    }
  }
  console.log(`Created ${followCount} follow relationships.`)

  console.log('\n--- Demo feed seed complete ---')
  console.log('Posts: Yaw (driver), Abena (farmer), Kwame (artisan x2: update + boosted service), Afia, Kofi (caterer), Ama (company – sponsored job_post).')
  console.log(`Demo users: ${Object.keys(usersByEmail).length}; follow pairs: ${followCount}.`)
  console.log('Log in with any demo email (e.g. kwabena.mensah@demo.locallink.agency) and open /feed. Password: Ghana2025!\n')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
