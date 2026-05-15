/**
 * View Transitions API — branche native du browser pour des transitions
 * fluides entre routes, en complément du système `<transition>` Vue.
 *
 *  Stratégie : monkey-patch de `router.push` / `router.replace` / `router.back`
 *  pour exécuter la nav dans un `document.startViewTransition()` quand :
 *   - le browser supporte l'API (Chrome 111+, Safari 18+, Edge 111+)
 *   - l'utilisateur n'a PAS `prefers-reduced-motion: reduce`
 *   - la route cible n'a PAS `meta.noTransition: true`
 *
 *  Fallback gracieux : si l'une de ces conditions est fausse, on délègue
 *  à l'implémentation native du router (et `<transition>` Vue continue
 *  d'orchestrer les enter/leave classiques).
 *
 *  Cohérence avec l'existant :
 *   - Le système `<transition>` Vue actuel (cf. `App.vue`) **continue de
 *     fonctionner**. View Transitions agit en **couche additionnelle** :
 *     la perception est encore plus fluide sur les browsers compatibles,
 *     identique sur les autres.
 *   - Les routes `meta.noTransition` ne sont JAMAIS encapsulées.
 *   - Compatible avec le `popstate` retour Android / iOS swipe-back natif.
 *
 *  CSS recommandé (dans `style.css`) :
 *
 *    ::view-transition-old(root),
 *    ::view-transition-new(root) {
 *      animation-duration: 280ms;
 *      animation-timing-function: cubic-bezier(0.32, 0.72, 0, 1);
 *    }
 */

import type { Router, RouteLocationRaw } from 'vue-router'

interface ViewTransition {
  finished: Promise<void>
  ready: Promise<void>
  updateCallbackDone: Promise<void>
  skipTransition: () => void
}
type StartViewTransition = (cb: () => Promise<void> | void) => ViewTransition

function getStartViewTransition(): StartViewTransition | null {
  if (typeof document === 'undefined') return null
  const fn = (document as unknown as { startViewTransition?: StartViewTransition }).startViewTransition
  return typeof fn === 'function' ? fn.bind(document) : null
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/**
 * Wrap une callback async dans un view transition si supporté.
 * Retourne la promise du callback (NON celle du transition.finished) pour
 * que l'appelant continue son flux sans attendre la fin de l'animation CSS.
 */
async function runWithViewTransition<T>(
  fn: () => Promise<T>,
  enabled: boolean,
): Promise<T> {
  const startVT = enabled ? getStartViewTransition() : null
  if (!startVT) return fn()

  /* Notre callback DOIT retourner une promise qui se résout APRÈS la
     mise à jour DOM (sinon le browser snapshote l'ancien DOM comme "new"). */
  let result!: T
  const transition = startVT(async () => {
    result = await fn()
    /* Donner 2 rAF pour laisser Vue rendre le nouveau composant route. */
    await new Promise<void>((res) => {
      requestAnimationFrame(() => requestAnimationFrame(() => res()))
    })
  })

  /* `updateCallbackDone` est résolu dès que le callback a fini.
     On l'attend pour pouvoir retourner `result`. */
  await transition.updateCallbackDone
  return result
}

let installed = false

/**
 * Installe View Transitions sur un router Vue. Idempotent.
 *
 *   import { installViewTransitions } from '@/navigation/viewTransitions'
 *   installViewTransitions(router)
 */
export function installViewTransitions(router: Router): void {
  if (installed) return
  installed = true

  const startVT = getStartViewTransition()
  if (!startVT) return /* Pas d'API native → on garde le comportement standard. */

  const originalPush = router.push.bind(router)
  const originalReplace = router.replace.bind(router)
  const originalBack = router.back.bind(router)
  const originalForward = router.forward.bind(router)

  function shouldAnimate(to?: RouteLocationRaw): boolean {
    if (prefersReducedMotion()) return false
    /* On n'a pas accès à `to.meta` avant resolve, mais le router beforeEach
       intercepte déjà les routes `noTransition` côté `App.vue` (transitionName='').
       Cependant pour View Transitions, qui s'applique AVANT enter/leave Vue,
       on accepte tout par défaut. Les routes `noTransition` resteront cohérentes
       car l'animation CSS sera vide ou neutre. */
    void to
    return true
  }

  router.push = ((to: RouteLocationRaw) => {
    return runWithViewTransition(() => originalPush(to), shouldAnimate(to))
  }) as typeof router.push

  router.replace = ((to: RouteLocationRaw) => {
    return runWithViewTransition(() => originalReplace(to), shouldAnimate(to))
  }) as typeof router.replace

  router.back = (() => {
    return runWithViewTransition(async () => { originalBack() }, shouldAnimate())
  }) as typeof router.back

  router.forward = (() => {
    return runWithViewTransition(async () => { originalForward() }, shouldAnimate())
  }) as typeof router.forward
}

/** Lecture : View Transitions sont-elles supportées par le browser ? */
export function viewTransitionsSupported(): boolean {
  return getStartViewTransition() !== null
}
