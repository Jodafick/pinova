import type { Router } from 'vue-router'
import api from '../api/index'
import { invalidateFotoDetailClientCache } from '../lib/cache/fotoClientCache'
import { pushToast } from '../composables/useToast'
import { consumePendingIntent } from './pendingIntentStorage'
import type { PendingIntent } from '../types/pendingIntent'

let replayInFlight: Promise<boolean> | null = null

async function fetchFotoEngagement(slug: string): Promise<{ liked: boolean; saved: boolean }> {
  const { data } = await api.get<Record<string, unknown>>(`fotos/${encodeURIComponent(slug)}/`)
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
        await api.post(`fotos/comments/${commentId}/like/`)
        return
      }
      const slug = intent.resourceId
      const state = await fetchFotoEngagement(slug)
      if (!state.liked) {
        await api.post(`fotos/${encodeURIComponent(slug)}/like/`)
        invalidateFotoDetailClientCache(slug)
      }
      return
    }
    case 'save': {
      const slug = intent.resourceId
      const state = await fetchFotoEngagement(slug)
      if (!state.saved) {
        await api.post(`fotos/${encodeURIComponent(slug)}/save/`)
        invalidateFotoDetailClientCache(slug)
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
      await api.post(`fotos/${encodeURIComponent(slug)}/comments/`, {
        text,
        gif: intent.metadata?.gif ?? null,
        parentId: intent.metadata?.parentId ?? null,
      })
      invalidateFotoDetailClientCache(slug)
      return
    }
    case 'translate': {
      const lang = intent.metadata?.lang || 'fr'
      if (intent.metadata?.target === 'comment') {
        const commentId = Number(intent.metadata?.commentId ?? intent.resourceId)
        if (!Number.isFinite(commentId)) throw new Error('invalid comment id')
        await api.post(`fotos/comments/${commentId}/translate/`, { target_lang: lang })
        return
      }
      const slug = intent.metadata?.fotoSlug || intent.resourceId
      await api.post(`fotos/${encodeURIComponent(slug)}/translate-description/`, { target_lang: lang })
      invalidateFotoDetailClientCache(slug)
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
