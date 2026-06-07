import type { Router } from 'vue-router'
import type { Pin } from '../types'
import { fetchCurrentUser } from '../composables/useAuth'
import { markSkipSplash } from './skipSplash'

export const PROFILE_PUBLISH_PIN_QUERY = 'pin'

/** Après publication : profil auteur + overlay pin (?pin=) + /me à jour. */
export async function navigateToPublishedPin(
  router: Router,
  opts: { slug: string; username?: string | null; pin?: Pin | null },
): Promise<void> {
  const slug = opts.slug.trim()
  if (!slug) {
    await router.push('/')
    return
  }

  await fetchCurrentUser({ force: true, silent: true })

  const username = opts.username?.trim() || opts.pin?.username?.trim()
  if (username) {
    await router.push({
      path: `/profile/${encodeURIComponent(username)}`,
      query: { [PROFILE_PUBLISH_PIN_QUERY]: slug },
    })
    return
  }

  markSkipSplash()
  window.location.assign(`/?pin=${encodeURIComponent(slug)}`)
}

/** Injecte le pin publié dans la grille profil si absent (KeepAlive). */
export function prependPublishedPinToProfileGrid(
  profilePins: { value: Pin[] },
  slug: string,
  pin?: Pin | null,
): void {
  const s = slug.trim()
  if (!s || profilePins.value.some((p) => p.slug === s)) return
  const hit = pin?.slug === s ? pin : getCachedPinDetail(s)
  if (hit) profilePins.value = [hit, ...profilePins.value]
}
