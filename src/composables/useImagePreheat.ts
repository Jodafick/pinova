/**
 * useImagePreheat — composable de préchauffage d'images (legacy-friendly).
 *
 * NOTE : depuis le Unified Media System (Prompt 13), la logique de cache
 * LRU + decode async vit dans `@/media` (`mediaEngine` + `imageCache`). Ce
 * composable est conservé comme thin wrapper pour ne PAS casser les
 * usages existants (PinGrid, PinVirtualGrid, etc.) — il délègue maintenant
 * tout au moteur global et garde la sémantique « unmount → cancel local ».
 *
 * Différences clés vs avant :
 *  - Le cache LRU est GLOBAL (vie de l'app), pas par composant.
 *  - La concurrence est pilotée par `mediaPlatformProfile`.
 *  - `cancel()` annule SEULEMENT les requêtes lancées par cette instance
 *    (les autres consommateurs continuent à décharger leur file).
 */

import { onBeforeUnmount } from 'vue'
import { isImageCached, preloadImage, releaseImage } from '../media'

export interface UseImagePreheatOptions {
  /** @deprecated — la taille du cache est désormais globale (cf. mediaPlatformProfile). */
  maxCache?: number
  /** @deprecated — la concurrence est désormais pilotée par mediaPlatformProfile. */
  concurrency?: number
  /** Désactiver dynamiquement (ex: saveData applicatif). */
  disabled?: () => boolean
  /** Forcer un release des images préchargées au démontage du composant. */
  releaseOnUnmount?: boolean
}

export function useImagePreheat(options: UseImagePreheatOptions = {}) {
  /* On garde le SET des urls demandées par CE composable (instance-scoped),
     uniquement pour pouvoir libérer côté global au démontage si demandé. */
  const requested = new Set<string>()

  function isOff(): boolean {
    return !!options.disabled?.()
  }

  function preheat(src: string | undefined | null): void {
    if (!src) return
    if (isOff()) return
    requested.add(src)
    /* Le moteur global déduplique et borne la concurrence selon la
       plateforme — pas la peine de refaire la logique ici. */
    preloadImage(src, { priority: 'low' })
  }

  function preheatMany(srcs: ReadonlyArray<string | null | undefined>): void {
    for (const s of srcs) if (s) preheat(s)
  }

  /** Annule (no-op côté moteur global) — on vide juste notre set local. */
  function cancel(): void {
    requested.clear()
  }

  /** Libère explicitement les entrées propres à ce composable. */
  function clear(): void {
    for (const src of requested) releaseImage(src)
    requested.clear()
  }

  onBeforeUnmount(() => {
    if (options.releaseOnUnmount) clear()
    else cancel()
  })

  return {
    preheat,
    preheatMany,
    cancel,
    clear,
    /** Taille locale (URLs demandées par ce composant). */
    size: () => requested.size,
    /** Aide : retourne `true` si l'image est dans le cache global décodée. */
    isReady: (src: string) => isImageCached(src),
  }
}
