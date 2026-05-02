import { checkProfanity } from 'glin-profanity'

export type ModerationImageResult =
  | { level: 'ok' }
  | { level: 'warn'; maxScore: number }
  | { level: 'block'; maxScore: number }

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

/** Seuils alignés avec l’ancienne logique image (NSFWJS côté navigateur uniquement). */
function predsToLevel(preds: { className: string; probability: number }[]): ModerationImageResult {
  const map = Object.fromEntries(preds.map((p) => [p.className, p.probability])) as Record<string, number>
  const porn = map.Porn ?? 0
  const hentai = map.Hentai ?? 0
  const sexy = map.Sexy ?? 0
  const drawing = map.Drawing ?? 0
  if (porn >= 0.65 || hentai >= 0.65) {
    return { level: 'block', maxScore: Math.max(porn, hentai) }
  }
  if (sexy >= 0.55 || drawing >= 0.78) {
    return { level: 'warn', maxScore: Math.max(sexy, drawing) }
  }
  return { level: 'ok' }
}

function mergeWorst(a: ModerationImageResult, b: ModerationImageResult): ModerationImageResult {
  if (a.level === 'block' || b.level === 'block') {
    return a.level === 'block' ? a : b
  }
  if (a.level === 'warn' || b.level === 'warn') {
    return a.level === 'warn' ? a : b
  }
  return { level: 'ok' }
}

/** Texte pin / story / commentaire — UX uniquement ; le backend renégocie tout. */
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

/**
 * NSFWJS — chargé uniquement lors du premier scan d’image.
 * Tout le calcul reste dans le navigateur (aucune image n’est envoyée à un backend ML).
 */
export async function moderationScanImageFile(file: File): Promise<ModerationImageResult> {
  if (!file.type.startsWith('image/')) return { level: 'ok' }
  const model = await loadNsfwModel()
  const img = await fileToHtmlImage(file)
  const preds = await model.classify(img)
  return predsToLevel(preds)
}

/**
 * Vidéo : extrait `frameCount` images (3–5) réparties sur la durée, chacune classifiée par NSFWJS.
 * Même modèle que pour les images ; pas d’upload ni d’analyse serveur.
 */
export async function moderationScanVideoFile(
  file: File,
  frameCount: number = 5,
): Promise<ModerationImageResult> {
  if (!file.type.startsWith('video/')) return { level: 'ok' }
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
      const level = predsToLevel(preds)
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
