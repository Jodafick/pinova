/**
 * Marqueurs de démarrage — dev / perf overlay uniquement.
 */
const marks = new Map<string, number>()

export function markBootPhase(name: string): void {
  if (typeof performance === 'undefined') return
  const t = performance.now()
  marks.set(name, t)
  if (import.meta.env.DEV) {
    performance.mark(`pinova:${name}`)
  }
}

export function getBootMarks(): Record<string, number> {
  const out: Record<string, number> = {}
  marks.forEach((v, k) => {
    out[k] = Math.round(v)
  })
  return out
}

export function domNodeCount(): number {
  if (typeof document === 'undefined') return 0
  return document.getElementsByTagName('*').length
}
