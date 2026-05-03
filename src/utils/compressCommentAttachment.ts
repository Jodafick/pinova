/** Limite alignée avec le backend / UI commentaires (`RichCommentInput`). */
export const COMMENT_MEDIA_MAX_BYTES = 5 * 1024 * 1024

/** Aligné avec `MAX_COMMENT_JPEG_SIDE` côté serveur (`pins/comment_media.py`). */
const DEFAULT_MAX_SIDE = 1280
const MIN_SIDE = 260

function scaledDimensionsByRatio(width: number, height: number, ratio: number) {
  if (width <= 0 || height <= 0) return { width: 1, height: 1 }
  const r = Math.max(ratio, 0.01)
  return {
    width: Math.max(1, Math.round(width * r)),
    height: Math.max(1, Math.round(height * r)),
  }
}

async function decodeToDrawable(file: File): Promise<ImageBitmap | HTMLImageElement> {
  try {
    return await createImageBitmap(file)
  } catch {
    return await loadImageFromObjectUrl(file)
  }
}

function loadImageFromObjectUrl(file: File): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file)
    const img = new Image()
    img.decoding = 'async'
    img.onload = () => {
      URL.revokeObjectURL(url)
      resolve(img)
    }
    img.onerror = () => {
      URL.revokeObjectURL(url)
      reject(new Error('image_decode_failed'))
    }
    img.src = url
  })
}

function releaseDrawable(drawable: ImageBitmap | HTMLImageElement) {
  if ('close' in drawable && typeof (drawable as ImageBitmap).close === 'function') {
    ;(drawable as ImageBitmap).close()
  }
}

function jpegFileName(originalName: string): string {
  const base = originalName.replace(/\.[^/.]+$/, '').trim() || 'image'
  return `${base}.jpg`
}

function canvasToJPEG(canvas: HTMLCanvasElement, quality: number): Promise<Blob | null> {
  return new Promise((resolve) => {
    canvas.toBlob((b) => resolve(b), 'image/jpeg', quality)
  })
}

export class CommentAttachmentCompressError extends Error {
  constructor(message = 'compress_failed') {
    super(message)
    this.name = 'CommentAttachmentCompressError'
  }
}

/**
 * Réduit taille / qualité (JPEG) pour rester sous `maxBytes`.
 * Les GIF animés deviennent une image fixe (première frame), comme après décodage navigateur.
 */
export async function compressCommentAttachment(
  file: File,
  maxBytes: number = COMMENT_MEDIA_MAX_BYTES,
  maxSide: number = DEFAULT_MAX_SIDE,
): Promise<File> {
  if (!file.type.startsWith('image/')) return file
  if (file.size <= maxBytes) return file

  let drawable: ImageBitmap | HTMLImageElement | null = null
  try {
    drawable = await decodeToDrawable(file)
  } catch {
    throw new CommentAttachmentCompressError('decode_failed')
  }

  const dw = drawable.width
  const dh = drawable.height
  const maxDim = Math.max(dw, dh, 1)
  /** Cible initiale ≤ maxSide px sur le grand côté, sans agrandir. */
  let ratio = Math.min(1, maxSide / maxDim)

  try {
    while (Math.ceil(maxDim * ratio) >= MIN_SIDE) {
      const { width, height } = scaledDimensionsByRatio(dw, dh, ratio)
      const canvas = document.createElement('canvas')
      canvas.width = width
      canvas.height = height
      const ctx = canvas.getContext('2d')
      if (!ctx) {
        throw new CommentAttachmentCompressError('no_context')
      }
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, width, height)
      ctx.drawImage(drawable, 0, 0, width, height)

      for (let q = 0.9; q >= 0.38; q -= 0.04) {
        const blob = await canvasToJPEG(canvas, q)
        if (blob && blob.size <= maxBytes) {
          releaseDrawable(drawable)
          return new File([blob], jpegFileName(file.name), {
            type: 'image/jpeg',
            lastModified: Date.now(),
          })
        }
      }

      ratio *= 0.84
    }
  } finally {
    if (drawable) releaseDrawable(drawable)
  }

  throw new CommentAttachmentCompressError('still_too_large')
}
