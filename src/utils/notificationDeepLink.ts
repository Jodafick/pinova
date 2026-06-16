import type { Router } from 'vue-router'
import { pushFotoDetailOverlay } from './fotoOverlayNavigation'

/**
 * Données minimales pour router comme une notification API / un clic push (service worker).
 */
export type WebNotificationNavInput = {
  metadata?: Record<string, unknown> | null
  foto_slug?: string | null
  foto_id?: number | null
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

/**
 * Navigation unique pour liste déroulante header, page /notifications, et push web.
 * Aligné sur `Fotoce-Mobile` `navigateFromNotificationNavInput` (types metadata, contest, parrainage).
 */
export function navigateWebNotificationDeepLink(
  router: Router,
  input: WebNotificationNavInput,
  mode: WebNotificationNavMode,
  routeContext?: { path: string; query: Record<string, string | string[]> },
): void {
  const meta = input.metadata && typeof input.metadata === 'object' ? input.metadata : {}
  const metadataKind = String(meta.kind || '').trim().toLowerCase()
  const fotoSlug = (input.foto_slug || '').trim()
  const commentId = parseCommentQueryId(input.comment_id)
  const isStoryPin = Boolean(meta.is_story && fotoSlug)
  const nType = String(input.notification_type || '').trim().toLowerCase()
  const senderUser = String(input.sender_username || '').trim()

  const overlayPush = () => {
    if (!fotoSlug) return false
    pushFotoDetailOverlay(router, fotoSlug, {
      commentId,
      routeContext: mode === 'notificationsPage' ? routeContext : undefined,
      preferNotificationsFallback: mode === 'header',
    })
    return true
  }

  if (metadataKind === 'subscription_seat_invite') {
    router.push({ name: 'settings-section', params: { sectionId: 'settings-seats' } })
    return
  }

  if (metadataKind === 'contest_rank_update' || metadataKind === 'contest_display_rank_change') {
    if (fotoSlug) {
      if (overlayPush()) return
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

  if (isStoryPin && fotoSlug) {
    const q: Record<string, string> = { story: fotoSlug }
    if (commentId) q.commentId = commentId
    router.push({ path: '/', query: q })
    return
  }

  if (fotoSlug) {
    if (overlayPush()) return
  }

  if (nType === 'follow' && senderUser) {
    router.push(`/profile/${encodeURIComponent(senderUser)}`)
    return
  }

  if (input.foto_id) {
    router.push('/')
    return
  }

  if (input.action_url) {
    router.push(String(input.action_url))
  }
}
