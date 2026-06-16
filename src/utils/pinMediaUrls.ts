import type { Foto } from '../types'

/** URL principale grille feed — même source que le détail (fiabilité). */
export function pinGridImageSrc(foto: Foto): string {
  return foto.imageUrl?.trim() || foto.feedImageUrl?.trim() || ''
}

/** srcset feed : thumbnail léger en complément, image principale en fallback. */
export function pinGridImageSrcSet(foto: Foto): string | undefined {
  const full = foto.imageUrl?.trim()
  const thumb = foto.feedImageUrl?.trim()
  if (!full || !thumb || thumb === full) return undefined
  return `${thumb} 400w, ${full} 1200w`
}

/** URL détail (pleine résolution). */
export function pinDetailImageSrc(foto: Foto): string {
  return foto.imageUrl
}
