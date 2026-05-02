import { checkProfanity } from 'glin-profanity'

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

/** Score agrégé (pondération sexy basse — le modèle sur-estime souvent Sexy sur des photos normales). */
export function globalNsfwScore(s: NsfwScores): number {
  return s.porn + s.hentai + s.sexy * 0.4
}

/** Seuils très permissifs : bloquer surtout le clairement explicite ; éviter les faux positifs massifs. */
const DRAWING_PASS_MIN = 0.62
const DRAWING_PASS_MAX_PH = 0.88

const BLOCK_PORN = 0.94
const BLOCK_HENTAI = 0.94
const BLOCK_COMBO_SCORE = 1.18

/** Sans âge vérifié : pas de blur ; on ne bloque que si plusieurs signaux sont très forts. */
const MINOR_BLOCK_PH = 0.9
const MINOR_BLOCK_SEXY = 0.94
const MINOR_BLOCK_SCORE = 1.08

const BLUR_SEXY = 0.88
const BLUR_PH_LO = 0.82
const BLUR_SCORE_LO = 0.85

/**
 * ALLOW / BLUR (adultes) / BLOCK.
 */
export function classifyNsfwScores(isVerifiedAdult: boolean, scores: NsfwScores): ModerationImageResult {
  const gs = globalNsfwScore(scores)
  const { porn, hentai, sexy, drawing } = scores
  const maxPh = Math.max(porn, hentai)

  // Dessin dominant + pas de signal explicite fort → OK
  if (drawing >= DRAWING_PASS_MIN && maxPh < DRAWING_PASS_MAX_PH && sexy < BLUR_SEXY) {
    return { level: 'ok', scores }
  }

  const explicitBlock =
    porn >= BLOCK_PORN || hentai >= BLOCK_HENTAI || gs >= BLOCK_COMBO_SCORE
  if (explicitBlock) {
    return { level: 'block', maxScore: Math.max(porn, hentai, gs), scores }
  }

  if (!isVerifiedAdult) {
    const minorTooMuch =
      maxPh >= MINOR_BLOCK_PH || sexy >= MINOR_BLOCK_SEXY || gs >= MINOR_BLOCK_SCORE
    if (minorTooMuch) {
      return { level: 'block', maxScore: Math.max(maxPh, sexy, gs), scores }
    }
    return { level: 'ok', scores }
  }

  const wantsBlur =
    sexy >= BLUR_SEXY ||
    (maxPh >= BLUR_PH_LO && maxPh < BLOCK_PORN) ||
    (gs >= BLUR_SCORE_LO && gs < BLOCK_COMBO_SCORE)

  if (wantsBlur) {
    return { level: 'blur', maxScore: Math.max(sexy, maxPh, gs), scores }
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
}

function optsToAdult(opts?: ModerationScanMediaOptions): boolean {
  return isVerifiedAdultFromBirthDate(opts?.birthDate)
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
