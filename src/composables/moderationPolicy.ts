/** Politique de modération pure (sans nsfwjs / glin-profanity) — safe pour le bundle initial. */

export interface NsfwScores {
  porn: number
  hentai: number
  sexy: number
  drawing: number
}

export type ModerationImageResult =
  | { level: 'ok'; scores?: NsfwScores }
  | { level: 'blur'; maxScore: number; scores?: NsfwScores }
  | { level: 'block'; maxScore: number; scores?: NsfwScores }
  | { level: 'video_too_small'; minSizeMb: number }
  | { level: 'video_too_large'; maxSizeMb: number }

export type ModerationScanMediaOptions = {
  birthDate?: string | null
  isAuthenticated?: boolean
}

/** Date minimale obligatoire côté API pour poster image / vidéo (profil réglages). */
export function hasRequiredBirthDateForMediaPublish(value: unknown): boolean {
  if (value == null || value === '') return false
  const head = (String(value).trim().split('T')[0] ?? '').slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(head)) return false
  return !Number.isNaN(new Date(`${head}T12:00:00`).getTime())
}

/** Âge ≥18 avec date de naissance renseignée ; sinon mineur / inconnu → pas de BLUR côté publication. */
export function isVerifiedAdultFromBirthDate(birthDate: string | null | undefined): boolean {
  if (!birthDate || typeof birthDate !== 'string') return false
  const normalized = birthDate.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(normalized)) return false
  const d = new Date(`${normalized}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  const today = new Date()
  let age = today.getFullYear() - d.getFullYear()
  const m = today.getMonth() - d.getMonth()
  if (m < 0 || (m === 0 && today.getDate() < d.getDate())) age -= 1
  return age >= 18
}

export function predsToScores(preds: { className: string; probability: number }[]): NsfwScores {
  const map = Object.fromEntries(preds.map((p) => [p.className, p.probability])) as Record<string, number>
  return {
    porn: map.Porn ?? 0,
    hentai: map.Hentai ?? 0,
    sexy: map.Sexy ?? 0,
    drawing: map.Drawing ?? 0,
  }
}

export function globalNsfwScore(s: NsfwScores): number {
  return s.porn + s.hentai + s.sexy * 0.2
}

const T_PORN_SOFT = 0.5
const T_HENT_SOFT = 0.45
const T_HARD_PORN = 0.91
const T_HARD_HENTAI = 0.82
const T_SCORE_BLOCK = 1.38
const T_SCORE_BLUR_LO = 0.72
const T_DRAWING_ART = 0.85

function isLikelySexyNotExplicitNude(scores: NsfwScores): boolean {
  const { porn, hentai, sexy } = scores
  if (sexy < 0.5) return false
  if (sexy >= 0.62 && porn < 0.8 && hentai < 0.68 && sexy >= porn * 1.04) return true
  if (sexy >= 0.52 && sexy >= porn * 1.12 && porn < 0.72 && hentai < 0.58) return true
  return false
}

export function classifyNsfwScores(isVerifiedAdult: boolean, scores: NsfwScores): ModerationImageResult {
  const { porn, hentai, sexy, drawing } = scores
  const gs = globalNsfwScore(scores)
  const glamourPass = isLikelySexyNotExplicitNude(scores)

  const elevatedWithoutGlamour =
    porn >= T_PORN_SOFT || hentai >= T_HENT_SOFT || (sexy >= 0.74 && !glamourPass)

  if (drawing >= T_DRAWING_ART && !elevatedWithoutGlamour) {
    return { level: 'ok', scores }
  }

  if (glamourPass && porn < T_HARD_PORN && hentai < T_HARD_HENTAI) {
    return { level: 'ok', scores }
  }

  const hardBlock =
    porn >= T_HARD_PORN ||
    hentai >= T_HARD_HENTAI ||
    (gs >= T_SCORE_BLOCK && !glamourPass)
  if (hardBlock) {
    return { level: 'block', maxScore: Math.max(porn, hentai, gs), scores }
  }

  const blurCorridor =
    !glamourPass &&
    ((porn >= T_PORN_SOFT && porn < T_HARD_PORN) ||
      (hentai >= T_HENT_SOFT && hentai < T_HARD_HENTAI) ||
      (gs >= T_SCORE_BLUR_LO && gs < T_SCORE_BLOCK))

  if (!isVerifiedAdult) {
    if (glamourPass && porn < 0.78 && hentai < 0.62) {
      return { level: 'ok', scores }
    }
    const safeMinor =
      porn < T_PORN_SOFT - 0.06 && hentai < T_HENT_SOFT - 0.06 && gs < T_SCORE_BLUR_LO - 0.08 && !blurCorridor
    if (!safeMinor) {
      return { level: 'block', maxScore: Math.max(porn, hentai, sexy, gs), scores }
    }
    return { level: 'ok', scores }
  }

  if (blurCorridor) {
    return { level: 'blur', maxScore: Math.max(sexy, porn, hentai, gs), scores }
  }

  return { level: 'ok', scores }
}

export function optsToAdult(opts?: ModerationScanMediaOptions): boolean {
  if (opts?.isAuthenticated !== true) return false
  return isVerifiedAdultFromBirthDate(opts.birthDate)
}

export function viewerCanRevealSensitiveMedia(isAuthenticated: boolean, birthDate?: string | null): boolean {
  return isAuthenticated === true && isVerifiedAdultFromBirthDate(birthDate)
}

export function sensitiveMediaBlurredByDefault(
  isAuthenticated: boolean,
  birthDate: string | null | undefined,
  plan: string | null | undefined,
  blurByDefaultPreference: boolean | undefined,
): boolean {
  if (!viewerCanRevealSensitiveMedia(isAuthenticated, birthDate)) return true
  const paid = plan === 'plus' || plan === 'pro'
  if (paid && blurByDefaultPreference === false) return false
  return true
}
