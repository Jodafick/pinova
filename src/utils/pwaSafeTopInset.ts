/**
 * Sécurise le padding haut en PWA installée lorsque `env(safe-area-inset-top)`
 * renvoie 0 (cas fréquent sur Android WebAPK alors que la barre système overlap le contenu).
 *
 * Pose `--fotoce-pwa-extra-top-inset` sur `<html>` ; consommé par `.fotoce-app-chrome-safe-pt`.
 */

const EXTRA_VAR = '--fotoce-pwa-extra-top-inset'
/** Dessous de ce seuil (px mesurés sur une sonde avec env()), on active un fallback. */
const TRUST_CSS_ENV_TOP_MIN = 14
/** Marge indicative barre de statut / encoche logicielle quand le moteur ne fournit pas d’inset. */
const FALLBACK_TOP_PX = 28

let bound = false

function isStandaloneDisplay(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return true
  try {
    if (window.matchMedia('(display-mode: standalone)').matches) return true
    if (window.matchMedia('(display-mode: fullscreen)').matches) return true
    if (window.matchMedia('(display-mode: minimal-ui)').matches) return true
  } catch {
    /* ignore */
  }
  return false
}

function readInsetFromPadding(paddingTop: string): number {
  const n = parseFloat(paddingTop)
  return Number.isFinite(n) ? n : 0
}

/** Mesure l’équivalent de safe-area-top via paddings système (fonctionne mieux que lire `--sat` brute). */
function measureCssSafeTopInset(): number {
  if (typeof document === 'undefined' || typeof document.body === 'undefined') return 0

  let top = 0
  try {
    const el = document.createElement('div')
    el.style.cssText = [
      'position:fixed',
      'visibility:hidden',
      'pointer-events:none',
      'width:0',
      'height:0',
      'left:-999px',
      'padding-top:constant(safe-area-inset-top)',
    ].join(';')
    document.body.appendChild(el)
    top = Math.max(top, readInsetFromPadding(window.getComputedStyle(el).paddingTop))
    document.body.removeChild(el)
  } catch {
    /* ignore */
  }

  try {
    const el2 = document.createElement('div')
    el2.style.cssText = [
      'position:fixed',
      'visibility:hidden',
      'pointer-events:none',
      'width:0',
      'height:0',
      'left:-999px',
      'padding-top:env(safe-area-inset-top,0px)',
    ].join(';')
    document.body.appendChild(el2)
    top = Math.max(top, readInsetFromPadding(window.getComputedStyle(el2).paddingTop))
    document.body.removeChild(el2)
  } catch {
    /* ignore */
  }

  return top
}

/** Recalcule la marge fallback sur `<html>`. À appeler au boot + après resize/orientation/display-mode. */
export function syncPwaStandaloneTopInset(): void {
  if (typeof document === 'undefined') return
  const root = document.documentElement

  if (!isStandaloneDisplay()) {
    root.style.removeProperty(EXTRA_VAR)
    return
  }

  const inset = measureCssSafeTopInset()
  if (inset >= TRUST_CSS_ENV_TOP_MIN) {
    root.style.removeProperty(EXTRA_VAR)
    return
  }

  /*
   * `env()` est jugé peu fiable ici ; on ajoute uniquement ce qui manque pour atteindre
   * ~ une hauteur de barre de statut indicative (évite doubler lorsque inset est déjà ~20px).
   */
  const bump = Math.max(0, Math.round(FALLBACK_TOP_PX - inset))
  if (bump > 0) root.style.setProperty(EXTRA_VAR, `${bump}px`)
  else root.style.removeProperty(EXTRA_VAR)
}

function bindLifecycle(): void {
  if (bound || typeof window === 'undefined') return
  bound = true

  const run = () => syncPwaStandaloneTopInset()

  window.addEventListener('resize', run, { passive: true })
  window.addEventListener('orientationchange', run, { passive: true })
  window.visualViewport?.addEventListener?.('resize', run)

  try {
    const mql = window.matchMedia('(display-mode: standalone)')
    if (typeof mql.addEventListener === 'function') {
      mql.addEventListener('change', run)
    } else {
      ;(mql as unknown as { addListener: (cb: () => void) => void }).addListener(run)
    }
  } catch {
    /* ignore */
  }
}

/**
 * Initialise le mécanisme (idempotent). Doit avoir `document.body` pour la sonde —
 * appeler après montage Vue ou faire un deuxième passage via requestAnimationFrame.
 */
export function initPwaStandaloneTopInset(): void {
  bindLifecycle()
  if (typeof document !== 'undefined' && document.readyState === 'loading') {
    document.addEventListener(
      'DOMContentLoaded',
      () => syncPwaStandaloneTopInset(),
      { once: true },
    )
  }
  syncPwaStandaloneTopInset()
  if (typeof requestAnimationFrame !== 'undefined') {
    requestAnimationFrame(() => syncPwaStandaloneTopInset())
  }
}
