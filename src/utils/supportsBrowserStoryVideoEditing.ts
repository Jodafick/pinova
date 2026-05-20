/**
 * Pré-requis de `StoryVideoEditor` (captureStream + MediaRecorder WebM, comme dans l’export actuel).
 * Si faux, la story vidéo utilise le fichier d’origine sans étape d’édition.
 */
export function supportsBrowserStoryVideoEditing(): boolean {
  if (typeof window === 'undefined') return false
  if (typeof MediaRecorder === 'undefined') return false
  const canRecordWebm =
    MediaRecorder.isTypeSupported('video/webm;codecs=vp9') ||
    MediaRecorder.isTypeSupported('video/webm')
  if (!canRecordWebm) return false
  try {
    const vid = document.createElement('video') as HTMLVideoElement & {
      captureStream?: () => MediaStream
      mozCaptureStream?: () => MediaStream
    }
    if (
      typeof vid.captureStream !== 'function' &&
      typeof vid.mozCaptureStream !== 'function'
    ) {
      return false
    }
    if (typeof HTMLCanvasElement.prototype.captureStream !== 'function') return false
    const c = document.createElement('canvas')
    c.width = 2
    c.height = 2
    const stream = c.captureStream(1)
    if (!stream?.getVideoTracks?.().length) {
      stream?.getTracks?.().forEach((t) => t.stop())
      return false
    }
    stream.getTracks().forEach((t) => t.stop())
    return true
  } catch {
    return false
  }
}
