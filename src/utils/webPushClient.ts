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
    await api.post('notifications/push_subscribe/', {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    })
    return { ok: true }
  } catch {
    return { ok: false, error: 'generic' }
  }
}

/** True si permission accordée + abonnement push local présent + clé serveur utilisable. */
export async function isWebPushActiveForUi(api: AxiosInstance): Promise<boolean> {
  if (!isWebPushSupported()) return false
  if (Notification.permission !== 'granted') return false
  try {
    const keyResp = await api.get('notifications/push_public_key/')
    const publicKey = String(keyResp.data?.public_key || '')
    const enabled = !!keyResp.data?.enabled && !!publicKey
    if (!enabled) return false
    const registration = await navigator.serviceWorker.register('/pinova-push-sw.js', { scope: '/push/' })
    const existingSub = await registration.pushManager.getSubscription()
    return !!existingSub
  } catch {
    return false
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
