/**
 * Tailles fichier vidéo story — alignées sur Django `PIN_STORY_VIDEO_MIN_SIZE_MB`
 * et `PIN_STORY_VIDEO_MAX_SIZE_MB`.
 */
export const STORY_VIDEO_MIN_SIZE_MB = 1
export const STORY_VIDEO_MAX_SIZE_MB = 128

/** 0 = pas de borne côté client (le backend reste la source de vérité). */
export function storyVideoMinBytesRequired(): number {
  const mb = STORY_VIDEO_MIN_SIZE_MB
  if (!(typeof mb === 'number' && Number.isFinite(mb) && mb > 0)) return 0
  return Math.round(mb * 1024 * 1024)
}

/** 0 = pas de plafond côté client. */
export function storyVideoMaxBytesAllowed(): number {
  const mb = STORY_VIDEO_MAX_SIZE_MB
  if (!(typeof mb === 'number' && Number.isFinite(mb) && mb > 0)) return 0
  return Math.round(mb * 1024 * 1024)
}

/**
 * Si la taille en octets est connue (> 0), indique si le fichier est plus petit que le seuil minimal.
 */
export function storyVideoFileTooSmallBySizeBytes(sizeBytes: number): boolean {
  const min = storyVideoMinBytesRequired()
  const sz =
    typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) ? Math.round(sizeBytes) : 0
  return min > 0 && sz > 0 && sz < min
}

/**
 * Si la taille est connue (> 0), indique si elle dépasse le plafond.
 */
export function storyVideoFileTooLargeBySizeBytes(sizeBytes: number): boolean {
  const maxB = storyVideoMaxBytesAllowed()
  const sz =
    typeof sizeBytes === 'number' && Number.isFinite(sizeBytes) ? Math.round(sizeBytes) : 0
  return maxB > 0 && sz > 0 && sz > maxB
}
