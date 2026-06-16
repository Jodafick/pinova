self.addEventListener('push', (event) => {
  let payload = {}
  try {
    payload = event.data ? event.data.json() : {}
  } catch (err) {
    payload = {}
  }

  const title = payload.title || 'FOTOCE'
  const options = {
    body: payload.body || 'Nouvelle notification',
    icon: '/pwa-192x192.png',
    badge: '/pwa-192x192.png',
    data: {
      action_url: payload.action_url || '/',
      foto_slug: payload.foto_slug || '',
      notification_type: payload.notification_type || '',
      metadata_json: payload.metadata_json || '',
      notification_id: payload.notification_id,
      comment_id: payload.comment_id != null && payload.comment_id !== '' ? String(payload.comment_id) : '',
      sender_username: payload.sender_username || '',
    },
  }
  event.waitUntil(self.registration.showNotification(title, options))
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const raw = (event.notification && event.notification.data) || {}
  const targetPath = raw.action_url || '/'
  const payload = {
    type: 'fotoce_push_click',
    action_url: targetPath,
    foto_slug: raw.foto_slug || '',
    notification_type: raw.notification_type || '',
    metadata_json: raw.metadata_json || '',
    notification_id: raw.notification_id,
    comment_id: raw.comment_id || '',
    sender_username: raw.sender_username || '',
  }
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientsArr) => {
      const origin = self.location.origin
      const openUrl =
        typeof targetPath === 'string' && (targetPath.startsWith('http://') || targetPath.startsWith('https://'))
          ? targetPath
          : `${origin}${targetPath.startsWith('/') ? '' : '/'}${targetPath}`

      for (const client of clientsArr) {
        if ('focus' in client) {
          client.postMessage(payload)
          return client.focus()
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(openUrl)
      }
      return undefined
    })
  )
})
