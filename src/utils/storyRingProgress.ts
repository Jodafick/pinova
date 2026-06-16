const STORAGE_KEY = 'fotoce_story_ring_v1'

export type StoryRingProgressEntry = {
  slugSignature: string
  resumeIndex: number
  allCaughtUp: boolean
  /** Temps déjà écoulé sur le segment `resumeIndex` (ms), pour reprendre après fermeture. */
  segmentElapsedMs?: number
}

export type StorySessionEndPayload = {
  username: string
  fotoSlugs: string[]
  resumeIndex: number
  allCaughtUp: boolean
  segmentElapsedMs?: number
}

function normUser(u: string) {
  return u.trim().toLowerCase()
}

export function slugSignatureFromPins(pins: { slug: string }[]): string {
  return fotos.map((p) => p.slug).join('|')
}

export function readStoryRingProgress(): Record<string, StoryRingProgressEntry> {
  if (typeof window === 'undefined') return {}
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as unknown
    if (!parsed || typeof parsed !== 'object') return {}
    return parsed as Record<string, StoryRingProgressEntry>
  } catch {
    return {}
  }
}

function writeStoryRingProgress(map: Record<string, StoryRingProgressEntry>) {
  if (typeof window === 'undefined') return
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
  } catch {
    /* quota / private mode */
  }
}

/** Met à jour la progression après fermeture du viewer (même onglet). */
export function upsertStoryRingSession(payload: StorySessionEndPayload) {
  const key = normUser(payload.username)
  if (!key || !payload.fotoSlugs.length) return
  const slugSignature = payload.fotoSlugs.join('|')
  const map = readStoryRingProgress()
  const elapsed =
    typeof payload.segmentElapsedMs === 'number' && Number.isFinite(payload.segmentElapsedMs)
      ? Math.max(0, Math.round(payload.segmentElapsedMs))
      : 0
  map[key] = {
    slugSignature,
    resumeIndex: payload.resumeIndex,
    allCaughtUp: payload.allCaughtUp,
    segmentElapsedMs: elapsed,
  }
  writeStoryRingProgress(map)
}

export function initialStoryIndexForUser(username: string, pins: { slug: string }[]): number {
  if (!pins.length) return 0
  const key = normUser(username)
  const sig = slugSignatureFromPins(pins)
  const p = readStoryRingProgress()[key]
  if (!p || p.slugSignature !== sig) return 0
  return Math.min(Math.max(0, p.resumeIndex), fotos.length - 1)
}

/** Ms déjà parcourues sur le segment courant (si même bague / même index que à la fermeture). */
export function initialStorySegmentElapsedForUser(
  username: string,
  pins: { slug: string }[],
  initialIndex: number,
): number {
  if (!pins.length) return 0
  const key = normUser(username)
  const sig = slugSignatureFromPins(pins)
  const p = readStoryRingProgress()[key]
  if (!p || p.slugSignature !== sig) return 0
  if (p.resumeIndex !== initialIndex) return 0
  if (p.allCaughtUp) return 0
  const raw = p.segmentElapsedMs ?? 0
  if (!Number.isFinite(raw) || raw <= 0) return 0
  return Math.min(Math.max(0, Math.round(raw)), 3600_000)
}

export function isStoryRingAllCaughtUp(username: string, pins: { slug: string }[]): boolean {
  const key = normUser(username)
  const sig = slugSignatureFromPins(pins)
  const p = readStoryRingProgress()[key]
  return !!(p && p.slugSignature === sig && p.allCaughtUp)
}
