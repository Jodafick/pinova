/**
 * Détection réactive de `prefers-reduced-motion: reduce`.
 *
 * Singleton : on attache UN seul listener `matchMedia` partagé par tous les
 * composants pour éviter les MM doublons.
 *
 * Quand `prefersReducedMotion === true` :
 *  - `useSpring` se résout instantanément à la valeur cible (sans physique)
 *  - `usePressFeedback` se contente d'un changement opacité, sans scale
 *  - `useGestureEngine` désactive le rubber band et le momentum
 *  - les composants Layer suppriment leur animation d'entrée
 *
 * Cf. WCAG 2.3.3 (animation from interactions) + Apple HIG.
 */

import { onBeforeUnmount, onMounted, readonly, ref, type Ref } from 'vue'

const prefersReducedMotion: Ref<boolean> = ref(false)
let mql: MediaQueryList | null = null
let listenersBound = 0

function readNow(): boolean {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return false
  try {
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch {
    return false
  }
}

function syncFromMql() {
  if (!mql) return
  prefersReducedMotion.value = mql.matches
}

function ensureBinding() {
  if (mql || typeof window === 'undefined') return
  try {
    mql = window.matchMedia('(prefers-reduced-motion: reduce)')
    syncFromMql()
    /* Safari < 14 utilise addListener (déprécié) mais MDN garde l'API. */
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', syncFromMql)
    } else {
      /* Fallback legacy : cast pour ne pas faire échouer le typage. */
      ;(mql as unknown as { addListener: (cb: () => void) => void }).addListener(syncFromMql)
    }
  } catch {
    /* ignore */
  }
}

function teardown() {
  if (!mql) return
  try {
    if (typeof mql.removeEventListener === 'function') {
      mql.removeEventListener('change', syncFromMql)
    } else {
      ;(mql as unknown as { removeListener: (cb: () => void) => void }).removeListener(syncFromMql)
    }
  } catch {
    /* ignore */
  }
  mql = null
}

/** Init eager (par exemple depuis `main.ts`) — synchrone, sans hook. */
export function initReducedMotionWatcher(): void {
  ensureBinding()
}

export interface UseReducedMotionReturn {
  prefersReducedMotion: Readonly<Ref<boolean>>
  /** Lecture instantanée sans s'abonner. */
  isReducedMotionNow: () => boolean
}

export function useReducedMotion(): UseReducedMotionReturn {
  onMounted(() => {
    listenersBound += 1
    if (listenersBound === 1) ensureBinding()
    /* Re-sync au mount (cas SSR ou changement entre composants). */
    prefersReducedMotion.value = readNow()
  })

  onBeforeUnmount(() => {
    listenersBound = Math.max(0, listenersBound - 1)
    if (listenersBound === 0) teardown()
  })

  return {
    prefersReducedMotion: readonly(prefersReducedMotion),
    isReducedMotionNow: () => readNow(),
  }
}
