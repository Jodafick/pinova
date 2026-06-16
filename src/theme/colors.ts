/**
 * Colors — palette Fotoce définitive (rose accent + neutres OLED-friendly).
 *
 * Principes :
 *  - Rose Fotoce en accent unique, jamais dilué (consistance brand)
 *  - Neutres iOS-like : gris légèrement teintés rose (apporte chaleur)
 *  - Dark mode OLED : noir profond (#050507) + grays calibrés pour AMOLED
 *    (jamais "gris plat", toujours subtilement teinté)
 *  - Tous les tokens semantiques (text-primary, surface-elevated, etc.)
 *    sont définis en CSS variables — ce fichier expose les valeurs sources
 *
 * Réf : Apple HIG color theory, Material You dynamic colors,
 *       iOS 18 System Colors (UIColor.systemBackground / .label etc.).
 */

export interface ColorSwatch {
  light: string
  dark: string
}

/** Rose Fotoce — DNA de la marque. */
export const ROSE = {
  /** Hover ultra-clair, fond rose subtil. */
  50:  '#fff1f5',
  /** Background des sections rose accent. */
  100: '#ffe1eb',
  /** Bordures et highlights subtils. */
  200: '#ffc2d6',
  /** Hover de boutons primaires. */
  300: '#ff8aae',
  /** Variant accent secondaire. */
  400: '#ff4d7d',
  /** PRIMARY — boutons / liens / accents. */
  500: '#e0245e',
  /** Active state (boutons enfoncés). */
  600: '#c11550',
  /** Texte sur fond rose clair, dark accent. */
  700: '#9d1245',
  /** Bordures dark mode rose. */
  800: '#6f0d33',
  /** Fonds dark rose (modales create dark). */
  900: '#4a0822',
} as const

/**
 * Neutres iOS — légèrement teintés warm pour éviter le gris plat clinique.
 * Hue ~ 14° (tendance vers le rose Fotoce) — donne cohérence brand.
 */
export const NEUTRAL = {
  0:    '#ffffff',  /* Pure white. */
  25:   '#fdfcfd',  /* Surface elevated light. */
  50:   '#f9f8f9',  /* Surface base light. */
  100:  '#f1f0f2',  /* Hover light. */
  200:  '#e6e4e7',  /* Border subtle light. */
  300:  '#d3d0d4',  /* Border default light. */
  400:  '#a8a4a9',  /* Text muted light / Text muted dark. */
  500:  '#75717a',  /* Text secondary. */
  600:  '#56525a',  /* Text body dim. */
  700:  '#3d3941',  /* Text dim dark mode. */
  800:  '#252329',  /* Surface elevated dark. */
  850:  '#1b1a1f',  /* Surface base dark. */
  900:  '#131217',  /* Surface deep dark (rarement utilisé direct). */
} as const

/**
 * Dark mode OLED — palette dédiée pour éviter le burn-in et maximiser le contraste.
 * Inspiré d'Apple Music dark / Pinterest dark.
 */
export const OLED = {
  /** True black — réservé aux backdrops fullscreen (story viewer, etc.). */
  black:        '#000000',
  /** Background app principal — légèrement teinté pour éviter "trou noir". */
  background:   '#070608',
  /** Surface niveau 1 (cards principales). */
  surface1:     '#0e0c10',
  /** Surface niveau 2 (cards élevées, modales bottom). */
  surface2:     '#161418',
  /** Surface niveau 3 (modales center, popovers). */
  surface3:     '#1d1b21',
  /** Surface niveau 4 (tooltips, contextual menus). */
  surface4:     '#26232a',
  /** Hover surface dark. */
  hover:        '#2e2b32',
  /** Pressed surface dark. */
  pressed:      '#363339',
  /** Border subtle dark. */
  border:       '#2a282d',
  /** Border default dark. */
  borderHigh:   '#3a373d',
  /** Highlight (inset top, 1px). */
  highlight:    'rgba(255, 255, 255, 0.06)',
  /** Highlight rose (cards Fotoce featured). */
  highlightRose: 'rgba(255, 145, 180, 0.04)',
} as const

/**
 * Tokens sémantiques — l'app les consomme via CSS variables.
 * Cette table sert de référence + de source de vérité pour `style.css`.
 */
