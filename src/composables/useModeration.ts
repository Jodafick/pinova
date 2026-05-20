import { checkProfanity } from 'glin-profanity'

import {
  STORY_VIDEO_MIN_SIZE_MB,
  STORY_VIDEO_MAX_SIZE_MB,
  storyVideoMaxBytesAllowed,
  storyVideoMinBytesRequired,
} from '../constants/mediaRequirements'

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
  /** Fichier vidéo trop léger (< seuil Mo aligné avec le backend). */
  | { level: 'video_too_small'; minSizeMb: number }
  /** Fichier vidéo trop lourd (> plafond Mo aligné avec le backend). */
  | { level: 'video_too_large'; maxSizeMb: number }

let nsfwModelPromise: Promise<Awaited<ReturnType<Awaited<typeof import('nsfwjs')>['load']>>> | null = null

function loadNsfwModel() {
  if (!nsfwModelPromise) {
    nsfwModelPromise = import('nsfwjs').then((m) => m.load())
  }
  return nsfwModelPromise
}

function fileToHtmlImage(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const im = new Image()
    im.crossOrigin = 'anonymous'
    im.onload = () => {
      URL.revokeObjectURL(url)
      resolve(im)
    }
    im.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('Image load failed'))
    }
    im.src = url
  })
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

/** Agrégat explicite : sexy contribue peu (évite de traiter bikini / glamour comme « nude »). */
export function globalNsfwScore(s: NsfwScores): number {
  return s.porn + s.hentai + s.sexy * 0.2
}

/* --- Tolérance sexy façon flux « social » type X — flou sur vrai suggestif nu, bloc sur explicite --- */
const T_PORN_SOFT = 0.5
const T_HENT_SOFT = 0.45
const T_HARD_PORN = 0.91
const T_HARD_HENTAI = 0.82
/** Blocage agrégé seulement si explicite fort (sexy peu pondéré). */
const T_SCORE_BLOCK = 1.38
/** Zone flou majeur : hors « fashion sexy » pur. */
const T_SCORE_BLUR_LO = 0.72
const T_DRAWING_ART = 0.85

/**
 * « Sexy » dominant vs probabilités d’explicite : maillots, lingerie légitime,
 * mise en scène glamour sans nu intégral (le modèle mélange souvent sexy avec porn).
 */
function isLikelySexyNotExplicitNude(scores: NsfwScores): boolean {
  const { porn, hentai, sexy } = scores
  if (sexy < 0.5) return false
  /* Forte carte Sexy dominant sur Porn/Hentai, sans probabilités explicites extrêmes. */
  if (sexy >= 0.62 && porn < 0.8 && hentai < 0.68 && sexy >= porn * 1.04) return true
  if (sexy >= 0.52 && sexy >= porn * 1.12 && porn < 0.72 && hentai < 0.58) return true
  return false
}

/**
 * ALLOW / BLUR (majeurs connectés avec date ≥18 vérifiée) / BLOCK.
 * Sexy légitime n’entraîne pas de flou automatique ; on floute sur corridor « nu / soft explicite ».
 */
