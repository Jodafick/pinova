import type { Router } from 'vue-router'
import api from '../api/index'
import { invalidatePinDetailClientCache } from '../lib/cache/pinClientCache'
import { pushToast } from '../composables/useToast'
import { consumePendingIntent } from './pendingIntentStorage'
import type { PendingIntent } from '../types/pendingIntent'

let replayInFlight: Promise<boolean> | null = null

async function fetchPinEngagement(slug: string): Promise<{ liked: boolean; saved: boolean }> {
  const { data } = await api.get<Record<string, unknown>>(`pins/${encodeURIComponent(slug)}/`)
  return {
    liked: !!data.liked,
    saved: !!data.saved,
  }
}

async function fetchProfileFollowing(username: string): Promise<boolean> {
  const { data } = await api.get<Record<string, unknown>>(`profiles/${encodeURIComponent(username)}/`)
  return !!data.is_following
}

async function executeIntent(intent: PendingIntent, router: Router): Promise<void> {
  switch (intent.type) {
    case 'like': {
      if (intent.metadata?.scope === 'comment') {
        const commentId = Number(intent.resourceId)
        if (!Number.isFinite(commentId)) throw new Error('invalid comment id')
        await api.post(`pins/comments/${commentId}/like/`)
        return
      }
      const slug = intent.resourceId
      const state = await fetchPinEngagement(slug)
      if (!state.liked) {
        await api.post(`pins/${encodeURIComponent(slug)}/like/`)
        invalidatePinDetailClientCache(slug)
      }
      return
    }
    case 'save': {
      const slug = intent.resourceId
      const state = await fetchPinEngagement(slug)
      if (!state.saved) {
        await api.post(`pins/${encodeURIComponent(slug)}/save/`)
        invalidatePinDetailClientCache(slug)
      }
      return
    }
    case 'follow': {
      const username = intent.resourceId
      const following = await fetchProfileFollowing(username)
      if (!following) {
        await api.post(`profiles/${encodeURIComponent(username)}/follow/`)
      }
      return
    }
    case 'comment': {
      const slug = intent.resourceId
      const text = intent.metadata?.text?.trim()
      if (!text) throw new Error('missing comment text')
      await api.post(`pins/${encodeURIComponent(slug)}/comments/`, {
        text,
        gif: intent.metadata?.gif ?? null,
        parentId: intent.metadata?.parentId ?? null,
      })
      invalidatePinDetailClientCache(slug)
      return
    }
    case 'translate': {
      const lang = intent.metadata?.lang || 'fr'
      if (intent.metadata?.target === 'comment') {
        const commentId = Number(intent.metadata?.commentId ?? intent.resourceId)
        if (!Number.isFinite(commentId)) throw new Error('invalid comment id')
        await api.post(`pins/comments/${commentId}/translate/`, { target_lang: lang })
        return
      }
      const slug = intent.metadata?.pinSlug || intent.resourceId
      await api.post(`pins/${encodeURIComponent(slug)}/translate-description/`, { target_lang: lang })
      invalidatePinDetailClientCache(slug)
      return
    }
    case 'contest': {
      await router.push({ name: 'contest-live' })
      return
    }
    default:
      return
  }
}

export async function replayPendingIntent(
  router: Router,
  t: (key: string) => string,
): Promise<boolean> {
  if (replayInFlight) return replayInFlight

  replayInFlight = (async () => {
    const intent = consumePendingIntent()
    if (!intent) return false
    try {
      await executeIntent(intent, router)
      pushToast({ message: t('pendingIntent.replaySuccess'), kind: 'success' })
      return true
    } catch (err) {
      console.warn('[pendingIntent] replay failed', err)
      pushToast({ message: t('pendingIntent.replayError'), kind: 'error', duration: 5000 })
      return false
    } finally {
      replayInFlight = null
    }
  })()

  return replayInFlight
}
