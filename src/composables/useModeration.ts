import { checkProfanity } from 'glin-profanity'

/** Date minimale obligatoire côté API pour poster image / vidéo (profil réglages). */
export function hasRequiredBirthDateForMediaPublish(value: unknown): boolean {
  if (value == null || value === '') return false
  const head = String(value).trim().split('T')[0].slice(0, 10)
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

/** Score global Pinova : porn + hentai + sexy×0.6 */
export function globalNsfwScore(s: NsfwScores): number {
  return s.porn + s.hentai + s.sexy * 0.6
}

/* --- Seuils spec Pinova (strict quand âge inconnu : comportement mineur) --- */
const T_SOFT = 0.55
const T_SEXY_BLUR = 0.7
/** Photo nue / suggestive souvent étiquetée « Porn » par le modèle sans être du porno dur → seuil blocage plus haut que hentai. */
const T_HARD_PORN = 0.88
const T_HARD_HENTAI = 0.75
/** Blocage sur agrégat : évite BLOCK dès que porn≈0.76 + sexy modéré (cas nu artistique / seins nus). */
const T_SCORE_BLOCK = 1.18
const T_SCORE_BLUR_LO = 0.6
const T_DRAWING_ART = 0.85

/**
 * ALLOW / BLUR (adultes vérifiés + connectés uniquement) / BLOCK.
 * Utilisateur non connecté ou sans date valide ≥18 : traité comme mineur → pas de blur, hors zone safe → block.
 */
export function classifyNsfwScores(isVerifiedAdult: boolean, scores: NsfwScores): ModerationImageResult {
  const gs = globalNsfwScore(scores)
  const { porn, hentai, sexy, drawing } = scores

  const othersElevated = porn >= T_SOFT || hentai >= T_SOFT || sexy >= T_SEXY_BLUR

  // Dessin / art : ALLOW si dominant et pas d'autres scores élevés
  if (drawing >= T_DRAWING_ART && !othersElevated) {
    return { level: 'ok', scores }
  }

  // BLOCK : porno très probable, hentai explicite, ou combinaison scores forte
  const hardBlock = porn >= T_HARD_PORN || hentai >= T_HARD_HENTAI || gs >= T_SCORE_BLOCK
  if (hardBlock) {
    return { level: 'block', maxScore: Math.max(porn, hentai, gs), scores }
  }

  const blurExplicit =
    sexy >= T_SEXY_BLUR ||
    (porn >= T_SOFT && porn < T_HARD_PORN) ||
    (hentai >= T_SOFT && hentai < T_HARD_HENTAI)
  const blurByScore = gs >= T_SCORE_BLUR_LO && gs < T_SCORE_BLOCK
  const wantsBlur = blurExplicit || blurByScore

  if (!isVerifiedAdult) {
    const totallySafe =
      porn < T_SOFT && hentai < T_SOFT && sexy < T_SEXY_BLUR && gs < T_SCORE_BLUR_LO && !wantsBlur
    if (!totallySafe) {
      return { level: 'block', maxScore: Math.max(porn, hentai, sexy, gs), scores }
    }
    return { level: 'ok', scores }
  }

  if (wantsBlur) {
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
  const rank = { block: 3, blur: 2, ok: 1 }
  const ra = rank[a.level]
  const rb = rank[b.level]
  if (ra > rb) return a
  if (rb > ra) return b
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
