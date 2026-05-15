import { getAppScrollRoot } from './appScrollRoot'

/**
 * Verrouillage du scroll `body` partagé par toutes les instances de `PinovaModal`.
 * Compteur : plusieurs modales ouvertes → un seul retire la classe quand la dernière se ferme.
 * Évite les pages figées si une instance est démontée avant la fin d’animation ou si deux modales se chevauchent.
 */
let lockCount = 0
let savedScrollY = 0

export function acquirePinovaBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  if (lockCount === 0) {
    savedScrollY = getAppScrollRoot().scrollTop
    document.body.classList.add('pinova-modal-scroll-lock')
  }
  lockCount += 1
}

export function releasePinovaBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  lockCount = Math.max(0, lockCount - 1)
  if (lockCount === 0) {
    document.body.classList.remove('pinova-modal-scroll-lock')
    const root = getAppScrollRoot()
    try {
      root.scrollTo({ top: savedScrollY, behavior: 'instant' as ScrollBehavior })
    } catch {
      root.scrollTop = savedScrollY
    }
  }
}

/** Réinitialise le verrou (ex. HMR, état incohérent) pour éviter un body figé. */
export function resetPinovaBodyScrollLock(): void {
  if (typeof document === 'undefined') return
  lockCount = 0
  document.body.classList.remove('pinova-modal-scroll-lock')
}
