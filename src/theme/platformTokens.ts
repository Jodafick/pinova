/**
 * Platform Tokens — Design System adaptatif (iOS / Android / Desktop).
 *
 * Principes :
 *  - Une seule base (`src/theme/*`) — `SPACING`, `TYPOGRAPHY`, `SHADOW`, `MOTION`…
 *  - Trois "modes" qui composent dessus :
 *      - `ios`      : glass + blur + spring heavy + airy padding
 *      - `material` : elevation harde + ripple + radius rectangulaires
 *      - `desktop`  : densité compacte + hover + transitions rapides
 *  - L'API JS expose les tokens typés (`iosTokens`, `androidTokens`,
 *    `desktopTokens`) pour styles dynamiques (springs, inline transform, etc.).
 *  - Le rendu visuel est piloté côté CSS via les sélecteurs
 *    `html[data-pinova-motion="ios|material|desktop"]` qui réécrivent les
 *    variables `--pinova-*` (cf. `style.css`). Donc même API composant,
 *    rendu différent par OS — *consistance UX, rendu adaptatif*.
 *
 *  Synchronisation :
 *  - `adaptiveNavigator.syncAdaptiveDocumentState()` pose `data-pinova-motion`.
 *  - `applyPlatformTokens()` (optionnel) écrit aussi les vars inline sur
 *    `<html>` pour les cas SSR / iframe / test où on veut forcer un mode.
 */

import { computed, type ComputedRef } from 'vue'
import { adaptiveProfile, type MotionLanguage } from '../navigation/adaptiveNavigator'
import { SPRINGS, type SpringConfig } from './motion'

/* ───────────────────────── Types ───────────────────────── */

export type PlatformMode = MotionLanguage

export interface PlatformSpacing {
  /** Scale factor appliqué à `SPACING.*` (1 = base iOS). */
  scale: number
  /** Padding interne d'un bouton standard. */
  buttonPadding: string
  /** Padding interne d'une carte. */
  cardPadding: string
  /** Padding d'une sheet bottom. */
  sheetPadding: string
  /** Gap vertical (stack). */
  gapStack: string
  /** Gap horizontal (toolbar / icônes-texte). */
  gapInline: string
  /** Densité globale (lue par les composants pour conditionner mode compact). */
  density: 'cozy' | 'balanced' | 'compact' | 'comfortable'
}

export interface PlatformTypography {
  /** Multiplicateur de taille (iOS = 1, Android légèrement +, Desktop -). */
  scale: number
  /** Letter-spacing additionnel (em). */
  letterSpacingDelta: string
  /** Multiplicateur de line-height. */
  lineHeightScale: number
  /** Weight delta sur le body (Material aime un peu plus de poids). */
  weightDelta: number
  /** Font-family preferred (les stacks viennent de `typography.ts`). */
  fontStack: 'system' | 'system-roboto' | 'system-segoe'
}

export interface PlatformRadius {
  /** Bouton. */
  button: string
  /** Carte standard. */
  card: string
  /** Sheet bottom (haut seulement, en pratique). */
  sheet: string
  /** Modale fullscreen. */
  fullscreen: string
  /** Floating elements (FAB, popovers). */
  floating: string
}

export interface PlatformShadows {
  /** Élévation ambient (cards au repos). */
  ambient: string
  /** Élévation directionnelle (hover / cards interactives). */
  directional: string
  /** Floating (FAB, popovers). */
  floating: string
  /** Modal (sheet / dialog). */
  modal: string
  /** Modale critique. */
  elevated: string
  /** Pressed feedback. */
  pressed: string
  /** Hover glow (desktop only, no-op ailleurs). */
  hoverGlow: string
}

export interface PlatformMotion {
  /** Durée fast (ms). */
  durFastMs: number
  /** Durée medium (ms). */
  durMediumMs: number
  /** Durée slow (ms). */
  durSlowMs: number
  /** Easing par défaut. */
  easing: string
  /** Scale de press (1 = pas de scale, 0.92 = iOS press). */
  pressScale: number
  /** Spring "présentation" recommandé. */
  spring: SpringConfig
  /** Spring "press feedback" recommandé. */
  pressSpring: SpringConfig
}

export interface PlatformInteraction {
  /** Pattern d'interaction principal. */
  primary: 'gesture' | 'ripple' | 'pointer'
  /** Hover utile (cursor: mouse vraisemblable). */
  hoverEnabled: boolean
  /** Doit afficher un focus ring visible pour le clavier. */
  focusRing: 'soft' | 'visible' | 'strong'
  /** Couleur ripple (Material). */
  rippleColor: { light: string; dark: string }
  /** Coefficient de brightness press (filter). */
  pressBrightness: number
  /** Affordance de back système (Android). */
  systemBack: boolean
}

