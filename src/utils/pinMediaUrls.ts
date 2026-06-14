import type { Pin } from '../types'

/** URL principale grille feed — même source que le détail (fiabilité). */
export function pinGridImageSrc(pin: Pin): string {
  return pin.imageUrl?.trim() || pin.feedImageUrl?.trim() || ''
}

/** srcset feed : thumbnail léger en complément, image principale en fallback. */
export function pinGridImageSrcSet(pin: Pin): string | undefined {
  const full = pin.imageUrl?.trim()
  const thumb = pin.feedImageUrl?.trim()
  if (!full || !thumb || thumb === full) return undefined
  return `${thumb} 400w, ${full} 1200w`
}

/** URL détail (pleine résolution). */
export function pinDetailImageSrc(pin: Pin): string {
  return pin.imageUrl
}