export function classifyNsfwScores(isVerifiedAdult: boolean, scores: NsfwScores): ModerationImageResult {
  const { porn, hentai, sexy, drawing } = scores
  const gs = globalNsfwScore(scores)
  const glamourPass = isLikelySexyNotExplicitNude(scores)

  const elevatedWithoutGlamour =
    (porn >= T_PORN_SOFT || hentai >= T_HENT_SOFT || (sexy >= 0.74 && !glamourPass))

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
    /* Mineurs : autorisés sur du glamour léger ; bloc sur tout corridor flou/adulte. */
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

function predsToLevel(
  preds: { className: string; probability: number }[],
  isVerifiedAdult: boolean,
): ModerationImageResult {
  const scores = predsToScores(preds)
  return classifyNsfwScores(isVerifiedAdult, scores)
}

function mergeWorst(a: ModerationImageResult, b: ModerationImageResult): ModerationImageResult {
  const rank = { video_too_large: 5, video_too_small: 4, block: 3, blur: 2, ok: 1 }
  const ra = rank[a.level]
  const rb = rank[b.level]
  if (ra > rb) return a
  if (rb > ra) return b
  if (
    (a.level === 'video_too_small' || a.level === 'video_too_large') &&
    (b.level === 'video_too_small' || b.level === 'video_too_large')
  ) {
    const order = ['video_too_large', 'video_too_small'] as const
    const ia = order.indexOf(a.level as typeof order[number])
    const ib = order.indexOf(b.level as typeof order[number])
    return ia <= ib ? a : b
  }
  if (a.level === 'block' && b.level === 'block') {
    return a.maxScore >= b.maxScore ? a : b
  }
  if (a.level === 'blur' && b.level === 'blur') {
    return a.maxScore >= b.maxScore ? a : b
  }
  return { level: 'ok' }
}

/** Texte — UX uniquement ; le backend renégocie tout. */
export function moderationScanText(parts: string[]): { ok: true } | { ok: false } {
  const joined = parts.filter(Boolean).join('\n')
  if (!joined.trim()) return { ok: true }
  const r = checkProfanity(joined, {
    languages: ['french', 'english'],
    detectLeetspeak: true,
    normalizeUnicode: true,
  })
  if (r.containsProfanity) return { ok: false }
  return { ok: true }
}

export type ModerationScanMediaOptions = {
  /** ISO date YYYY-MM-DD ; absent / incomplet → mineur pour la modération média */
  birthDate?: string | null
  /** Si absent ou false → mineur (ex. invité). Obligatoire à true avec une date valide pour le palier blur adulte. */
  isAuthenticated?: boolean
}

function optsToAdult(opts?: ModerationScanMediaOptions): boolean {
  if (opts?.isAuthenticated !== true) return false
  return isVerifiedAdultFromBirthDate(opts.birthDate)
}

/** Révélation du média sensible (bouton « Voir le contenu ») : connecté ET majeur vérifié par date. */
export function viewerCanRevealSensitiveMedia(isAuthenticated: boolean, birthDate?: string | null): boolean {
  return isAuthenticated === true && isVerifiedAdultFromBirthDate(birthDate)
}

/**
 * Flou par défaut sur les médias marqués sensibles (côté client).
 * Plus/Pro peuvent désactiver le flou via le profil ; mineurs / non connectés : toujours flouté.
 * Si l’API masque déjà les pins sensibles (`hide_sensitive_pins`), ils n’atteignent pas le client.
 */
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

/**
 * NSFWJS dans le navigateur uniquement (aucune image envoyée au backend ML).
 */
export async function moderationScanImageFile(
  file: File,
  opts?: ModerationScanMediaOptions,
): Promise<ModerationImageResult> {
  if (!file.type.startsWith('image/')) return { level: 'ok' }
  const model = await loadNsfwModel()
  const img = await fileToHtmlImage(file)
  const preds = await model.classify(img)
  return predsToLevel(preds, optsToAdult(opts))
}

export async function moderationScanVideoFile(
  file: File,
  frameCount: number = 5,
  opts?: ModerationScanMediaOptions,
): Promise<ModerationImageResult> {
  if (!file.type.startsWith('video/')) return { level: 'ok' }
  const minB = storyVideoMinBytesRequired()
  if (
    minB > 0
    && typeof file.size === 'number'
    && Number.isFinite(file.size)
    && file.size > 0
    && file.size < minB
  ) {
    return { level: 'video_too_small', minSizeMb: STORY_VIDEO_MIN_SIZE_MB }
  }
  const maxB = storyVideoMaxBytesAllowed()
  if (
    maxB > 0
    && typeof file.size === 'number'
    && Number.isFinite(file.size)
    && file.size > 0
    && file.size > maxB
  ) {
    return { level: 'video_too_large', maxSizeMb: STORY_VIDEO_MAX_SIZE_MB }
  }
  const isVerifiedAdult = optsToAdult(opts)
  const n = Math.min(5, Math.max(3, Math.round(frameCount)))
  const model = await loadNsfwModel()
  const url = URL.createObjectURL(file)
  const video = document.createElement('video')
  video.src = url
  video.muted = true
  video.playsInline = true
  video.preload = 'metadata'

  await new Promise<void>((resolve, reject) => {
    video.onloadedmetadata = () => resolve()
    video.onerror = () => reject(new Error('Video metadata failed'))
  })

  const duration = video.duration
  const w = video.videoWidth
  const h = video.videoHeight
  if (!Number.isFinite(duration) || duration <= 0 || w <= 0 || h <= 0) {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
    return { level: 'ok' }
  }

  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
    return { level: 'ok' }
  }

  const times: number[] = []
  for (let i = 0; i < n; i++) {
    times.push((duration * (i + 1)) / (n + 1))
  }

  let worst: ModerationImageResult = { level: 'ok' }

  try {
    for (const t of times) {
      video.currentTime = t
      await new Promise<void>((resolve, reject) => {
        const done = () => {
          video.removeEventListener('seeked', done)
          video.removeEventListener('error', onErr)
          resolve()
        }
        const onErr = () => {
          video.removeEventListener('seeked', done)
          video.removeEventListener('error', onErr)
          reject(new Error('seek failed'))
        }
        video.addEventListener('seeked', done, { once: true })
        video.addEventListener('error', onErr, { once: true })
      })
      ctx.drawImage(video, 0, 0, w, h)
      const preds = await model.classify(canvas)
      const level = predsToLevel(preds, isVerifiedAdult)
      worst = mergeWorst(worst, level)
      if (worst.level === 'block') break
    }
  } finally {
    URL.revokeObjectURL(url)
    video.removeAttribute('src')
    video.load()
  }

  return worst
}
