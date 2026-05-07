import type { AxiosInstance } from 'axios'

/**
 * Réassocie l’abonnement Web Push du navigateur (endpoint matériel) au compte actuellement
 * connecté. À appeler après login / changement de compte tant que l’utilisateur n’a pas
 * révoqué la permission notifications dans le navigateur.
 */
export async function resyncWebPushSubscriptionForCurrentUser(api: AxiosInstance): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return
  }
  if (Notification.permission !== 'granted') return
  try {
    const registration = await navigator.serviceWorker.register('/pinova-push-sw.js', { scope: '/push/' })
    const sub = await registration.pushManager.getSubscription()
    if (!sub) return
    const json = sub.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    if (!json.endpoint || !json.keys?.p256dh || !json.keys?.auth) return
    await api.post('notifications/push_subscribe/', {
      endpoint: json.endpoint,
      p256dh: json.keys.p256dh,
      auth: json.keys.auth,
    })
  } catch {
    /* push désactivé côté serveur ou plus d’abonnement local */
  }
}

/**
 * Désactive l’endpoint côté backend avant de perdre le JWT — le même appareil / navigateur
 * peut ensuite rattacher l’endpoint à un autre compte via resyncWebPushSubscriptionForCurrentUser.
 */
export async function unregisterWebPushFromBackend(api: AxiosInstance): Promise<void> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration('/push/')
    if (!registration) return
    const sub = await registration.pushManager.getSubscription()
    if (!sub?.endpoint) return
    await api.post('notifications/push_unsubscribe/', { endpoint: sub.endpoint })
  } catch {
    /* ignore */
  }
}
