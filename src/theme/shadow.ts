/**
 * Shadow — système d'ombres stratifiées iOS premium.
 *
 * Principes :
 *  - Multi-layer soft shadows (jamais une seule grosse ombre)
 *  - Opacités faibles (0.04 → 0.22) pour éviter l'effet "drop shadow lourd"
 *  - Pas de blur géant animé : GPU coût élevé sur Safari iOS
 *  - Couleurs subtilement teintées (rose Fotoce sur certaines couches)
 *  - Variantes light/dark pensées séparément (pas juste opacity++)
 *
 * Hiérarchie d'élévation (z-axis perçue) :
 *
 *   level 0 — flat            : aucune ombre (surfaces de fond)
 *   level 1 — ambient         : ombre douce de proximité (cards reposant)
 *   level 2 — directional     : cards interactives, élévation au hover
 *   level 3 — floating        : FAB, boutons fixed, contextual menus
 *   level 4 — modal           : sheets / dialogs (au-dessus du content)
 *   level 5 — elevated        : modales critiques, alertes système
 *
 * Réf : iOS UIKit shadow rule "rarely visible at rest, blooms on press/hover".
 */

export interface ShadowToken {
  light: string
  dark: string
}

/**
 * Ombres atomiques — multi-layer combinées pour effet premium.
 * Layer 1 = ambient (large, faible opacité) → "halo de proximité"
 * Layer 2 = directional (compact, plus opaque) → "ancrage sol"
 * Layer 3 (optionnel) = highlight inset top → "lumière captée"
 */
export const SHADOW: Record<'ambient' | 'directional' | 'floating' | 'modal' | 'elevated' | 'pressed', ShadowToken> = {
  /** Ambient (level 1) — cards reposant sur surface. */
  ambient: {
    light:
      '0 1px 2px rgba(15, 23, 42, 0.04), ' +
      '0 4px 12px rgba(15, 23, 42, 0.05)',
    dark:
      '0 1px 2px rgba(0, 0, 0, 0.28), ' +
      '0 4px 14px rgba(0, 0, 0, 0.34)',
  },

  /** Directional (level 2) — cards interactives, profondeur perceptible. */
  directional: {
    light:
      '0 2px 4px rgba(15, 23, 42, 0.05), ' +
      '0 10px 24px rgba(15, 23, 42, 0.09), ' +
      '0 0 0 1px rgba(255, 255, 255, 0.6) inset',
    dark:
      '0 2px 6px rgba(0, 0, 0, 0.36), ' +
      '0 12px 26px rgba(0, 0, 0, 0.44), ' +
      '0 0 0 1px rgba(255, 255, 255, 0.04) inset',
  },

  /** Floating (level 3) — FAB, chrome flottant, contextual menus. */
  floating: {
    light:
      '0 4px 10px rgba(15, 23, 42, 0.08), ' +
      '0 18px 42px rgba(15, 23, 42, 0.12), ' +
      '0 0 0 1px rgba(255, 255, 255, 0.5) inset',
    dark:
      '0 6px 14px rgba(0, 0, 0, 0.45), ' +
      '0 22px 48px rgba(0, 0, 0, 0.55), ' +
      '0 0 0 1px rgba(255, 255, 255, 0.06) inset',
  },

  /** Modal (level 4) — sheets / dialogs au-dessus du content. */
  modal: {
    light:
      '0 8px 16px rgba(15, 23, 42, 0.10), ' +
      '0 36px 70px rgba(15, 23, 42, 0.18), ' +
      '0 0 0 1px rgba(255, 255, 255, 0.45) inset',
    dark:
      '0 12px 24px rgba(0, 0, 0, 0.55), ' +
      '0 44px 80px rgba(0, 0, 0, 0.62), ' +
      '0 0 0 1px rgba(255, 255, 255, 0.05) inset',
  },

  /** Elevated (level 5) — modales critiques (paiement, suppression). */
  elevated: {
    light:
      '0 12px 22px rgba(15, 23, 42, 0.14), ' +
      '0 44px 90px rgba(15, 23, 42, 0.22), ' +
      '0 14px 32px rgba(224, 36, 94, 0.10), ' /* glow rose subtil */ +
      '0 0 0 1px rgba(255, 255, 255, 0.42) inset',
    dark:
      '0 16px 30px rgba(0, 0, 0, 0.60), ' +
      '0 56px 100px rgba(0, 0, 0, 0.70), ' +
      '0 14px 32px rgba(224, 36, 94, 0.16), ' /* glow rose subtil */ +
      '0 0 0 1px rgba(255, 255, 255, 0.06) inset',
  },

  /**
   * Pressed (interaction) — ombre compressée pendant scale(0.96)+.
   * On garde la directionnelle mais on retire le rayon ambient.
   */
  pressed: {
    light:
      '0 1px 2px rgba(15, 23, 42, 0.06), ' +
      '0 4px 8px rgba(15, 23, 42, 0.08)',
    dark:
      '0 1px 2px rgba(0, 0, 0, 0.35), ' +
      '0 4px 8px rgba(0, 0, 0, 0.45)',
  },
}

/**
 * Glow accent rose — utilisable seul (overlay décoratif) ou combiné via
 * `box-shadow: ${SHADOW.modal.light}, ${GLOW.roseSoft}`.
 * GPU-friendly : on évite les blur > 24px qui tanken le GPU sur iPhone.
 */
export const GLOW = {
  roseSoft:   '0 0 32px rgba(255, 95, 145, 0.18)',
  roseMedium: '0 0 48px rgba(224, 36, 94, 0.28)',
  roseStrong: '0 0 72px rgba(224, 36, 94, 0.42)',
  /** Ring focus iOS-like (input/buttons focus-visible). */
  focusRing:  '0 0 0 3px rgba(224, 36, 94, 0.32)',
} as const

/**
 * Helper — résout l'ombre courante (light ou dark) selon `document.documentElement`.
 */
export function pickShadow(token: ShadowToken): string {
  if (typeof document === 'undefined') return token.light
  return document.documentElement.classList.contains('dark') ? token.dark : token.light
}
