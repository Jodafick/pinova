import type { AxiosInstance } from 'axios'

export function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const buffer = new ArrayBuffer(rawData.length)
  const outputArray = new Uint8Array(buffer)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

export function isWebPushSupported(): boolean {
  return (
    typeof window !== 'undefined' &&
    'serviceWorker' in navigator &&
    'PushManager' in window &&
    'Notification' in window
  )
}

export type WebPushActivateError = 'unsupported' | 'denied' | 'unavailable' | 'generic'

/** Abonnement push du navigateur actuel (/push/), ou null si absent. */
export async function getLocalWebPushSubscription(): Promise<PushSubscription | null> {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    return null
  }
  try {
    const registration = await navigator.serviceWorker.getRegistration('/push/')
    if (!registration) return null
    return (await registration.pushManager.getSubscription()) ?? null
  } catch {
    return null
  }
}

/** État enregistré sur le serveur pour l’endpoint de cet appareil (utilisateur JWT). */
export async function fetchWebPushBackendDeviceState(
  api: AxiosInstance,
  endpoint: string,
): Promise<{ backendRegistered: boolean; backendActive: boolean }> {
  try {
    const { data } = await api.post<{
      backend_registered?: boolean
      backend_active?: boolean
    }>('notifications/push_device_status/', { endpoint })
    return {
      backendRegistered: !!data?.backend_registered,
      backendActive: !!data?.backend_active,
    }
  } catch {
    return { backendRegistered: false, backendActive: false }
  }
}

export async function activateWebPushNotifications(
  api: AxiosInstance,
): Promise<{ ok: true } | { ok: false; error: WebPushActivateError }> {
  if (!isWebPushSupported()) {
    return { ok: false, error: 'unsupported' }
  }
  const permission = await Notification.requestPermission()
  if (permission !== 'granted') {
    return { ok: false, error: 'denied' }
  }
  try {
    const keyResp = await api.get('notifications/push_public_key/')
    const publicKey = String(keyResp.data?.public_key || '')
    const enabled = !!keyResp.data?.enabled && !!publicKey
    if (!enabled) {
      return { ok: false, error: 'unavailable' }
    }
    const registration = await navigator.serviceWorker.register('/pinova-push-sw.js', { scope: '/push/' })
    const existingSub = await registration.pushManager.getSubscription()
    const subscription =
      existingSub ||
      (await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(publicKey) as BufferSource,
      }))
    const json = subscription.toJSON() as { endpoint?: string; keys?: { p256dh?: string; auth?: string } }
    const endpoint = String(json.endpoint ?? '').trim()
    const p256dh = String(json.keys?.p256dh ?? '').trim()
    const auth = String(json.keys?.auth ?? '').trim()
    if (!endpoint || !p256dh || !auth) {
      return { ok: false, error: 'generic' }
    }
    await api.post('notifications/push_subscribe/', {
      endpoint,
      p256dh,
      auth,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'generic' }
  }
}

/**
 * True si ce navigateur reçoit les push pour l’utilisateur connecté selon le **backend**
 * (`PushSubscription.is_active` pour cet endpoint) + souscription locale + permission.
 */
export async function isWebPushActiveForUi(api: AxiosInstance): Promise<boolean> {
  if (!isWebPushSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    const ready = await isWebPushBackendReady(api)
    if (!ready) return false
    const existingSub = await getLocalWebPushSubscription()
    if (!existingSub?.endpoint) return false
    const { backendRegistered, backendActive } = await fetchWebPushBackendDeviceState(
      api,
      existingSub.endpoint,
    )
    return backendRegistered && backendActive
  } catch {
    return false
  }
}

/** Coupe l’endpoint sur le serveur pour ce compte, puis supprime la souscription navigateur locale. */
export async function deactivateWebPushNotifications(api: AxiosInstance): Promise<{ ok: boolean }> {
  if (!isWebPushSupported()) return { ok: true }
  try {
    const sub = await getLocalWebPushSubscription()
    if (!sub?.endpoint) return { ok: true }
    await api.post('notifications/push_unsubscribe/', { endpoint: sub.endpoint })
    await sub.unsubscribe()
    return { ok: true }
  } catch {
    return { ok: false }
  }
}

/** Vérifie si le backend autorise l’activation (sans toucher au SW). */
export async function isWebPushBackendReady(api: AxiosInstance): Promise<boolean> {
  try {
    const keyResp = await api.get('notifications/push_public_key/')
    const publicKey = String(keyResp.data?.public_key || '')
    return !!keyResp.data?.enabled && !!publicKey
  } catch {
    return false
  }
}
