/**
 * Résolution des icônes Material Symbols pour `FotoceIcon`.
 * Les clés héritées (topics, settings) restent au format Material (`favorite`, `home`, …).
 */

import { MATERIAL_ICON_SUBSET } from '../generated/materialIconSubset'

export type MaterialIconMeta = {
  glyph: string
  filled: boolean
  spin: boolean
}

const SUBSET_SET = new Set<string>(MATERIAL_ICON_SUBSET)
const warnedMissing = new Set<string>()

function normalizeKey(name: string): string {
  return name.trim().toLowerCase().replace(/-/g, '_')
}

export function resolveMaterialIcon(
  name: string | null | undefined,
  options: { filled?: boolean; spin?: boolean } = {},
): MaterialIconMeta {
  const key = normalizeKey(name || '')
  let glyph = key || 'help'
  if (key && !SUBSET_SET.has(key)) {
    if (import.meta.env.DEV && !warnedMissing.has(key)) {
      warnedMissing.add(key)
      console.warn(`[FotoceIcon] icône absente du subset Material : "${key}" — lancez pnpm generate:icons`)
    }
    glyph = 'category'
  }
  const spin = Boolean(options.spin || glyph === 'progress_activity')
  const filled = Boolean(options.filled)
  return { glyph, filled, spin }
}

/** @deprecated Utiliser resolveMaterialIcon — conservé pour imports legacy. */
export const resolveFaIcon = resolveMaterialIcon
