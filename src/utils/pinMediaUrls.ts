import type { Pin } from '../types'

/** URL optimisée grille feed (thumbnail carré si dispo). */
export function pinGridImageSrc(pin: Pin): string {
  return pin.feedImageUrl?.trim() || pin.imageUrl
}

/** srcset feed : thumbnail → image principale. */
export function pinGridImageSrcSet(pin: Pin): string | undefined {
  const thumb = pin.feedImageUrl?.trim()
  const full = pin.imageUrl?.trim()
  if (!thumb || !full || thumb === full) return undefined
  return `${thumb} 400w, ${full} 1200w`
}

/** URL détail (pleine résolution). */
export function pinDetailImageSrc(pin: Pin): string {
  return pin.imageUrl
}
