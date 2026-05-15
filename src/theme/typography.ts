/**
 * Typography — hiérarchie typographique premium iOS-first.
 *
 * Inspirée de :
 *  - Apple HIG (Dynamic Type scale)
 *  - Apple Music iOS 18 (titres généreux, body dense)
 *  - Pinterest mobile (caption metadata lisible)
 *
 * Principes :
 *  - Échelle modulaire (1.125 ratio mobile, 1.2 desktop)
 *  - Line-height calibré pour densité (1.25–1.5 selon usage)
 *  - Letter-spacing ajusté pour les grandes tailles (tight) et petites (loose)
 *  - Font weights stricts : 400 (body) / 500 (caption) / 600 (titles) / 700 (display)
 *  - System font stack iOS-first : -apple-system → BlinkMacSystemFont → SF Pro fallback
 *
 * Réf OLED contrast :
 *  - Body 16px min, jamais < 14px (lisibilité Retina + tablette à 50cm)
 *  - Caption 12-13px max → en-dessous c'est de la metadata seulement
 *  - Display tracking serré (-0.01em à -0.02em) pour effet Apple-like
 */

export interface TypographyToken {
  /** font-size en `rem` (1rem = 16px). */
  size: string
  /** line-height (number = unitless, multiplie size). */
  lineHeight: number
  /** letter-spacing en `em`. */
  letterSpacing: string
  /** font-weight numérique. */
  weight: number
  /** Optionnel : font-family si différente du stack par défaut. */
  fontFamily?: string
}

/**
 * Stacks de fonts.
 *
 * `sans` — système, optimisé iOS Safari (utilise SF Pro nativement).
 * `display` — variante condensée pour titres (mêmes glyphs SF).
 * `mono` — code / metadata technique.
 * `script` — auth pages (préservé legacy).
 */
export const FONT_FAMILY = {
  sans:
    `-apple-system, BlinkMacSystemFont, "SF Pro Display", "SF Pro Text", ` +
    `"Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
  display:
    `-apple-system, BlinkMacSystemFont, "SF Pro Display", "Segoe UI", ` +
    `Roboto, "Helvetica Neue", Arial, sans-serif`,
  mono:
    `ui-monospace, SFMono-Regular, Menlo, Consolas, "Courier New", monospace`,
  script:
    `"Apple Chancery", "Brush Script MT", "Lucida Handwriting", ` +
    `"Segoe Script", cursive, ui-serif, Georgia, serif`,
} as const

/**
 * Hiérarchie typographique.
 *
 * Display 3xl → grand-titre (page de profil hero, splash)
 * Display 2xl → titre de section "généreux" (Apple Music style)
 * Display xl  → titre standard (modal headers, sections)
 *
 * Title  lg → carte feature
 * Title  md → carte standard
 * Title  sm → label compact (chips, badges)
 *
 * Body   lg → body large (lecture longue, captions story)
 * Body   md → body défaut (16px — lisibilité iOS Safari sans zoom)
 * Body   sm → body compact (chips, secondary metadata)
 *
 * Caption  → metadata fine (date, attribution)
 * Metadata → micro-texte (compteurs, statuts)
 */
export const TYPOGRAPHY: Record<string, TypographyToken> = {
  /* Display — titres généreux Apple-like. */
  'display-3xl': { size: '2.5rem',  lineHeight: 1.15, letterSpacing: '-0.02em', weight: 700, fontFamily: FONT_FAMILY.display },
  'display-2xl': { size: '2rem',    lineHeight: 1.18, letterSpacing: '-0.02em', weight: 700, fontFamily: FONT_FAMILY.display },
  'display-xl':  { size: '1.625rem', lineHeight: 1.22, letterSpacing: '-0.015em', weight: 700, fontFamily: FONT_FAMILY.display },

  /* Title — titres de cartes / sections. */
  'title-lg':    { size: '1.25rem', lineHeight: 1.3,  letterSpacing: '-0.01em', weight: 600 },
  'title-md':    { size: '1.0625rem', lineHeight: 1.35, letterSpacing: '-0.005em', weight: 600 },
  'title-sm':    { size: '0.9375rem', lineHeight: 1.35, letterSpacing: '0', weight: 600 },

  /* Body — corps de texte. */
  'body-lg':     { size: '1.0625rem', lineHeight: 1.5, letterSpacing: '0', weight: 400 },
  'body-md':     { size: '1rem',    lineHeight: 1.5, letterSpacing: '0', weight: 400 },
  'body-sm':     { size: '0.875rem', lineHeight: 1.45, letterSpacing: '0', weight: 400 },

  /* Caption / metadata. */
  'caption':     { size: '0.8125rem', lineHeight: 1.4, letterSpacing: '0.01em', weight: 500 },
  'metadata':    { size: '0.75rem', lineHeight: 1.3, letterSpacing: '0.02em', weight: 500 },

  /* Spéciaux. */
  'label':       { size: '0.8125rem', lineHeight: 1.2, letterSpacing: '0.02em', weight: 600 },
  'overline':    { size: '0.6875rem', lineHeight: 1.2, letterSpacing: '0.08em', weight: 600 },
  'button':      { size: '1rem',    lineHeight: 1.2, letterSpacing: '-0.005em', weight: 600 },
  'button-sm':   { size: '0.875rem', lineHeight: 1.2, letterSpacing: '0', weight: 600 },
} as const

export type TypographyKey = keyof typeof TYPOGRAPHY

/**
 * Helper — convertit un token typographique en style CSS prêt-à-l'emploi.
 *
 *   const style = typographyStyle('display-2xl')
 *   <h1 :style="style">Bienvenue</h1>
 */
export function typographyStyle(key: TypographyKey): Record<string, string> {
  const t = TYPOGRAPHY[key]
  return {
    fontFamily: t.fontFamily ?? FONT_FAMILY.sans,
    fontSize: t.size,
    lineHeight: String(t.lineHeight),
    letterSpacing: t.letterSpacing,
    fontWeight: String(t.weight),
  }
}
