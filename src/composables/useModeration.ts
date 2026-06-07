/**
 * Façade modération — réexporte la politique pure et délègue les scans lourds
 * (nsfwjs, blocklist texte partagée) via imports dynamiques pour ne pas alourdir le bundle initial.
 */
export {
  hasRequiredBirthDateForMediaPublish,
  isVerifiedAdultFromBirthDate,
  viewerCanRevealSensitiveMedia,
  sensitiveMediaBlurredByDefault,
  classifyNsfwScores,
  globalNsfwScore,
  predsToScores,
  type NsfwScores,
  type ModerationImageResult,
  type ModerationScanMediaOptions,
} from './moderationPolicy'

export { moderationScanText } from './textModeration'

export async function moderationScanImageFile(
  ...args: Parameters<(typeof import('./nsfwScanner'))['moderationScanImageFile']>
) {
  const m = await import('./nsfwScanner')
  return m.moderationScanImageFile(...args)
}

export async function moderationScanVideoFile(
  ...args: Parameters<(typeof import('./nsfwScanner'))['moderationScanVideoFile']>
) {
  const m = await import('./nsfwScanner')
  return m.moderationScanVideoFile(...args)
}
