/**
 * Résolution des icônes Material Symbols pour `PinovaIcon`.
 * Les clés héritées (topics, settings) restent au format Material (`favorite`, `home`, …).
 */

export type MaterialIconMeta = {
  glyph: string
  filled: boolean
  spin: boolean
}

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, '_')
}

export function resolveMaterialIcon(
  name: string | null | undefined,
  options: { filled?: boolean; spin?: boolean } = {},
): MaterialIconMeta {
  const key = normalizeKey(name || '')
  const glyph = key || 'help'
  const spin = Boolean(options.spin || key === 'progress_activity')
  const filled = Boolean(options.filled)
  return { glyph, filled, spin }
}

/** @deprecated Utiliser resolveMaterialIcon — conservé pour imports legacy. */
export const resolveFaIcon = resolveMaterialIcon
