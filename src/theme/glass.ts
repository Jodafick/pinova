/**
 * Glass — système de surfaces translucides iOS-style centralisé.
 *
 * Toutes les modales / sheets / chromes de Fotoce utilisent ces tokens pour
 * garantir une cohérence visuelle (Apple-like) ET de bonnes performances sur
 * Safari iOS (le backdrop-filter est coûteux : on le limite à ces surfaces).
 *
 * Trois primitives :
 *  - `glassFill`        : couleur de fond translucide (light / dark)
 *  - `glassStroke`      : bordure subtile lumineuse en haut, ombre en bas
 *  - `scrim`            : opacité du backdrop derrière la modale (dim progressif)
 *
 * Chaque token expose un mode "rose accent" pour les surfaces Fotoce
 * (sheets de création, contextual menus dont le sujet est rose fotoce).
 *
 * Côté CSS, ces tokens sont aussi exposés en variables `--glass-*` via
 * `style.css` pour les composants `<style>` purs.
 *
 * Usage TS :
 *
 *   import { GLASS } from '../theme/glass'
 *   el.style.backgroundColor = GLASS.fill.lightStrong
 *   el.style.backdropFilter  = GLASS.blur.strong
 */

export interface GlassToken {
  light: string
  dark: string
}

export const GLASS = {
  /**
   * Fond translucide (`background-color`).
   * - Subtle  : sheet large (peu d'opacité, laisse beaucoup passer)
   * - Default : sheet et chromes standards (équilibre vision/lisibilité)
   * - Strong  : modale critique (lisibilité maximale)
   * - Rose    : variantes rose accent (sheets de création / actions Fotoce)
   */
  fill: {
    subtle:  { light: 'rgba(255, 255, 255, 0.62)', dark: 'rgba(8, 8, 11, 0.58)' } as GlassToken,
    default: { light: 'rgba(255, 255, 255, 0.78)', dark: 'rgba(7, 7, 10, 0.76)' } as GlassToken,
    strong:  { light: 'rgba(255, 255, 255, 0.92)', dark: 'rgba(5, 5, 8, 0.92)' } as GlassToken,
    rose: {
      subtle:  { light: 'rgba(255, 232, 240, 0.75)', dark: 'rgba(42, 12, 26, 0.58)' } as GlassToken,
      default: { light: 'rgba(255, 232, 240, 0.88)', dark: 'rgba(40, 11, 26, 0.76)' } as GlassToken,
      strong:  { light: 'rgba(255, 220, 232, 0.96)', dark: 'rgba(36, 10, 22, 0.9)' } as GlassToken,
    },
  },

  /**
   * Backdrop-filter à appliquer sur la surface.
   * On évite les blurs énormes : 18-22px = sweet spot pour Safari iOS
   * (au-delà, la GPU usage explose sur iPhone 12 et plus anciens).
   */
  blur: {
    light:    'saturate(160%) blur(12px)',
    default:  'saturate(180%) blur(20px)',
    strong:   'saturate(200%) blur(28px)',
  },

  /**
   * Bordures iOS : highlight 1px en haut (lumière captée) + ombre subtile bas.
   * Utiliser via `box-shadow` (inset) + `border` séparés.
   */
  stroke: {
    /** Bordure principale (1px) du conteneur glass. */
    border: { light: 'rgba(255, 255, 255, 0.42)', dark: 'rgba(255, 255, 255, 0.08)' } as GlassToken,
    /** Highlight inset en haut (donne effet 3D iOS). */
    highlight: { light: 'rgba(255, 255, 255, 0.62)', dark: 'rgba(255, 255, 255, 0.14)' } as GlassToken,
    /** Ombre interne basse (donne profondeur). */
    innerShadow: { light: 'rgba(0, 0, 0, 0.04)', dark: 'rgba(0, 0, 0, 0.25)' } as GlassToken,
  },

  /**
   * Ombre portée (`box-shadow`) du conteneur — donne l'effet "flotte au-dessus".
   * Variants : 'sm' (compact menus), 'md' (sheets bottom), 'lg' (modal center).
   */
  shadow: {
    sm: '0 8px 22px rgba(0, 0, 0, 0.12), 0 1px 0 rgba(255, 255, 255, 0.5) inset',
    md: '0 -10px 40px rgba(0, 0, 0, 0.18), 0 1px 0 rgba(255, 255, 255, 0.45) inset',
    lg: '0 18px 52px rgba(0, 0, 0, 0.28), 0 1px 0 rgba(255, 255, 255, 0.4) inset',
    /* Variantes dark : moins d'ombre highlight, plus de profondeur. */
    smDark: '0 10px 24px rgba(0, 0, 0, 0.45), 0 1px 0 rgba(255, 255, 255, 0.05) inset',
    mdDark: '0 -14px 48px rgba(0, 0, 0, 0.55), 0 1px 0 rgba(255, 255, 255, 0.05) inset',
    lgDark: '0 24px 60px rgba(0, 0, 0, 0.7), 0 1px 0 rgba(255, 255, 255, 0.05) inset',
  },

  /**
   * Scrim — opacité du backdrop derrière la modale (effet dim).
   * Valeurs progressives selon la criticité de la modale.
   */
  scrim: {
    /** Touch peu intrusif (floating cards, popovers). */
    soft:    { light: 'rgba(0, 0, 0, 0.12)', dark: 'rgba(0, 0, 0, 0.52)' } as GlassToken,
    /** Bottom sheet classique. */
    default: { light: 'rgba(0, 0, 0, 0.32)', dark: 'rgba(0, 0, 0, 0.68)' } as GlassToken,
    /** Modale critique (paiement, confirmation). */
    strong:  { light: 'rgba(0, 0, 0, 0.52)', dark: 'rgba(0, 0, 0, 0.82)' } as GlassToken,
  },

  /**
   * Border-radius iOS standard.
   * - 14 (small  / floating card / contextual menu)
   * - 22 (sheet  / modal center, conservé "Apple Music" feel)
   * - 28 (sheet  / tall sheet bord supérieur seulement)
   * - 38 (modal  / fullscreen iOS standalone)
   */
  radius: {
    sm: 14,
    md: 22,
    lg: 28,
    xl: 38,
  },

  /**
   * Variantes preset — pour usage direct dans les composants.
   * Chaque preset combine fill + blur + shadow + radius en une intention sémantique.
   *
   *   import { glassPreset } from '../theme/glass'
   *   const style = glassPreset('elevated')
   */
  presets: {
    /** Soft : surface très translucide, idéale pour chrome flottant. */
    soft:     { variant: 'subtle' as const,  blur: 'light'   as const, shadow: 'sm' as const, radius: 22 },
    /** Default : sheets et modales standards. */
    default:  { variant: 'default' as const, blur: 'default' as const, shadow: 'md' as const, radius: 22 },
    /** Elevated : modales critiques, profondeur maximale. */
    elevated: { variant: 'strong' as const,  blur: 'strong'  as const, shadow: 'lg' as const, radius: 22 },
    /** Dark : surface forte en dark mode (modal premium nuit). */
    dark:     { variant: 'strong' as const,  blur: 'default' as const, shadow: 'lg' as const, radius: 22 },
  },
} as const