export const SEMANTIC: Record<string, ColorSwatch> = {
  /* Surfaces */
  'surface-base':        { light: NEUTRAL[50],  dark: OLED.background },
  'surface-elevated':    { light: NEUTRAL[0],   dark: OLED.surface1 },
  'surface-floating':    { light: NEUTRAL[25],  dark: OLED.surface2 },
  'surface-overlay':     { light: NEUTRAL[0],   dark: OLED.surface3 },
  'surface-popover':     { light: NEUTRAL[0],   dark: OLED.surface4 },

  /* Texte */
  'text-primary':        { light: '#161417',    dark: '#f6f5f7' },
  'text-secondary':      { light: NEUTRAL[600], dark: '#c5c2c8' },
  'text-tertiary':       { light: NEUTRAL[500], dark: '#9c9aa1' },
  'text-disabled':       { light: NEUTRAL[400], dark: NEUTRAL[700] },
  'text-on-accent':      { light: NEUTRAL[0],   dark: NEUTRAL[0] },
  'text-link':           { light: ROSE[500],    dark: ROSE[400] },

  /* Bordures */
  'border-subtle':       { light: NEUTRAL[200], dark: OLED.border },
  'border-default':      { light: NEUTRAL[300], dark: OLED.borderHigh },
  'border-rose':         { light: ROSE[200],    dark: 'rgba(255, 145, 180, 0.22)' },
  'border-focus':        { light: ROSE[400],    dark: ROSE[400] },

  /* Accent (rose Fotoce) */
  'accent-default':      { light: ROSE[500],    dark: ROSE[400] },
  'accent-hover':        { light: ROSE[400],    dark: ROSE[300] },
  'accent-pressed':      { light: ROSE[600],    dark: ROSE[500] },
  'accent-subtle-bg':    { light: ROSE[50],     dark: 'rgba(224, 36, 94, 0.12)' },
  'accent-strong-bg':    { light: ROSE[100],    dark: 'rgba(224, 36, 94, 0.22)' },

  /* États sémantiques */
  'success-default':     { light: '#1e9c5b',    dark: '#3ed98c' },
  'success-subtle-bg':   { light: '#e3f7ec',    dark: 'rgba(62, 217, 140, 0.12)' },
  'warning-default':     { light: '#d97706',    dark: '#fbbf24' },
  'warning-subtle-bg':   { light: '#fef3c7',    dark: 'rgba(251, 191, 36, 0.12)' },
  'error-default':       { light: '#dc2626',    dark: '#ef4444' },
  'error-subtle-bg':     { light: '#fee2e2',    dark: 'rgba(239, 68, 68, 0.12)' },

  /* Skeletons */
  'skeleton-base':       { light: NEUTRAL[100], dark: OLED.surface2 },
  'skeleton-highlight':  { light: NEUTRAL[200], dark: OLED.surface3 },

  /* Backdrops */
  'backdrop-soft':       { light: 'rgba(0, 0, 0, 0.12)', dark: 'rgba(0, 0, 0, 0.40)' },
  'backdrop-default':    { light: 'rgba(0, 0, 0, 0.32)', dark: 'rgba(0, 0, 0, 0.56)' },
  'backdrop-strong':     { light: 'rgba(0, 0, 0, 0.52)', dark: 'rgba(0, 0, 0, 0.72)' },
}

/**
 * Gradients premium — utilisés pour buttons, banners, glow.
 * Format CSS direct pour usage immédiat en `background:`.
 */
export const GRADIENTS = {
  /** CTA principal Fotoce (rose chaud → magenta). */
  primary:        'linear-gradient(135deg, #ff4d7d 0%, #e0245e 55%, #c11550 100%)',
  /** Variant pressed (un poil plus saturé). */
  primaryPressed: 'linear-gradient(135deg, #e0245e 0%, #c11550 55%, #9d1245 100%)',
  /** Glow ambient subtil (à composer en blur 80px+). */
  glowRose:       'radial-gradient(circle, rgba(255, 95, 145, 0.45) 0%, transparent 70%)',
  /** Glow doux pour cards featured. */
  glowSoft:       'radial-gradient(circle, rgba(255, 138, 175, 0.28) 0%, transparent 70%)',
  /** Surface gradient subtil (cards, modal floor). */
  surfaceSubtle:  'linear-gradient(180deg, rgba(255, 255, 255, 0.65) 0%, rgba(255, 255, 255, 0.4) 100%)',
  /** Dark surface gradient (modal floor dark). */
  surfaceDark:    'linear-gradient(180deg, rgba(38, 35, 42, 0.85) 0%, rgba(22, 20, 24, 0.65) 100%)',
  /** Veil top — atmospheric overlay header. */
  veilTop:        'linear-gradient(180deg, rgba(0, 0, 0, 0.32) 0%, transparent 100%)',
  /** Veil bottom — atmospheric overlay footer (texts on media). */
  veilBottom:     'linear-gradient(0deg, rgba(0, 0, 0, 0.72) 0%, transparent 100%)',
} as const

/**
 * Z-index canoniques (échelle stricte, évite la guerre des `9999`).
 */
export const Z = {
  base:        0,
  raised:      10,
  dropdown:    50,
  sticky:      60,
  fixed:       70,
  banner:      80,
  overlay:     90,
  modal:       100,
  modalSticky: 110,
  popover:     120,
  toast:       130,
  tooltip:     140,
  contextMenu: 150,
  splash:      9999,
} as const

export type SemanticToken = keyof typeof SEMANTIC
