/**
 * Bus temps réel notifications in-app :
 * - WebSocket `/api/notifications/ws`
 * - fallback polling `GET notifications/events`
 * - fallback badge `X-Pinova-Unread-Notifications` (via `applyUnreadCountFromResponseHeader`)
 */
export type NotificationLivePayload = {
  id: number
  notification_type?: string
  title?: string
  message?: string
  action_url?: string
  metadata?: Record<string, unknown>
  foto_id?: number | null
  foto_slug?: string | null
  comment_id?: number | null
  is_read?: boolean
  created_at?: string
  sender_id?: number | null
  recipient_id?: number | null
  sender_username?: string
  sender_avatar_color?: string
  sender_avatar_url?: string | null
  /** Serveur : afficher un toast in-app pour cet événement (défaut true sauf digest / rang). */
  in_app_toast?: boolean
}

const unreadHeaderListeners = new Set<(n: number) => void>()
const liveNotificationListeners = new Set<(payload: NotificationLivePayload) => void>()
let lastKnownUnreadCount = 0

/** Nom d'en-tête (minuscules pour axios dans le navigateur). */
export const UNREAD_NOTIFICATION_RESPONSE_HEADER = 'x-pinova-unread-notifications'

export function subscribeUnreadCountFromHeader(listener: (count: number) => void): () => void {
  unreadHeaderListeners.add(listener)
  return () => unreadHeaderListeners.delete(listener)
}

export function subscribeNotificationLive(
  listener: (payload: NotificationLivePayload) => void,
): () => void {
  liveNotificationListeners.add(listener)
  return () => liveNotificationListeners.delete(listener)
}

export function emitNotificationLive(payload: NotificationLivePayload): void {
  for (const fn of [...liveNotificationListeners]) {
    try {
      fn(payload)
    } catch {
      /* ne pas casser le transport */
    }
  }
}

export function applyUnreadCountFromResponseHeader(raw: string | null | undefined): void {
  if (raw === undefined || raw === null || raw === '') return
  const n = parseInt(String(raw), 10)
  if (!Number.isFinite(n) || n < 0) return
  lastKnownUnreadCount = n
  for (const fn of [...unreadHeaderListeners]) {
    try {
      fn(n)
    } catch {
      /* ne pas casser l'intercepteur */
    }
  }
}

/** Incrément optimiste du badge quand une notif WS arrive avant le prochain en-tête HTTP. */
export function bumpUnreadCountOptimistic(delta = 1): void {
  lastKnownUnreadCount = Math.max(0, lastKnownUnreadCount + delta)
  for (const fn of [...unreadHeaderListeners]) {
    try {
      fn(lastKnownUnreadCount)
    } catch {
      /* noop */
    }
  }
}
