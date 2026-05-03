import { ref } from 'vue'
import {
  moderationScanImageFile,
  moderationScanVideoFile,
  type ModerationImageResult,
  type ModerationScanMediaOptions,
} from './useModeration'

/**
 * Cache pour éviter de scanner plusieurs fois le même média.
 * Clé : URL du média, Valeur : Résultat de la modération.
 */
const scanCache = new Map<string, ModerationImageResult>()
/** Promesses en cours pour éviter les scans redondants en parallèle. */
const activeScans = new Map<string, Promise<ModerationImageResult>>()

export function useDoubleVerification() {
  const loading = ref(false)

  /**
   * Scanne un média distant (image ou vidéo).
   * Télécharge le fichier en blob pour le passer au scanner local (nsfwjs).
   */
  async function scanRemoteMedia(
    url: string,
    type: 'image' | 'video',
    opts?: ModerationScanMediaOptions,
  ): Promise<ModerationImageResult> {
    if (!url) return { level: 'ok' as const }
    if (scanCache.has(url)) return scanCache.get(url)!
    if (activeScans.has(url)) return activeScans.get(url)!

    const scanPromise = (async (): Promise<ModerationImageResult> => {
      try {
        const response = await fetch(url)
        const blob = await response.blob()
        const file = new File([blob], 'media', { type: blob.type })

        let result: ModerationImageResult
        if (type === 'video') {
          result = await moderationScanVideoFile(file, 5, opts)
        } else {
          result = await moderationScanImageFile(file, opts)
        }

        scanCache.set(url, result)
        return result
      } catch (err) {
        console.error('❌ Erreur lors de la double vérification du média:', url, err)
        return { level: 'ok' as const }
      } finally {
        activeScans.delete(url)
      }
    })()

    activeScans.set(url, scanPromise)
    return scanPromise
  }

  return {
    loading,
    scanRemoteMedia,
    scanCache,
  }
}
