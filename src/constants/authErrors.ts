/** Aligné sur `accounts.mail_delivery.EMAIL_DELIVERY_ERROR_CODE` (backend Django). */
export const EMAIL_DELIVERY_UNAVAILABLE_CODE = 'email_delivery_unavailable'

export function readApiErrorCode(data: unknown): string | undefined {
  if (!data || typeof data !== 'object') return undefined
  const raw = (data as Record<string, unknown>).code
  if (Array.isArray(raw) && typeof raw[0] === 'string') return raw[0]
  if (typeof raw === 'string') return raw
  return undefined
}
