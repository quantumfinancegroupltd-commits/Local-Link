/**
 * One-off: point Abena Osei and Afia Addo's feed posts at new image files.
 * Run AFTER copying the two images to the server (see instructions below).
 *
 * On server: cd ~/LocalLink/backend && node scripts/fix-post-media-abena-afia.js
 *
 * From your Mac, copy your desktop screenshots to the server first:
 *   scp -i "$HOME/Downloads/Local Link SSH Key/ssh-key-2026-02-18 (2).key" \
 *     "$HOME/Desktop/Screenshot 2026-02-24 at 23.32.44.png" \
 *     ubuntu@locallink.agency:/home/ubuntu/locallink-uploads/abena-screenshot.png
 *   scp -i "$HOME/Downloads/Local Link SSH Key/ssh-key-2026-02-18 (2).key" \
 *     "$HOME/Desktop/Screenshot 2026-02-24 at 23.50.36.png" \
 *     ubuntu@locallink.agency:/home/ubuntu/locallink-uploads/afia-screenshot.png
 *
 * If your files have no extension or .jpg, rename in the SCP target (e.g. abena-screenshot.jpg)
 * and change the URLs in this script to match.
 */
import 'dotenv/config'
import { pool } from '../src/db/pool.js'

const ABENA_MEDIA = [{ url: '/api/uploads/abena-screenshot.png', kind: 'image' }]
const AFIA_MEDIA = [{ url: '/api/uploads/afia-screenshot.png', kind: 'image' }]

async function run() {
  // Find Abena Osei's "Today's Harvest" post
  const abena = await pool.query(
    `select p.id from user_posts p
     join users u on u.id = p.user_id and u.deleted_at is null
     where coalesce(u.name, '') ilike '%Abena%Osei%' and p.body ilike '%Today%Harvest%'
     order by p.created_at desc limit 1`,
  )
  if (abena.rows.length) {
    await pool.query('update user_posts set media = $1::jsonb where id = $2', [
      JSON.stringify(ABENA_MEDIA),
      abena.rows[0].id,
    ])
    console.log('Updated Abena Osei post (Today\'s Harvest) -> abena-screenshot.png')
  } else {
    console.log('No Abena Osei "Today\'s Harvest" post found.')
  }

  // Find Afia Addo's "House clean" post
  const afia = await pool.query(
    `select p.id from user_posts p
     join users u on u.id = p.user_id and u.deleted_at is null
     where coalesce(u.name, '') ilike '%Afia%Addo%' and p.body ilike '%House clean%'
     order by p.created_at desc limit 1`,
  )
  if (afia.rows.length) {
    await pool.query('update user_posts set media = $1::jsonb where id = $2', [
      JSON.stringify(AFIA_MEDIA),
      afia.rows[0].id,
    ])
    console.log('Updated Afia Addo post (House clean) -> afia-screenshot.png')
  } else {
    console.log('No Afia Addo "House clean" post found.')
  }

  await pool.end()
}

run().catch((e) => {
  console.error(e)
  process.exit(1)
})