export interface PlatformGlass {
  /** Le blur en arrière-plan est rentable visuellement / perf-wise. */
  enabled: boolean
  /** Strength du blur — Android = 'none' pour passer en elevation. */
  blur: 'none' | 'light' | 'default' | 'strong'
  /** Variant de fill par défaut. */
  fillStrength: 'subtle' | 'default' | 'strong'
}

export interface PlatformTokens {
  mode: PlatformMode
  spacing: PlatformSpacing
  typography: PlatformTypography
  radius: PlatformRadius
  shadows: PlatformShadows
  motion: PlatformMotion
  interaction: PlatformInteraction
  glass: PlatformGlass
}

/* ───────────────────────── Tokens — iOS (base) ───────────────────────── */

/**
 * iOS = référence. Toutes les autres plateformes se calculent en delta
 * par rapport à ce set (pour éviter qu'un changement ne casse iOS).
 */
export const iosTokens: PlatformTokens = {
  mode: 'ios',
  spacing: {
    scale: 1,
    buttonPadding: '12px 20px',
    cardPadding: '16px',
    sheetPadding: '20px 16px',
    gapStack: '16px',
    gapInline: '8px',
    density: 'cozy',
  },
  typography: {
    scale: 1,
    letterSpacingDelta: '0em',
    lineHeightScale: 1,
    weightDelta: 0,
    fontStack: 'system',
  },
  radius: {
    button: '16px',
    card: '22px',
    sheet: '28px',
    fullscreen: '38px',
    floating: '24px',
  },
  shadows: {
    ambient:
      '0 1px 2px rgba(15, 23, 42, 0.04), 0 4px 12px rgba(15, 23, 42, 0.05)',
    directional:
      '0 2px 4px rgba(15, 23, 42, 0.05), 0 10px 24px rgba(15, 23, 42, 0.09), 0 0 0 1px rgba(255, 255, 255, 0.6) inset',
    floating:
      '0 4px 10px rgba(15, 23, 42, 0.08), 0 18px 42px rgba(15, 23, 42, 0.12), 0 0 0 1px rgba(255, 255, 255, 0.5) inset',
    modal:
      '0 8px 16px rgba(15, 23, 42, 0.10), 0 36px 70px rgba(15, 23, 42, 0.18), 0 0 0 1px rgba(255, 255, 255, 0.45) inset',
    elevated:
      '0 12px 22px rgba(15, 23, 42, 0.14), 0 44px 90px rgba(15, 23, 42, 0.22), 0 14px 32px rgba(224, 36, 94, 0.10), 0 0 0 1px rgba(255, 255, 255, 0.42) inset',
    pressed:
      '0 1px 2px rgba(15, 23, 42, 0.06), 0 4px 8px rgba(15, 23, 42, 0.08)',
    hoverGlow: 'none',
  },
  motion: {
    durFastMs: 180,
    durMediumMs: 260,
    durSlowMs: 380,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    pressScale: 0.92,
    spring: SPRINGS.spring,
    pressSpring: SPRINGS.pressSpring,
  },
  interaction: {
    primary: 'gesture',
    hoverEnabled: false,
    focusRing: 'soft',
    rippleColor: { light: 'rgba(0, 0, 0, 0.04)', dark: 'rgba(255, 255, 255, 0.04)' },
    pressBrightness: 0.97,
    systemBack: false,
  },
  glass: {
    enabled: true,
    blur: 'default',
    fillStrength: 'default',
  },
}

/* ───────────────────────── Tokens — Android (Material) ─────────────────── */

/**
 * Android = elevation harde + ripple. On garde l'identité Pinova mais on bouge
 * vers un feel Material : padding équilibrés, radius plus rectangulaires,
 * shadows directives plus contact, ripple sur press.
 */
