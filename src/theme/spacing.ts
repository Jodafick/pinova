/**
 * Spacing & Radius — système d'espacement et de rayons unifié.
 *
 * Échelle 4px (multiple du système 8pt Apple).
 * Permet une rythmique visuelle cohérente sans faire de math à chaque composant.
 *
 * Réf : iOS 18 system spacing (.compactSpacing(), .regularSpacing()),
 *       Apple HIG layout spacing rules.
 */

/**
 * Espacements (margins, paddings, gaps). Tous en `px`.
 * Usage : style="padding: ${SPACING.md}px" ou via CSS var `--space-md`.
 */
export const SPACING = {
  /** 2px — micro (fines lignes, hairlines). */
  hairline: 2,
  /** 4px — extra small (gaps icône-texte). */
  xs:   4,
  /** 8px — small (paddings boutons compacts). */
  sm:   8,
  /** 12px — medium-small. */
  ms:   12,
  /** 16px — medium (paddings cards standards). */
  md:   16,
  /** 20px — medium-large (paddings cards larges). */
  ml:   20,
  /** 24px — large (sections). */
  lg:   24,
  /** 32px — extra-large (séparation de blocs). */
  xl:   32,
  /** 40px — XX-large (entre sections principales). */
  xxl:  40,
  /** 56px — page sections. */
  xxxl: 56,
  /** 72px — hero spacing. */
  hero: 72,
} as const

/**
 * Radius — coins arrondis. Tous en `px`.
 *
 * Standards Fotoce (cohérence inter-composants) :
 *  - cards               : 22 (lux feel)
 *  - sheets bottom       : 28 (haut seulement)
 *  - sheets fullscreen   : 38
 *  - pills / chips       : 9999 (full rounded)
 *  - buttons             : 16
 *  - floating elements   : 24+
 *  - skeletons / hairlines : 8
 */
export const RADIUS = {
  /** 4px — micro arrondi (focus rings). */
  xs:  4,
  /** 8px — pills compacts. */
  sm:  8,
  /** 12px — inputs / chips small. */
  ms:  12,
  /** 16px — boutons standards iOS. */
  md:  16,
  /** 22px — cards Fotoce (lux). */
  card: 22,
  /** 24px — floating elements (FAB, contextual menu, popovers). */
  floating: 24,
  /** 28px — bottom sheets (haut). */
  sheet: 28,
  /** 38px — modales fullscreen iOS. */
  fullscreen: 38,
  /** Full rounded (pills, avatars circulaires). */
  full: 9999,
} as const

/**
 * Borders — épaisseurs standard.
 */
export const BORDER = {
  /** 0.5px — hairline iOS (Retina-safe). */
  hairline: '0.5px',
  /** 1px — bordures standard. */
  default:  '1px',
  /** 2px — bordures focus / sélection. */
  strong:   '2px',
} as const

/**
 * Layout maxima — largeurs canoniques pour limiter sur grands écrans.
 */
export const LAYOUT = {
  /** Mobile breakpoint (Tailwind sm). */
  mobile:    640,
  /** Tablet breakpoint. */
  tablet:    768,
  /** Desktop breakpoint. */
  desktop:   1024,
  /** Large desktop. */
  large:     1280,
  /** Modal max-width (centre). */
  modalMax:  520,
  /** Bottom sheet max-width (s'étend full sur mobile, contraint sur desktop). */
  sheetMax:  640,
  /** Content max-width (lecture confortable). */
  readingMax: 720,
  /** Feed grid max-width. */
  feedMax:   1440,
} as const