/**
 * Sélecteur dark vs light. On lit `documentElement.classList.contains('dark')`
 * pour rester aligné avec `useAppearance.ts`.
 */
export function pickGlass(token: GlassToken): string {
  if (typeof document === 'undefined') return token.light
  return document.documentElement.classList.contains('dark') ? token.dark : token.light
}

/**
 * Compose un style CSS prêt-à-l'emploi pour une surface glass.
 * Optimisé pour Safari iOS : pas de filter empilé, GPU layer.
 */
export interface GlassSurfaceStyleOptions {
  variant?: 'subtle' | 'default' | 'strong'
  rose?: boolean
  blur?: keyof typeof GLASS.blur
  shadow?: 'sm' | 'md' | 'lg'
  radiusPx?: number
}

/**
 * Raccourci — résout un preset glass en options pour `glassSurfaceStyle`.
 *
 *   const style = glassSurfaceStyle(glassPreset('elevated'))
 */
export function glassPreset(name: keyof typeof GLASS.presets, rose = false): GlassSurfaceStyleOptions {
  return { ...GLASS.presets[name], rose }
}

export function glassSurfaceStyle(options: GlassSurfaceStyleOptions = {}): Record<string, string> {
  const variant = options.variant ?? 'default'
  const blurKey = options.blur ?? 'default'
  const radius = options.radiusPx ?? GLASS.radius.md
  const dark = typeof document !== 'undefined' && document.documentElement.classList.contains('dark')
  const shadowKey = options.shadow ?? 'md'
  const shadowVar = dark ? `${shadowKey}Dark` as keyof typeof GLASS.shadow : shadowKey

  const fillToken = options.rose ? GLASS.fill.rose[variant] : GLASS.fill[variant]
  const borderToken = GLASS.stroke.border

  return {
    backgroundColor: dark ? fillToken.dark : fillToken.light,
    backdropFilter: GLASS.blur[blurKey],
    WebkitBackdropFilter: GLASS.blur[blurKey],
    border: `1px solid ${dark ? borderToken.dark : borderToken.light}`,
    boxShadow: GLASS.shadow[shadowVar],
    borderRadius: `${radius}px`,
    /* GPU layer. */
    transform: 'translateZ(0)',
    backfaceVisibility: 'hidden',
  }
}
