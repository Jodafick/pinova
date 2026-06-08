/** Chargement script AdSense + push sérialisé (évite le TagError en SPA). */

let scriptPromise: Promise<void> | null = null
let scriptClientId = ''

const fillQueue: Array<() => void> = []
let draining = false

function isInsFilled(ins: HTMLElement): boolean {
  return ins.hasAttribute('data-adsbygoogle-status')
}

async function drainFillQueue(): Promise<void> {
  if (draining) return
  draining = true
  while (fillQueue.length > 0) {
    const run = fillQueue.shift()
    run?.()
    await new Promise<void>((resolve) => {
      requestAnimationFrame(() => resolve())
    })
  }
  draining = false
}

export function loadAdsenseScript(clientId: string): Promise<void> {
  const id = clientId.trim()
  if (!id) return Promise.reject(new Error('AdSense client id missing'))
  if (scriptPromise && scriptClientId === id) return scriptPromise

  const existing = document.querySelector<HTMLScriptElement>('script[data-pinova-adsense]')
  if (existing) {
    scriptClientId = id
    scriptPromise = Promise.resolve()
    return scriptPromise
  }

  scriptClientId = id
  scriptPromise = new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(id)}`
    script.crossOrigin = 'anonymous'
    script.dataset.pinovaAdsense = '1'
    script.onload = () => resolve()
    script.onerror = () => {
      scriptPromise = null
      scriptClientId = ''
      reject(new Error('AdSense script failed to load'))
    }
    document.head.appendChild(script)
  })
  return scriptPromise
}

/**
 * Demande le remplissage d'un seul `<ins class="adsbygoogle">`.
 * Idempotent : ignore si le slot est déjà servi ou déjà en file.
 */
export function queueAdsenseFill(ins: HTMLElement, clientId: string): void {
  if (!ins || isInsFilled(ins) || ins.dataset.pinovaAdQueued === '1') return
  ins.dataset.pinovaAdQueued = '1'

  void loadAdsenseScript(clientId)
    .then(() => {
      if (isInsFilled(ins)) return
      fillQueue.push(() => {
        if (isInsFilled(ins)) return
        try {
          const w = window as Window & { adsbygoogle?: unknown[] }
          w.adsbygoogle = w.adsbygoogle || []
          w.adsbygoogle.push({})
        } catch {
          delete ins.dataset.pinovaAdQueued
        }
      })
      return drainFillQueue()
    })
    .catch(() => {
      delete ins.dataset.pinovaAdQueued
    })
}
