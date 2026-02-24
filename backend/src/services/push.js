/**
 * Web Push: send browser push notifications when in-app notifications are created.
 * Requires VAPID keys in env; if missing, push is skipped (in-app only).
 */
import webpush from 'web-push'
import { pool } from '../db/pool.js'

let vapidConfigured = false

function initVapid() {
  if (vapidConfigured) return true
  const publicKey = process.env.VAPID_PUBLIC_KEY?.trim()
  const privateKey = process.env.VAPID_PRIVATE_KEY?.trim()
  if (!publicKey || !privateKey) return false
  try {
    webpush.setVapidDetails('mailto:notifications@locallink.agency', publicKey, privateKey)
    vapidConfigured = true
    return true
  } catch {
    return false
  }
}

/**
 * Get all push subscriptions for a user.
 */
export async function getSubscriptionsByUserId(userId) {
  const r = await pool.query(
    `select id, endpoint, p256dh, auth from push_subscriptions where user_id = $1`,
    [userId],
  )
  return r.rows
}

/**
 * Save a push subscription for the current user (from browser PushManager.subscribe()).
 */
export async function saveSubscription(userId, subscription) {
  const endpoint = subscription?.endpoint
  const keys = subscription?.keys
  if (!endpoint || !keys?.p256dh || !keys?.auth) return null
  await pool.query(
    `insert into push_subscriptions (user_id, endpoint, p256dh, auth)
     values ($1, $2, $3, $4)
     on conflict (endpoint) do update set user_id = $1, p256dh = $3, auth = $4, created_at = now()
     returning *`,
    [userId, endpoint, keys.p256dh, keys.auth],
  )
  return true
}

/**
 * Remove a push subscription by endpoint (e.g. when user unsubscribes).
 */
export async function removeSubscription(userId, endpoint) {
  const r = await pool.query(
    `delete from push_subscriptions where user_id = $1 and endpoint = $2`,
    [userId, String(endpoint).trim()],
  )
  return r.rowCount > 0
}

/**
 * Send a web push to one subscription. Payload: { title, body?, url?, tag? }.
 */
async function sendOne(subscriptionRow, payload) {
  const sub = {
    endpoint: subscriptionRow.endpoint,
    keys: { p256dh: subscriptionRow.p256dh, auth: subscriptionRow.auth },
  }
  const body = JSON.stringify({
    title: payload.title ?? 'LocalLink',
    body: payload.body ?? '',
    url: payload.url ?? '/notifications',
    tag: payload.tag ?? 'locallink',
  })
  await webpush.sendNotification(sub, body)
}

/**
 * Send push notifications to all subscriptions for the user. Fire-and-forget; errors are logged but not thrown.
 */
export async function sendPushToUser(userId, payload) {
  if (!initVapid()) return
  const subs = await getSubscriptionsByUserId(userId)
  if (subs.length === 0) return
  const title = String(payload?.title ?? 'LocalLink').slice(0, 200)
  const body = payload?.body != null ? String(payload.body).slice(0, 500) : ''
  const url = payload?.url ?? '/notifications'
  const tag = payload?.tag ?? 'locallink'
  const p = { title, body, url, tag }
  for (const sub of subs) {
    sendOne(sub, p).catch((err) => {
      if (err?.statusCode === 410 || err?.statusCode === 404) {
        pool.query(`delete from push_subscriptions where endpoint = $1`, [sub.endpoint]).catch(() => {})
      }
    })
  }
}
