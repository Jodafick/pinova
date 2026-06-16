/**
 * Scan NSFW local (nsfwjs + TensorFlow.js) — chunk séparé, chargé uniquement
 * sur /create, /story/create, /foto/:slug/edit ou double-vérification client.
 */
import {
  STORY_VIDEO_MIN_SIZE_MB,
  STORY_VIDEO_MAX_SIZE_MB,
  storyVideoMaxBytesAllowed,
  storyVideoMinBytesRequired,
} from '../constants/mediaRequirements'
import {
  classifyNsfwScores,
  optsToAdult,
  predsToScores,
  type ModerationImageResult,
  type ModerationScanMediaOptions,
} from './moderationPolicy'

let nsfwModelPromise: Promise<Awaited<ReturnType<Awaited<typeof import('nsfwjs')>['load']>>> | null = null

function loadNsfwModel() {
  if (!nsfwModelPromise) {
    nsfwModelPromise = import('nsfwjs').then((m) => m.load())
  }
  return nsfwModelPromise
}

/** Précharge le modèle NSFW (appelé depuis le router sur les routes création). */
export function preloadNsfwScanner(): void {
  void loadNsfwModel()
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
    const ia = order.indexOf(a.level as (typeof order)[number])
    const ib = order.indexOf(b.level as (typeof order)[number])
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
    minB > 0 &&
    typeof file.size === 'number' &&
    Number.isFinite(file.size) &&
    file.size > 0 &&
    file.size < minB
  ) {
    return { level: 'video_too_small', minSizeMb: STORY_VIDEO_MIN_SIZE_MB }
  }
  const maxB = storyVideoMaxBytesAllowed()
  if (
    maxB > 0 &&
    typeof file.size === 'number' &&
    Number.isFinite(file.size) &&
    file.size > 0 &&
    file.size > maxB
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
