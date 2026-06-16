/**
 * Adaptive Navigator — détection plateforme / entrée / perf et « motion language ».
 *
 * Principes :
 *  - iOS = référence (edge-back, springs, blur) — inchangé par défaut sur iPhone/iPad.
 *  - Android = léger biais Material (seuils gestuels, transitions dédiées).
 *  - Desktop = productivité (fade court, edge plus étroit, moindre friction).
 *
 * Expose :
 *  - `getAdaptiveProfile()` : snapshot synchrone (SSR-safe).
 *  - `getAdaptiveGesture()` : copie des constantes `GESTURE` ajustées.
 *  - `getPageTransitionNames(direction)` : noms de classes `<transition>` router-view.
 *  - `syncAdaptiveDocumentState()` : pose `data-fotoce-*` sur `<html>` pour le CSS.
 *
 * À initialiser une fois au boot : `initAdaptiveNavigator()`.
 */

import { computed, onMounted, readonly, ref, type Ref } from 'vue'
import { GESTURE, type SpringConfig, SPRINGS } from '../theme/motion'
import { motionDeviceTier } from '../core/motionBudget'
/**
 * Note : `applyPlatformTokens` est importé en lazy depuis `../theme/platformTokens`
 * pour éviter un cycle (platformTokens lit `adaptiveProfile` exporté ci-dessous).
 */
let _applyPlatformTokens: ((mode?: MotionLanguage) => void) | null = null

export type FotocePlatform = 'ios' | 'android' | 'desktop' | 'unknown'
/** Langage motion : même stack logique, rendu différent. */
export type MotionLanguage = 'ios' | 'material' | 'desktop'
export type InputKind = 'touch' | 'mouse' | 'mixed' | 'unknown'

export interface AdaptiveProfile {
  platform: FotocePlatform
  input: InputKind
  /** `true` si `env(safe-area-inset-*)` est utilisable (iOS notch / home indicator). */
  safeAreaCapable: boolean
  /** Tier perf (partagé avec motionBudget). */
  performanceTier: 'low' | 'mid' | 'high'
  motionLanguage: MotionLanguage
  /** Largeur viewport (px) au dernier tick. */
  viewportWidth: number
  /** Pointer grossier (doigt) — typiquement mobile. */
  coarsePointer: boolean
}

const viewportWidth = ref(typeof window !== 'undefined' ? window.innerWidth : 1280)
const lastPointerType = ref<'touch' | 'mouse' | 'pen' | 'unknown'>('unknown')

function detectUaPlatform(): FotocePlatform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent || ''
  if (/iPad|iPhone|iPod/i.test(ua)) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  if (/Win32|Win64|Macintosh|Linux|X11/i.test(ua)) return 'desktop'
  return 'unknown'
}

function readCoarsePointer(): boolean {
  if (typeof window === 'undefined') return false
  try {
    return window.matchMedia('(pointer: coarse)').matches
  } catch {
    return false
  }
}

function readSafeAreaCapable(): boolean {
  if (typeof window === 'undefined' || typeof CSS === 'undefined') return false
  try {
    return CSS.supports('padding-top: env(safe-area-inset-top)')
  } catch {
    return false
  }
}

function inferInput(platform: FotocePlatform, coarse: boolean): InputKind {
  const pt = lastPointerType.value
  if (pt === 'touch' || (coarse && platform !== 'desktop')) return 'touch'
  if (pt === 'mouse' || pt === 'pen') return 'mouse'
  if (coarse) return 'touch'
  if (platform === 'desktop') return 'mouse'
  return 'mixed'
}

function inferMotionLanguage(p: {
  platform: FotocePlatform
  input: InputKind
  vw: number
  coarse: boolean
}): MotionLanguage {
  const wideDesktop = p.vw >= 1024 && !p.coarse
  if (wideDesktop || (p.platform === 'desktop' && p.input === 'mouse' && p.vw >= 900)) {
    return 'desktop'
  }
  if (p.platform === 'android') return 'material'
  /* iOS / unknown mobile : iOS-first. */
  return 'ios'
}

function buildProfile(): AdaptiveProfile {
  const platform = detectUaPlatform()
  const coarse = readCoarsePointer()
  const input = inferInput(platform, coarse)
  const motionLanguage = inferMotionLanguage({
    platform,
    input,
    vw: viewportWidth.value,
    coarse,
  })
  return {
    platform,
    input,
    safeAreaCapable: readSafeAreaCapable(),
    performanceTier: motionDeviceTier.value,
    motionLanguage,
    viewportWidth: viewportWidth.value,
    coarsePointer: coarse,
  }
}

const profileRef = ref<AdaptiveProfile>(buildProfile())

export const adaptiveProfile: Readonly<Ref<Readonly<AdaptiveProfile>>> = readonly(profileRef)

export function getAdaptiveProfile(): AdaptiveProfile {
  return profileRef.value
}

