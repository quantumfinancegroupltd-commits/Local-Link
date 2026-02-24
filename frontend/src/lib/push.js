/**
 * Web Push: request permission, subscribe with VAPID key from API, send subscription to backend.
 */

const baseURL = import.meta.env.VITE_API_BASE_URL || '/api'

function urlBase64ToUint8Array(base64String) {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = atob(base64)
  const output = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) output[i] = rawData.charCodeAt(i)
  return output
}

/**
 * Register SW, get VAPID key, request permission, subscribe, POST to backend.
 * Returns { ok: true } or { ok: false, error: string }.
 */
export async function enablePushNotifications() {
  if (!('serviceWorker' in navigator) || !('PushManager' in window)) {
    return { ok: false, error: 'Push is not supported in this browser.' }
  }
  let registration
  try {
    registration = await navigator.serviceWorker.getRegistration()
    if (!registration) {
      registration = await navigator.serviceWorker.register('/sw.js', { scope: '/' })
      await registration.ready
    }
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not register service worker.' }
  }

  const res = await fetch(`${baseURL}/notifications/vapid-public-key`)
  if (!res.ok) {
    return { ok: false, error: 'Push is not configured on the server.' }
  }
  const { publicKey } = await res.json()
  if (!publicKey) return { ok: false, error: 'No VAPID key from server.' }

  let permission = window.Notification?.permission
  if (permission === 'denied') return { ok: false, error: 'Notifications are blocked. Please allow them in your browser settings.' }
  if (permission !== 'granted') {
    permission = await window.Notification.requestPermission()
    if (permission !== 'granted') return { ok: false, error: 'Permission denied.' }
  }

  const applicationServerKey = urlBase64ToUint8Array(publicKey)
  let subscription
  try {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey,
    })
  } catch (e) {
    return { ok: false, error: e?.message || 'Could not subscribe to push.' }
  }

  const token = localStorage.getItem('locallink_token')
  if (!token) return { ok: false, error: 'You must be logged in to enable push.' }

  const postRes = await fetch(`${baseURL}/notifications/push-subscribe`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
    body: JSON.stringify({ subscription: subscription.toJSON() }),
  })
  if (!postRes.ok) {
    const data = await postRes.json().catch(() => ({}))
    return { ok: false, error: data?.message || 'Failed to save subscription.' }
  }
  return { ok: true }
}

/**
 * Check if push is supported and permission is granted (does not check if we have a subscription).
 */
export function isPushSupported() {
  return !!(typeof navigator !== 'undefined' && navigator.serviceWorker && window.PushManager && window.Notification)
}
