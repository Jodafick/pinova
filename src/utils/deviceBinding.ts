const STORAGE_KEY = 'fotoce_device_binding'

/**
 * Identifiant stable navigateur pour l’intent referral (header `X-Fotoce-Device-Binding`).
 */
export function ensureDeviceBindingId(): string {
  if (typeof window === 'undefined') return ''
  try {
    let v = window.localStorage.getItem(STORAGE_KEY)
    if (!v) {
      v =
        typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
          ? crypto.randomUUID()
          : `pb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 14)}`
      window.localStorage.setItem(STORAGE_KEY, v)
    }
    return v
  } catch {
    return ''
  }
}