/** Copie des seuils `GESTURE` adaptée au profil courant (ne mute pas l'objet global). */
export function getAdaptiveGesture(): typeof GESTURE {
  const p = profileRef.value
  const g = { ...(GESTURE as unknown as Record<string, number>) }
  if (p.motionLanguage === 'desktop') {
    g.edgeBackWidth = Math.round(g.edgeBackWidth * 0.65)
    g.directionThreshold = Math.max(6, Math.round(g.directionThreshold * 0.9))
    g.flickVelocity = g.flickVelocity * 1.08
  } else if (p.motionLanguage === 'material') {
    g.edgeBackWidth = Math.round(g.edgeBackWidth * 1.12)
    g.swipeDismissThresholdRatio = Math.min(0.36, g.swipeDismissThresholdRatio * 1.05)
  }
  if (p.performanceTier === 'low') {
    g.flickVelocity = g.flickVelocity * 0.92
    g.velocityWindow = Math.max(40, g.velocityWindow - 12)
  }
  return g as unknown as typeof GESTURE
}

/** Springs « présentation » : desktop = snap quasi instantané sur petits déplacements. */
export function getAdaptiveSheetSpring(): SpringConfig {
  const p = profileRef.value
  if (p.motionLanguage === 'desktop') {
    return { ...SPRINGS.sheetSpring, stiffness: 380, damping: 30, mass: 0.85 }
  }
  if (p.motionLanguage === 'material') {
    return { ...SPRINGS.sheetSpring, damping: 28, stiffness: 260, mass: 1.05 }
  }
  return SPRINGS.sheetSpring
}

export type PageNavDirection = 'forward' | 'back'

/**
 * Noms de transition pour `<router-view>` (cf. `style.css`).
 * - iOS mobile : slide horizontal historique.
 * - Material (Android tactile) : léger scale + fade.
 * - Desktop : fade rapide sans translation large.
 */
export function getPageTransitionNames(direction: PageNavDirection): { enter: string; leave: string } {
  const ml = profileRef.value.motionLanguage
  if (ml === 'desktop') {
    return direction === 'forward'
      ? { enter: 'desktop-fade-forward', leave: 'desktop-fade-forward' }
      : { enter: 'desktop-fade-back', leave: 'desktop-fade-back' }
  }
  if (ml === 'material') {
    return direction === 'forward'
      ? { enter: 'material-forward', leave: 'material-forward' }
      : { enter: 'material-back', leave: 'material-back' }
  }
  return direction === 'forward'
    ? { enter: 'page-forward', leave: 'page-forward' }
    : { enter: 'page-back', leave: 'page-back' }
}

/** Met à jour `data-fotoce-*` sur `<html>` pour le CSS (densité, ripple Android, etc.). */
export function syncAdaptiveDocumentState(): void {
  if (typeof document === 'undefined') return
  const p = profileRef.value
  const root = document.documentElement
  root.dataset.fotocePlatform = p.platform
  root.dataset.fotoceInput = p.input
  root.dataset.fotoceMotion = p.motionLanguage
  root.dataset.fotocePerfTier = p.performanceTier
  root.dataset.fotoceDensity =
    p.motionLanguage === 'desktop' ? 'compact'
    : p.motionLanguage === 'material' ? 'balanced'
    : 'cozy'
  root.toggleAttribute('data-fotoce-safe-area', p.safeAreaCapable)
  /* Lazy : applique les CSS vars du Design System adaptatif. */
  if (_applyPlatformTokens) _applyPlatformTokens()
}

let bound = false
let mqlCoarse: MediaQueryList | null = null
let mqlResize: MediaQueryList | null = null

function refreshProfile() {
  if (typeof window !== 'undefined') viewportWidth.value = window.innerWidth
  profileRef.value = buildProfile()
  syncAdaptiveDocumentState()
}

function onPointerDownCapture(e: PointerEvent) {
  lastPointerType.value = (e.pointerType as 'touch' | 'mouse' | 'pen') || 'unknown'
}

export function initAdaptiveNavigator(): void {
  if (bound || typeof window === 'undefined') return
  bound = true
  /* Branche les tokens cross-platform — import dynamique pour éviter un cycle. */
  void import('../theme/platformTokens').then((m) => {
    _applyPlatformTokens = m.applyPlatformTokens
    _applyPlatformTokens()
  })
  refreshProfile()
  window.addEventListener('pointerdown', onPointerDownCapture, { capture: true, passive: true })
  window.addEventListener('resize', refreshProfile, { passive: true })
  try {
    mqlCoarse = window.matchMedia('(pointer: coarse)')
    const onCoarse = () => refreshProfile()
    mqlCoarse.addEventListener?.('change', onCoarse)
    mqlResize = window.matchMedia(`(max-width: ${1023}px)`)
    mqlResize.addEventListener?.('change', onCoarse)
  } catch {
    /* ignore */
  }
}

/** Composable Vue : re-sync le profil au mount (fenêtre redimensionnée / hot reload). */
export function useAdaptiveNavigator() {
  onMounted(() => {
    refreshProfile()
  })
  return {
    profile: adaptiveProfile,
    gesture: computed(() => getAdaptiveGesture()),
    refresh: refreshProfile,
  }
}