export const androidTokens: PlatformTokens = {
  mode: 'material',
  spacing: {
    scale: 0.95,
    buttonPadding: '10px 18px',
    cardPadding: '14px',
    sheetPadding: '18px 16px',
    gapStack: '14px',
    gapInline: '8px',
    density: 'balanced',
  },
  typography: {
    scale: 1.04,
    letterSpacingDelta: '0.005em',
    lineHeightScale: 1.02,
    weightDelta: 0,
    fontStack: 'system-roboto',
  },
  radius: {
    button: '12px',
    card: '16px',
    sheet: '20px',
    fullscreen: '24px',
    floating: '20px',
  },
  shadows: {
    ambient:
      '0 1px 1px rgba(0, 0, 0, 0.14), 0 1px 2px rgba(0, 0, 0, 0.10)',
    directional:
      '0 2px 4px rgba(0, 0, 0, 0.16), 0 4px 8px -2px rgba(0, 0, 0, 0.10)',
    floating:
      '0 3px 6px rgba(0, 0, 0, 0.20), 0 8px 16px -4px rgba(0, 0, 0, 0.14)',
    modal:
      '0 8px 12px -4px rgba(0, 0, 0, 0.18), 0 28px 56px -8px rgba(0, 0, 0, 0.32)',
    elevated:
      '0 12px 18px -6px rgba(0, 0, 0, 0.22), 0 40px 80px -12px rgba(0, 0, 0, 0.42)',
    pressed:
      '0 1px 1px rgba(0, 0, 0, 0.18), 0 2px 4px rgba(0, 0, 0, 0.12)',
    hoverGlow: 'none',
  },
  motion: {
    durFastMs: 160,
    durMediumMs: 240,
    durSlowMs: 320,
    easing: 'cubic-bezier(0.4, 0, 0.2, 1)' /* Material standard easing */,
    pressScale: 0.96,
    spring: { ...SPRINGS.spring, damping: 22, stiffness: 280, mass: 0.95 },
    pressSpring: { ...SPRINGS.pressSpring, damping: 18, stiffness: 360, mass: 0.7 },
  },
  interaction: {
    primary: 'ripple',
    hoverEnabled: false,
    focusRing: 'visible',
    rippleColor: { light: 'rgba(0, 0, 0, 0.10)', dark: 'rgba(255, 255, 255, 0.10)' },
    pressBrightness: 1,
    systemBack: true,
  },
  glass: {
    enabled: false,
    blur: 'none',
    fillStrength: 'strong',
  },
}

/* ───────────────────────── Tokens — Desktop ───────────────────────── */

/**
 * Desktop = densité productive. Padding compacts, radius légèrement plus
 * tranchés, transitions rapides, hover affordant, focus ring strong, pas
 * de press scale visible (souris = pas d'inertie tactile).
 */
export const desktopTokens: PlatformTokens = {
  mode: 'desktop',
  spacing: {
    scale: 0.85,
    buttonPadding: '8px 16px',
    cardPadding: '14px',
    sheetPadding: '16px',
    gapStack: '12px',
    gapInline: '6px',
    density: 'compact',
  },
  typography: {
    scale: 0.95,
    letterSpacingDelta: '-0.003em',
    lineHeightScale: 1.05,
    weightDelta: 0,
    fontStack: 'system-segoe',
  },
  radius: {
    button: '10px',
    card: '14px',
    sheet: '18px',
    fullscreen: '20px',
    floating: '14px',
  },
  shadows: {
    ambient:
      '0 1px 0 rgba(15, 23, 42, 0.04), 0 1px 3px rgba(15, 23, 42, 0.06)',
    directional:
      '0 1px 2px rgba(15, 23, 42, 0.05), 0 6px 14px -4px rgba(15, 23, 42, 0.10)',
    floating:
      '0 6px 14px -4px rgba(15, 23, 42, 0.12), 0 14px 28px -10px rgba(15, 23, 42, 0.18)',
    modal:
      '0 12px 22px -6px rgba(15, 23, 42, 0.18), 0 32px 60px -16px rgba(15, 23, 42, 0.28)',
    elevated:
      '0 16px 28px -8px rgba(15, 23, 42, 0.22), 0 44px 80px -20px rgba(15, 23, 42, 0.36), 0 10px 28px rgba(224, 36, 94, 0.08)',
    pressed:
      '0 1px 1px rgba(15, 23, 42, 0.08)',
    /** Hover glow desktop : ring rose subtil + lift. */
    hoverGlow:
      '0 0 0 1px rgba(224, 36, 94, 0.18), 0 8px 22px -8px rgba(224, 36, 94, 0.22)',
  },
  motion: {
    durFastMs: 120,
    durMediumMs: 180,
    durSlowMs: 240,
    easing: 'cubic-bezier(0.22, 1, 0.36, 1)',
    pressScale: 0.98,
    spring: { ...SPRINGS.spring, damping: 26, stiffness: 420, mass: 0.7 },
    pressSpring: { ...SPRINGS.pressSpring, damping: 22, stiffness: 520, mass: 0.5 },
  },
  interaction: {
    primary: 'pointer',
    hoverEnabled: true,
    focusRing: 'strong',
    rippleColor: { light: 'rgba(0, 0, 0, 0.03)', dark: 'rgba(255, 255, 255, 0.03)' },
    pressBrightness: 0.99,
    systemBack: false,
  },
  glass: {
    enabled: true,
    blur: 'light',
    fillStrength: 'strong',
  },
}

/* ───────────────────────── Sélecteurs ───────────────────────── */

/** Map mode → tokens (utile pour les tests / SSR forcé). */
export const PLATFORM_TOKENS: Record<PlatformMode, PlatformTokens> = {
  ios: iosTokens,
  material: androidTokens,
  desktop: desktopTokens,
}

