/* Service worker for Web Push. Receives push events and shows a notification. */
self.addEventListener('push', function (event) {
  if (!event.data) return
  let payload
  try {
    payload = event.data.json()
  } catch {
    return
  }
  const title = payload.title || 'LocalLink'
  const body = payload.body || ''
  const url = payload.url || '/notifications'
  const tag = payload.tag || 'locallink'
  const options = {
    body: body.slice(0, 200),
    tag: tag,
    icon: '/locallink-logo.png',
    badge: '/locallink-logo.png',
    data: { url: url },
    requireInteraction: false,
  }
  event.waitUntil(
    self.registration.showNotification(title, options)
  )
})

self.addEventListener('notificationclick', function (event) {
  event.notification.close()
  const url = event.notification.data?.url || '/notifications'
  const fullUrl = new URL(url, self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (const client of clientList) {
        if (client.url.startsWith(self.location.origin) && 'focus' in client) {
          client.navigate(fullUrl)
          return client.focus()
        }
      }
      if (self.clients.openWindow) return self.clients.openWindow(fullUrl)
    })
  )
})
