import type { Router } from 'vue-router'

/**
 * Données minimales pour router comme une notification API / un clic push (service worker).
 */
export type WebNotificationNavInput = {
  metadata?: Record<string, unknown> | null
  pin_slug?: string | null
  pin_id?: number | null
  comment_id?: number | string | null
  action_url?: string | null
  notification_type?: string | null
  sender_username?: string | null
}

export type WebNotificationNavMode = 'header' | 'notificationsPage'

function parseCommentQueryId(raw: unknown): string | undefined {
  if (raw === null || raw === undefined || raw === '') return undefined
  const n = typeof raw === 'number' ? raw : parseInt(String(raw), 10)
  return Number.isFinite(n) && n > 0 ? String(Math.floor(n)) : undefined
}

function mergeRouteQuery(
  base: Record<string, string | string[] | undefined> | undefined,
  patch: Record<string, string>,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  if (base) {
    for (const [k, v] of Object.entries(base)) {
      if (v === undefined) continue
      if (typeof v === 'string' && v) out[k] = v
      else if (Array.isArray(v) && v.length) out[k] = v
    }
  }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v
  }
  return out
}

/**
 * Navigation unique pour liste déroulante header, page /notifications, et push web.
 * Aligné sur `Pinova-Mobile` `navigateFromNotificationNavInput` (types metadata, contest, parrainage).
 */
export function navigateWebNotificationDeepLink(
  router: Router,
  input: WebNotificationNavInput,
  mode: WebNotificationNavMode,
  routeContext?: { path: string; query: Record<string, string | string[]> },
): void {
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const metadataKind = String(meta.kind || '').trim().toLowerCase()
  const pinSlug = (input.pin_slug || '').trim()
  const commentId = parseCommentQueryId(input.comment_id)
  const isStoryPin = Boolean(meta.is_story && pinSlug)
  const nType = String(input.notification_type || '').trim().toLowerCase()
  const senderUser = String(input.sender_username || '').trim()

  const overlayPush = () => {
    if (mode !== 'notificationsPage' || !routeContext) return false
    const query: Record<string, string> = {}
    if (pinSlug) query.pin = pinSlug
    if (commentId) query.commentId = commentId
    router.push({ path: routeContext.path, query: mergeRouteQuery(routeContext.query, query) })
    return true
  }

  if (metadataKind === 'subscription_seat_invite') {
    router.push({ path: '/settings', query: { section: 'seats' } })
    return
  }

  if (metadataKind === 'contest_rank_update' || metadataKind === 'contest_display_rank_change') {
    if (pinSlug) {
      if (mode === 'notificationsPage' && routeContext) {
        router.push({
          path: routeContext.path,
          query: mergeRouteQuery(routeContext.query, { pin: pinSlug, ...(commentId ? { commentId } : {}) }),
        })
        return
      }
      router.push({
        path: `/pin/${encodeURIComponent(pinSlug)}`,
        ...(commentId ? { query: { commentId } } : {}),
      })
      return
    }
    router.push('/contest/live')
    return
  }

  if (
    metadataKind === 'referral_contest_rank' ||
    metadataKind === 'referral_filleul_validated' ||
    metadataKind === 'referral_reward' ||
    metadataKind === 'referral_contest_new_month'
  ) {
    router.push('/referrals/contest')
    return
  }
  if (metadataKind === 'referral_contest_closed') {
    router.push('/referrals/history')
    return
  }

  if (isStoryPin && pinSlug) {
    const q: Record<string, string> = { story: pinSlug }
    if (commentId) q.commentId = commentId
    router.push({ path: '/', query: q })
    return
  }

  if (pinSlug) {
    if (overlayPush()) return
    router.push({
      path: `/pin/${encodeURIComponent(pinSlug)}`,
      ...(commentId ? { query: { commentId } } : {}),
    })
    return
  }

  if (nType === 'follow' && senderUser) {
    router.push(`/profile/${encodeURIComponent(senderUser)}`)
    return
  }

  if (input.pin_id) {
    router.push('/')
    return
  }

  if (input.action_url) {
    router.push(String(input.action_url))
  }
}