/** Retourne le set actif (synchrone) en fonction du profil adaptatif courant. */
export function getPlatformTokens(mode?: PlatformMode): PlatformTokens {
  const active = mode ?? adaptiveProfile.value.motionLanguage
  return PLATFORM_TOKENS[active] ?? iosTokens
}

/**
 * Composable Vue : retourne un computed des tokens actifs.
 * Se met à jour automatiquement quand l'`adaptiveProfile` change.
 *
 *   const { tokens, mode, isMaterial, isDesktop, isIOS } = usePlatformTokens()
 *   const padding = computed(() => tokens.value.spacing.buttonPadding)
 */
export function usePlatformTokens(): {
  tokens: ComputedRef<PlatformTokens>
  mode: ComputedRef<PlatformMode>
  isIOS: ComputedRef<boolean>
  isMaterial: ComputedRef<boolean>
  isDesktop: ComputedRef<boolean>
} {
  const mode = computed<PlatformMode>(() => adaptiveProfile.value.motionLanguage)
  const tokens = computed<PlatformTokens>(() => PLATFORM_TOKENS[mode.value] ?? iosTokens)
  return {
    tokens,
    mode,
    isIOS: computed(() => mode.value === 'ios'),
    isMaterial: computed(() => mode.value === 'material'),
    isDesktop: computed(() => mode.value === 'desktop'),
  }
}

/* ───────────────────────── Injection CSS variables ───────────────────────── */

/**
 * Construit un block de CSS vars à appliquer sur `<html>` ou n'importe quel root.
 * Utilisé en complément des sélecteurs `html[data-pinova-motion=...]` quand on
 * veut FORCER un mode (preview / sandbox / tests).
 */
export function platformTokensCssVars(tokens: PlatformTokens): Record<string, string> {
  return {
    '--pinova-platform-mode': tokens.mode,
    '--pinova-density': tokens.spacing.density,
    '--pinova-space-scale': String(tokens.spacing.scale),
    '--pinova-btn-padding': tokens.spacing.buttonPadding,
    '--pinova-card-padding': tokens.spacing.cardPadding,
    '--pinova-sheet-padding': tokens.spacing.sheetPadding,
    '--pinova-gap-stack': tokens.spacing.gapStack,
    '--pinova-gap-inline': tokens.spacing.gapInline,
    '--pinova-type-scale': String(tokens.typography.scale),
    '--pinova-type-line-scale': String(tokens.typography.lineHeightScale),
    '--pinova-type-tracking-delta': tokens.typography.letterSpacingDelta,
    '--pinova-radius-button': tokens.radius.button,
    '--pinova-radius-card': tokens.radius.card,
    '--pinova-radius-sheet': tokens.radius.sheet,
    '--pinova-radius-fullscreen': tokens.radius.fullscreen,
    '--pinova-radius-floating': tokens.radius.floating,
    '--pinova-shadow-ambient': tokens.shadows.ambient,
    '--pinova-shadow-directional': tokens.shadows.directional,
    '--pinova-shadow-floating': tokens.shadows.floating,
    '--pinova-shadow-modal': tokens.shadows.modal,
    '--pinova-shadow-elevated': tokens.shadows.elevated,
    '--pinova-shadow-pressed': tokens.shadows.pressed,
    '--pinova-shadow-hover-glow': tokens.shadows.hoverGlow,
    '--pinova-dur-fast': `${tokens.motion.durFastMs}ms`,
    '--pinova-dur-medium': `${tokens.motion.durMediumMs}ms`,
    '--pinova-dur-slow': `${tokens.motion.durSlowMs}ms`,
    '--pinova-easing': tokens.motion.easing,
    '--pinova-press-scale': String(tokens.motion.pressScale),
    '--pinova-press-brightness': String(tokens.interaction.pressBrightness),
  }
}

let lastAppliedMode: PlatformMode | null = null

/**
 * Applique les CSS vars sur `<html>`. Idempotent (skip si le mode n'a pas changé).
 * Le rendu visuel n'a pas BESOIN de cet appel : le CSS contient déjà des
 * sélecteurs `html[data-pinova-motion="..."]` qui font la commutation. Cette
 * fonction sert pour les cas où on veut surcharger un mode différent du
 * profil adaptatif (sandbox, preview), ou pour exposer les vars TS aux
 * composants qui les lisent en `getComputedStyle()`.
 */
export function applyPlatformTokens(mode?: PlatformMode): void {
  if (typeof document === 'undefined') return
  const active = mode ?? adaptiveProfile.value.motionLanguage
  if (active === lastAppliedMode && !mode) return
  lastAppliedMode = active
  const root = document.documentElement
  const vars = platformTokensCssVars(PLATFORM_TOKENS[active] ?? iosTokens)
  for (const [k, v] of Object.entries(vars)) {
    root.style.setProperty(k, v)
  }
}
