import type { Router } from 'vue-router'
import type { Foto } from '../types'
import { fetchCurrentUser } from '../composables/useAuth'
import { getCachedFotoDetail } from '../lib/cache/fotoClientCache'

export const PROFILE_PUBLISH_FOTO_QUERY = 'foto'

/** Après publication : profil auteur + overlay foto (?foto=) + /me à jour. */
export async function navigateToPublishedFoto(
  router: Router,
  opts: { slug: string; username?: string | null; foto?: Foto | null },
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
      query: { [PROFILE_PUBLISH_FOTO_QUERY]: slug },
    })
    return
  }

  window.location.assign(`/?foto=${encodeURIComponent(slug)}`)
}

/** Injecte le foto publié dans la grille profil si absent (KeepAlive). */
export function prependPublishedPinToProfileGrid(
  profileFotos: { value: Foto[] },
  slug: string,
  foto?: Foto | null,
): void {
  const s = slug.trim()
  if (!s || profileFotos.value.some((p) => p.slug === s)) return
  const hit = foto?.slug === s ? foto : getCachedFotoDetail(s)
  if (hit) profileFotos.value = [hit, ...profileFotos.value]
}
