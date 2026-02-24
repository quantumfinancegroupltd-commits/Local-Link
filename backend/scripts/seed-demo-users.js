/**
 * Seed demo users for all verticals — Ghana-based, diverse names.
 * Run from backend: DATABASE_URL=... node scripts/seed-demo-users.js
 * Password for all: Ghana2025!
 */
import 'dotenv/config'
import crypto from 'node:crypto'
import bcrypt from 'bcryptjs'
import { pool } from '../src/db/pool.js'

const SEED_PASSWORD = 'Ghana2025!'

function genRefCode() {
  return crypto.randomBytes(8).toString('base64url').slice(0, 12).toUpperCase()
}

const USERS = [
  {
    name: 'Akua Mensah',
    email: 'akua.mensah@demo.locallink.agency',
    phone: '+233 24 123 4567',
    role: 'buyer',
    bio: 'Based in Accra. I hire for events, home cleaning, and small repairs. I prefer verified providers and clear pricing.',
  },
  {
    name: 'Kofi Asante',
    email: 'kofi.asante@demo.locallink.agency',
    phone: '+233 55 234 5678',
    role: 'artisan',
    bio: 'Professional caterer and event planner from Kumasi. 8+ years cooking for weddings, corporate events, and parties across Ghana. I offer full catering packages and drop-off platters.',
    service_area: 'Kumasi, Accra, Tema',
    skills: ['Catering', 'Event planning', 'Traditional & continental cuisine'],
    job_categories: ['Events & Catering'],
    experience_years: 8,
    services: [
      { title: 'Full event catering (per head)', description: 'Buffet or plated. Jollof, waakye, fried rice, salads, proteins. Minimum 30 guests.', price: 85, duration_minutes: 480, category: 'Events & Catering', image_seed: 'catering1' },
      { title: 'Drop-off platters (office/lunch)', description: 'Jollof with chicken, waakye, or fried rice. Serves 5–10. Order by 10am for same-day delivery in Accra.', price: 120, duration_minutes: null, category: 'Events & Catering', image_seed: 'platter1' },
      { title: 'Traditional ceremony catering', description: 'Full traditional setup: fufu, soup, banku, grilled fish. Ideal for outdoor ceremonies.', price: 45, duration_minutes: 360, category: 'Events & Catering', image_seed: 'traditional1' },
    ],
  },
  {
    name: 'Abena Osei',
    email: 'abena.osei@demo.locallink.agency',
    phone: '+233 20 345 6789',
    role: 'farmer',
    bio: 'Smallholder farmer from the Eastern Region. I grow vegetables and plantain and sell fresh at farm gate and via LocalLink. No chemicals, good for the family table.',
    farm_location: 'Koforidua, Eastern Region',
    farm_lat: 6.0941,
    farm_lng: -0.2592,
    products: [
      { name: 'Fresh tomatoes (crate)', category: 'vegetables', quantity: 20, unit: 'crate', price: 180, image_seed: 'tomatoes' },
      { name: 'Plantain (ripe, medium)', category: 'fruits', quantity: 50, unit: 'bunch', price: 35, image_seed: 'plantain' },
      { name: 'Garden eggs (basket)', category: 'vegetables', quantity: 15, unit: 'bag', price: 25, image_seed: 'garden-eggs' },
      { name: 'Okro (fresh)', category: 'vegetables', quantity: 30, unit: 'kg', price: 18, image_seed: 'okro' },
    ],
  },
  {
    name: 'Yaw Boateng',
    email: 'yaw.boateng@demo.locallink.agency',
    phone: '+233 54 456 7890',
    role: 'driver',
    bio: 'Delivery driver in Accra and Tema. I do marketplace and job-related deliveries. Bike and car available. Reliable and on time.',
    vehicle_type: 'bike',
    area_of_operation: 'Accra, Tema, East Legon, Spintex',
  },
  {
    name: 'Afia Addo',
    email: 'afia.addo@demo.locallink.agency',
    phone: '+233 50 678 9012',
    role: 'artisan',
    bio: 'Domestic services professional in Accra. Cleaning, laundry, and home organisation. Reliable, discreet, and thorough. Available for one-off or recurring bookings.',
    service_area: 'Accra, East Legon, Cantonments, Osu',
    skills: ['House cleaning', 'Laundry', 'Home organisation'],
    job_categories: ['Domestic Services'],
    experience_years: 6,
    services: [
      { title: 'Standard home cleaning (3–4 hrs)', description: 'Full house clean: sweep, mop, dust, bathrooms, kitchen. Bring my own supplies. Ideal for 2–3 bedroom homes.', price: 150, duration_minutes: 240, category: 'Domestic Services', image_seed: 'cleaning1' },
      { title: 'Deep clean (half day)', description: 'Thorough deep clean including inside cupboards, windows, and high-traffic areas. Good for move-in/move-out or seasonal refresh.', price: 280, duration_minutes: 360, category: 'Domestic Services', image_seed: 'cleaning2' },
      { title: 'Laundry & ironing (per load)', description: 'Wash, dry, and iron. I collect and deliver in Accra. Minimum 2 loads.', price: 60, duration_minutes: 120, category: 'Domestic Services', image_seed: 'laundry1' },
    ],
  },
  {
    name: 'Ama Serwaa',
    email: 'ama.serwaa@demo.locallink.agency',
    phone: '+233 26 567 8901',
    role: 'company',
    bio: 'HR and operations at a small retail chain in Ghana. We use LocalLink to staff our stores and warehouses. Looking for reliable workers we can rehire.',
    company_name: 'Serwaa Retail Ltd',
    company_industry: 'Retail',
    company_location: 'Accra',
    company_size: '11-50',
    job_posts: [
      { title: 'Skilled carpenters (daily rate)', description: 'Looking for skilled carpenters! Hiring now. Furniture, joinery, and general carpentry. Apply today.', location: 'Accra', employment_type: 'contract', work_mode: 'onsite', pay_min: 250, pay_max: 250, currency: 'GHS', pay_period: 'day', job_term: 'contract', tags: ['carpentry', 'skilled labour'], image_url: 'https://images.unsplash.com/photo-1504148455328-c376907d081c?w=400&h=240&fit=crop&q=70' },
      { title: 'Store Associate (Accra)', description: 'Full-time store associate for our Accra branch. Cash handling, stock, customer service. Reliable and presentable.', location: 'Accra', employment_type: 'full_time', work_mode: 'onsite', pay_min: 1200, pay_max: 1500, currency: 'GHS', pay_period: 'month', job_term: 'permanent', tags: ['retail', 'customer service'], image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70' },
      { title: 'Warehouse Packer (Tema)', description: 'Packing and dispatching orders. Morning shifts, 5 days/week. Start ASAP.', location: 'Tema', employment_type: 'part_time', work_mode: 'onsite', pay_min: 15, pay_max: 18, currency: 'GHS', pay_period: 'hour', job_term: 'contract', tags: ['warehouse', 'logistics'], image_url: 'https://images.unsplash.com/photo-1586528116311-ad8dd3c8310d?w=400&h=240&fit=crop&q=70' },
      { title: 'Supervisor – Retail Operations', description: 'Supervise daily operations at one of our Accra stores. 2+ years retail experience. Good with people and systems.', location: 'Accra', employment_type: 'full_time', work_mode: 'onsite', pay_min: 1800, pay_max: 2200, currency: 'GHS', pay_period: 'month', job_term: 'permanent', tags: ['retail', 'supervisor'], image_url: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=400&h=240&fit=crop&q=70' },
    ],
  },
  {
    name: 'Kwame Owusu',
    email: 'kwame.owusu@demo.locallink.agency',
    phone: '+233 24 111 2233',
    role: 'artisan',
    bio: 'Licensed plumber in Accra and Tema. Leaks, blockages, new installations, and bathroom repairs. Over 10 years experience. Fair pricing, same-day callouts.',
    service_area: 'Accra, Tema, East Legon, Spintex',
    skills: ['Plumbing', 'Pipe fitting', 'Drainage'],
    job_categories: ['Skilled Labour'],
    experience_years: 10,
    services: [
      { title: 'Leak repair (per visit)', description: 'Find and fix leaks — taps, pipes, toilets. Includes labour; parts quoted separately. Same-day available in Accra/Tema.', price: 120, duration_minutes: 90, category: 'Plumbing', image_seed: 'plumber1' },
      { title: 'Blockage clearance', description: 'Unblock sinks, toilets, and drains. Power auger for stubborn blockages. Callout within 24 hours.', price: 150, duration_minutes: 60, category: 'Plumbing', image_seed: 'plumber2' },
      { title: 'Bathroom installation support', description: 'Install or replace WC, sink, shower fittings. Supply your fixtures or I can source. Quote after site visit.', price: 250, duration_minutes: 240, category: 'Plumbing', image_seed: 'plumber3' },
    ],
  },
  {
    name: 'Esi Tawiah',
    email: 'esi.tawiah@demo.locallink.agency',
    phone: '+233 55 444 5566',
    role: 'artisan',
    bio: 'Certified electrician. Residential and small commercial. Wiring, lighting, fault-finding, and meter work. Safe, certified, and insured.',
    service_area: 'Accra, Kumasi, Tema',
    skills: ['Electrical wiring', 'Lighting', 'Fault finding'],
    job_categories: ['Skilled Labour'],
    experience_years: 7,
    services: [
      { title: 'Electrical fault finding (per visit)', description: 'Trace and fix power cuts, tripping, flickering lights. Includes basic repairs. Same-day in Accra.', price: 80, duration_minutes: 60, category: 'Electrical', image_seed: 'electrician1' },
      { title: 'Lighting installation', description: 'Install ceiling lights, outdoor lights, switches. Bring your fittings or I supply. Per point from GHS 45.', price: 45, duration_minutes: 45, category: 'Electrical', image_seed: 'electrician2' },
      { title: 'Room wiring (small job)', description: 'Wire one room or extension: sockets, switches, lighting. Compliant with local standards. Quote after visit.', price: 350, duration_minutes: 360, category: 'Electrical', image_seed: 'electrician3' },
    ],
  },
  {
    name: 'Kwabena Mensah',
    email: 'kwabena.mensah@demo.locallink.agency',
    phone: '+233 20 777 8899',
    role: 'artisan',
    bio: 'Mason and general builder. Blockwork, plastering, tiling, small extensions. Quality work for homes and shops in Greater Accra.',
    service_area: 'Accra, Tema, Dodowa',
    skills: ['Masonry', 'Plastering', 'Tiling'],
    job_categories: ['Skilled Labour'],
    experience_years: 12,
    services: [
      { title: 'Blockwork (per m²)', description: 'Single or double block walls, foundations. Quality sand and blocks. Ideal for walls, room divisions, compound walls.', price: 55, duration_minutes: null, category: 'Masonry', image_seed: 'mason1' },
      { title: 'Plastering (per m²)', description: 'Smooth or rough cast plaster for interior and exterior. Ready for paint or finish. Minimum 10 m².', price: 35, duration_minutes: null, category: 'Masonry', image_seed: 'mason2' },
      { title: 'Tiling (per m²)', description: 'Floor and wall tiling — bathroom, kitchen, living area. Supply your tiles or I source. Adhesive and labour included.', price: 65, duration_minutes: null, category: 'Masonry', image_seed: 'mason3' },
    ],
  },
]

// Stable, correct images: Wikimedia Commons (CC) for food/produce; Unsplash for services
const IMAGE_URLS = {
  // Kofi – Events & Catering (Ghanaian dishes)
  catering1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/f/fa/Ghana_Jollof_Rice_with_Chicken.jpg/400px-Ghana_Jollof_Rice_with_Chicken.jpg',
  platter1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/3/35/Jollof_rice_with_fried_fish_and_plantain.jpg/400px-Jollof_rice_with_fried_fish_and_plantain.jpg',
  traditional1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/e/eb/Ghana_fufu.jpg/400px-Ghana_fufu.jpg',
  // Afia – Domestic (cleaning/laundry)
  cleaning1: 'https://images.unsplash.com/photo-1581578731548-c64695cc6952?w=400&h=300&fit=crop',
  cleaning2: 'https://images.unsplash.com/photo-1563453392212-326f5e854473?w=400&h=300&fit=crop',
  laundry1: 'https://images.unsplash.com/photo-1582735689369-4fe89db7114c?w=400&h=300&fit=crop',
  // Abena – Produce
  tomatoes: 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a2/Tomato.jpg/400px-Tomato.jpg',
  plantain: 'https://upload.wikimedia.org/wikipedia/commons/thumb/9/96/Bunch_of_plantain.jpg/400px-Bunch_of_plantain.jpg',
  okro: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/84/Okra_from_farm.jpg/400px-Okra_from_farm.jpg',
  'garden-eggs': 'https://upload.wikimedia.org/wikipedia/commons/thumb/a/a4/Garden_Egg%28Fresh%29.jpg/400px-Garden_Egg%28Fresh%29.jpg',
  // Kwame – Plumbing (valid Unsplash URLs; distinct from landing)
  // Kwame – Plumbing: job-matched images
  plumber1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/8/88/A_Plumbing_work_in_Walewale.jpg/400px-A_Plumbing_work_in_Walewale.jpg', // Leak repair – Ghana plumbing
  plumber2: '/images/blockage-clearance.png', // Blockage clearance – desktop screenshot
  plumber3: 'https://images.unsplash.com/photo-1620626011761-996317b8d101?w=400&h=300&fit=crop', // Bathroom installation – bathroom
  // Esi – Electrical: job-matched images
  electrician1: '/images/electrical-fault.png', // Electrical fault finding – desktop screenshot
  electrician2: '/images/lighting-installation.png', // Lighting installation – desktop screenshot
  electrician3: 'https://images.unsplash.com/photo-1586023492125-27b2c045efd7?w=400&h=300&fit=crop', // Room wiring – room interior
  // Kwabena – Masonry / tiling / plastering: project images from desktop
  mason1: 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Ghanaian_Construction_Workers.jpg/400px-Ghanaian_Construction_Workers.jpg', // Blockwork – construction
  mason2: '/images/plastering.png', // Plastering – desktop screenshot
  mason3: '/images/tiling.png', // Tiling – desktop screenshot
}
function productImage(seed) {
  if (IMAGE_URLS[seed]) return IMAGE_URLS[seed]
  if (String(seed).startsWith('profile-')) return 'https://images.unsplash.com/photo-1535713875002-d1d0f377253a?w=400&h=300&fit=crop'
  return 'https://images.unsplash.com/photo-1577223625814-096a56d7e7b6?w=400&h=300&fit=crop'
}

// Cover/banner for profile depth (Ghana-appropriate scene)
const COVER_IMAGE = 'https://images.unsplash.com/photo-1516026672322-bc52d61a55d5?w=1200&h=400&fit=crop'

const DEMO_EMAILS = USERS.map((u) => u.email)

async function run() {
  // Preserve demo user IDs so sessions and feed keep working. Only clear dependent data we re-insert.
  const demoIds = await pool.query(
    "select id from users where email = any($1::text[]) and deleted_at is null",
    [DEMO_EMAILS],
  )
  const ids = demoIds.rows.map((r) => r.id)
  if (ids.length) {
    await pool.query('delete from artisan_services where artisan_user_id = any($1::uuid[])', [ids])
    const farmerIds = await pool.query('select id from farmers where user_id = any($1::uuid[])', [ids])
    const fid = farmerIds.rows.map((r) => r.id)
    if (fid.length) await pool.query('delete from products where farmer_id = any($1::uuid[])', [fid])
    const companyIds = await pool.query('select id from companies where owner_user_id = any($1::uuid[])', [ids])
    const cids = companyIds.rows.map((r) => r.id)
    if (cids.length) await pool.query('delete from job_posts where company_id = any($1::uuid[])', [cids])
  }

  const passwordHash = await bcrypt.hash(SEED_PASSWORD, 10)
  const logins = []
  let totalArtisanServices = 0
  let totalJobPosts = 0

  for (const u of USERS) {
    const refCode = genRefCode()
    const profilePic = productImage(`profile-${u.email}`)
    const r = await pool.query(
      `insert into users (name, email, phone, password_hash, role, referral_code, profile_pic)
       values ($1, $2, $3, $4, $5, $6, $7)
       on conflict (email) do update set
         name = excluded.name,
         phone = excluded.phone,
         password_hash = excluded.password_hash,
         role = excluded.role,
         profile_pic = excluded.profile_pic,
         updated_at = now()
       returning id, email, role`,
      [u.name, u.email, u.phone ?? null, passwordHash, u.role, refCode, profilePic],
    )
    const user = r.rows[0]
    if (!user) continue

    const userId = user.id

    await pool.query(
      `insert into wallets (user_id, balance, currency) values ($1, 0, 'GHS')
       on conflict (user_id) do nothing`,
      [userId],
    )

    await pool.query(
      `insert into user_profiles (user_id, bio, cover_photo, private_profile, updated_at)
       values ($1, $2, $3, false, now())
       on conflict (user_id) do update set bio = excluded.bio, cover_photo = coalesce(excluded.cover_photo, user_profiles.cover_photo), updated_at = now()`,
      [userId, u.bio ?? null, COVER_IMAGE],
    )

    logins.push({ name: u.name, email: u.email, role: u.role, password: SEED_PASSWORD })

    if (u.role === 'artisan') {
      await pool.query(
        `insert into artisans (user_id, skills, primary_skill, experience_years, service_area, job_categories, updated_at)
         values ($1, $2, $3, $4, $5, $6::text[], now())
         on conflict (user_id) do update set
           skills = excluded.skills,
           primary_skill = excluded.primary_skill,
           experience_years = excluded.experience_years,
           service_area = excluded.service_area,
           job_categories = excluded.job_categories,
           updated_at = now()`,
        [
          userId,
          u.skills ?? null,
          u.skills?.[0] ?? null,
          u.experience_years ?? 5,
          u.service_area ?? null,
          u.job_categories ?? null,
        ],
      )

      if (u.services?.length) {
        const art = await pool.query('select id from artisans where user_id = $1', [userId])
        const artisanId = art.rows[0]?.id
        if (artisanId) {
          for (const s of u.services) {
            await pool.query(
              `insert into artisan_services (artisan_user_id, title, description, price, currency, duration_minutes, category, sort_order, image_url)
               values ($1, $2, $3, $4, 'GHS', $5, $6, 0, $7)`,
              [
                userId,
                s.title,
                s.description ?? null,
                s.price,
                s.duration_minutes ?? null,
                s.category ?? null,
                productImage(s.image_seed),
              ],
            )
            totalArtisanServices += 1
          }
        }
      }
    }

    if (u.role === 'farmer') {
      await pool.query(
        `insert into farmers (user_id, farm_location, farm_lat, farm_lng, updated_at)
         values ($1, $2, $3, $4, now())
         on conflict (user_id) do update set
           farm_location = excluded.farm_location,
           farm_lat = excluded.farm_lat,
           farm_lng = excluded.farm_lng,
           updated_at = now()`,
        [userId, u.farm_location ?? null, u.farm_lat ?? null, u.farm_lng ?? null],
      )

      const far = await pool.query('select id from farmers where user_id = $1', [userId])
      const farmerId = far.rows[0]?.id
      if (farmerId && u.products?.length) {
        for (const p of u.products) {
          const media = [{ url: productImage(p.image_seed), kind: 'image' }]
          await pool.query(
            `insert into products (farmer_id, name, category, quantity, unit, price, status, image_url, media, updated_at)
             values ($1, $2, $3, $4, $5, $6, 'available', $7, $8::jsonb, now())`,
            [
              farmerId,
              p.name,
              p.category,
              p.quantity,
              p.unit,
              p.price,
              productImage(p.image_seed),
              JSON.stringify(media),
            ],
          )
        }
      }
    }

    if (u.role === 'driver') {
      await pool.query(
        `insert into drivers (user_id, vehicle_type, area_of_operation, status, updated_at)
         values ($1, $2, $3, 'approved', now())
         on conflict (user_id) do update set
           vehicle_type = excluded.vehicle_type,
           area_of_operation = excluded.area_of_operation,
           status = 'approved',
           updated_at = now()`,
        [userId, u.vehicle_type ?? 'bike', u.area_of_operation ?? null],
      )
    }

    if (u.role === 'company') {
      const companySlug = (u.company_name ?? 'demo-company').toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '')
      await pool.query(
        `insert into companies (owner_user_id, slug, name, industry, location, size_range, description, updated_at)
         values ($1, $2, $3, $4, $5, $6, $7, now())
         on conflict (owner_user_id) do update set
           slug = coalesce(excluded.slug, companies.slug),
           name = excluded.name,
           industry = excluded.industry,
           location = excluded.location,
           size_range = excluded.size_range,
           description = excluded.description,
           updated_at = now()`,
        [
          userId,
          companySlug || 'serwaa-retail',
          u.company_name ?? 'Demo Company',
          u.company_industry ?? null,
          u.company_location ?? null,
          u.company_size ?? null,
          u.bio ?? null,
        ],
      )
      const comp = await pool.query('select id from companies where owner_user_id = $1 limit 1', [userId])
      const companyId = comp.rows[0]?.id
      if (companyId) {
        try {
          await pool.query(
            `insert into company_members (company_id, user_id, workspace_role, created_by, updated_at)
             values ($1, $2, 'owner', $2, now())
             on conflict (company_id, user_id) do update set workspace_role = 'owner', updated_at = now()`,
            [companyId, userId],
          )
        } catch (e) {
          if (String(e?.code || '') !== '42P01') console.warn('company_members insert skipped:', e?.message)
        }
      }
      if (companyId && u.job_posts?.length) {
        for (const j of u.job_posts) {
          try {
            await pool.query(
              `insert into job_posts (company_id, title, description, location, employment_type, work_mode, pay_min, pay_max, currency, pay_period, job_term, tags, status, closes_at, image_url, updated_at)
               values ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12::text[], 'open', $13, $14, now())`,
              [
                companyId,
                j.title,
                j.description ?? '',
                j.location ?? null,
                j.employment_type ?? null,
                j.work_mode ?? null,
                j.pay_min ?? null,
                j.pay_max ?? null,
                j.currency ?? 'GHS',
                j.pay_period ?? 'month',
                j.job_term ?? null,
                j.tags ?? null,
                j.closes_at ?? null,
                j.image_url ?? null,
              ],
            )
            totalJobPosts += 1
          } catch (err) {
            console.error('job_posts insert failed:', err?.message, j?.title)
          }
        }
      }
    }
  }

  console.log('\n--- Seed complete. Demo logins (password for all: Ghana2025!) ---\n')
  console.log('| Name           | Email                              | Role    | Password   |')
  console.log('|----------------|------------------------------------|---------|------------|')
  for (const l of logins) {
    console.log(`| ${l.name.padEnd(14)} | ${l.email.padEnd(34)} | ${l.role.padEnd(7)} | ${l.password} |`)
  }
  console.log(`\nCreated: ${totalArtisanServices} artisan services (Marketplace → Services tab), ${totalJobPosts} company job posts (Employers → /jobs).`)
  console.log('Use these to log in at https://locallink.agency (or your local URL).')
  console.log('Marketplace: Farmers & Florists tab = Abena\'s produce; Services tab = Kofi + Afia.')
  console.log('Employers: open /jobs to see Serwaa Retail Ltd roles.\n')
  process.exit(0)
}

run().catch((err) => {
  console.error(err)
  process.exit(1)
})
