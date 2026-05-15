/**
 * Observer Registry — wrapper safe-by-default pour IntersectionObserver /
 * ResizeObserver / MutationObserver.
 *
 * Pourquoi ?
 *  - Les observers sont une cause majeure de fuites mémoire si on oublie un
 *    `disconnect()` (typiquement dans des composants qui se démontent vite).
 *  - Sur Safari iOS, accumuler 100+ observers actifs ralentit le rendu et
 *    peut crasher l'onglet après plusieurs minutes.
 *
 * Ce module :
 *  - Comptabilise les observers actifs (`domBudget.observers`)
 *  - Auto-disconnect sous pression mémoire (frozen / critical)
 *  - Fournit `managedIntersectionObserver(...)` et siblings, qui rendent un
 *    disposer combinant disconnect + decrement budget
 *
 * Usage :
 *
 *   const io = managedIntersectionObserver((entries) => {...}, { rootMargin: '200px' })
 *   io.observe(el)
 *   onBeforeUnmount(io.dispose)
 */

import { trackBudget } from './domBudget'
import { registerReclaimable } from './memoryManager'

interface ManagedObserver<O> {
  /** Instance brute pour les appels avancés. */
  raw: O
  /** Disconnect + libère le slot budget. Idempotent. */
  dispose: () => void
}

/** Liste interne pour pouvoir tout couper sous pression critique. */
const liveObservers = new Set<{ disconnect: () => void }>()

let reclaimRegistered = false
function ensureReclaimer(): void {
  if (reclaimRegistered) return
  reclaimRegistered = true
  registerReclaimable({
    name: 'observer-registry',
    priority: 25,
    reclaim(pressure) {
      if (pressure !== 'critical') return
      /* En urgence absolue uniquement, on coupe tout (les composants peuvent re-créer). */
      for (const obs of liveObservers) {
        try { obs.disconnect() } catch { /* ignore */ }
      }
      liveObservers.clear()
    },
  })
}
ensureReclaimer()

function wrap<O extends { disconnect: () => void }>(raw: O): ManagedObserver<O> {
  const dispose = trackBudget('observers')
  liveObservers.add(raw)
  let disposed = false
  return {
    raw,
    dispose() {
      if (disposed) return
      disposed = true
      try { raw.disconnect() } catch { /* ignore */ }
      liveObservers.delete(raw)
      dispose()
    },
  }
}

export function managedIntersectionObserver(
  cb: IntersectionObserverCallback,
  options?: IntersectionObserverInit,
): ManagedObserver<IntersectionObserver> & {
  observe: (el: Element) => void
  unobserve: (el: Element) => void
} {
  const raw = new IntersectionObserver(cb, options)
  const m = wrap(raw)
  return {
    ...m,
    observe: (el) => raw.observe(el),
    unobserve: (el) => raw.unobserve(el),
  }
}

export function managedResizeObserver(
  cb: ResizeObserverCallback,
): ManagedObserver<ResizeObserver> & {
  observe: (el: Element, options?: ResizeObserverOptions) => void
  unobserve: (el: Element) => void
} {
  const raw = new ResizeObserver(cb)
  const m = wrap(raw)
  return {
    ...m,
    observe: (el, options) => raw.observe(el, options),
    unobserve: (el) => raw.unobserve(el),
  }
}

export function managedMutationObserver(
  cb: MutationCallback,
): ManagedObserver<MutationObserver> & {
  observe: (el: Node, init?: MutationObserverInit) => void
} {
  const raw = new MutationObserver(cb)
  const m = wrap(raw)
  return {
    ...m,
    observe: (el, init) => raw.observe(el, init ?? {}),
  }
}
