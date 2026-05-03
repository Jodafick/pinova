const STORAGE_KEY = 'pinova_story_ring_v1'

export type StoryRingProgressEntry = {
  slugSignature: string
  resumeIndex: number
  allCaughtUp: boolean
}

export type StorySessionEndPayload = {
  username: string
  pinSlugs: string[]
  resumeIndex: number
  allCaughtUp: boolean
}

function normUser(u: string) {
  return u.trim().toLowerCase()
}

export function slugSignatureFromPins(pins: { slug: string }[]): string {
  return pins.map((p) => p.slug).join('|')
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
  if (!key || !payload.pinSlugs.length) return
  const slugSignature = payload.pinSlugs.join('|')
  const map = readStoryRingProgress()
  const prev = map[key]
  if (prev && prev.slugSignature !== slugSignature) {
    map[key] = {
      slugSignature,
      resumeIndex: payload.resumeIndex,
      allCaughtUp: payload.allCaughtUp,
    }
  } else {
    map[key] = {
      slugSignature,
      resumeIndex: payload.resumeIndex,
      allCaughtUp: payload.allCaughtUp,
    }
  }
  writeStoryRingProgress(map)
}

export function initialStoryIndexForUser(username: string, pins: { slug: string }[]): number {
  if (!pins.length) return 0
  const key = normUser(username)
  const sig = slugSignatureFromPins(pins)
  const p = readStoryRingProgress()[key]
  if (!p || p.slugSignature !== sig) return 0
  return Math.min(Math.max(0, p.resumeIndex), pins.length - 1)
}

export function isStoryRingAllCaughtUp(username: string, pins: { slug: string }[]): boolean {
  const key = normUser(username)
  const sig = slugSignatureFromPins(pins)
  const p = readStoryRingProgress()[key]
  return !!(p && p.slugSignature === sig && p.allCaughtUp)
}
