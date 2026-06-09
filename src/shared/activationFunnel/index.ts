/** État funnel d'activation créateur (tutoriel, jalons, célébrations). */

export const CREATOR_MILESTONE_IDS = [
  'first_pin_published',
  'first_follow_obtained',
  'first_story_published',
  'first_comment_posted',
  'first_tip_received',
  'first_contest_joined',
  'creator_discovery_done',
] as const

export type CreatorMilestoneId = (typeof CREATOR_MILESTONE_IDS)[number]

export type WelcomeCreateTutorialStatus = 'completed' | 'dismissed'

export type ActivationFunnelState = {
  welcomeCreateTutorial?: WelcomeCreateTutorialStatus
  firstPinCelebrationSeen?: boolean
  milestones?: CreatorMilestoneId[]
}

export type CreatorLevelProgress = {
  level: number
  done: number
  total: number
  percent: number
}

const ALLOWED_MILESTONES = new Set<string>(CREATOR_MILESTONE_IDS)
const ALLOWED_TUTORIAL = new Set<string>(['completed', 'dismissed'])

/** Jalons comptés pour le niveau créateur 1 (barre de progression onboarding). */
export const CREATOR_LEVEL_1_MILESTONES: readonly CreatorMilestoneId[] = [
  'first_pin_published',
  'first_follow_obtained',
  'creator_discovery_done',
]

function parseRawObject(raw: unknown): Record<string, unknown> | null {
  if (raw == null || raw === '') return null
  if (typeof raw === 'string') {
    try {
      const parsed: unknown = JSON.parse(raw)
      return typeof parsed === 'object' && parsed !== null && !Array.isArray(parsed)
        ? (parsed as Record<string, unknown>)
        : null
    } catch {
      return null
    }
  }
  if (typeof raw === 'object' && !Array.isArray(raw)) {
    return raw as Record<string, unknown>
  }
  return null
}

function normalizeMilestones(raw: unknown): CreatorMilestoneId[] {
  if (!Array.isArray(raw)) return []
  const cleaned: CreatorMilestoneId[] = []
  const seen = new Set<string>()
  for (const item of raw) {
    const slug = String(item ?? '').trim()
    if (!ALLOWED_MILESTONES.has(slug) || seen.has(slug)) continue
    seen.add(slug)
    cleaned.push(slug as CreatorMilestoneId)
  }
  return cleaned
}

export function parseActivationFunnelState(raw: unknown): ActivationFunnelState {
  const obj = parseRawObject(raw)
  if (!obj) return {}

  const out: ActivationFunnelState = {}
  const tutorial = obj.welcomeCreateTutorial
  if (typeof tutorial === 'string' && ALLOWED_TUTORIAL.has(tutorial)) {
    out.welcomeCreateTutorial = tutorial as WelcomeCreateTutorialStatus
  }
  if (obj.firstPinCelebrationSeen === true) {
    out.firstPinCelebrationSeen = true
  }
  const milestones = normalizeMilestones(obj.milestones)
  if (milestones.length) out.milestones = milestones
  return out
}

export function mergeActivationFunnelState(
  current: ActivationFunnelState,
  patch: Partial<ActivationFunnelState>,
): ActivationFunnelState {
  const base = parseActivationFunnelState(current)
  const incoming = parseActivationFunnelState(patch)
  const merged: ActivationFunnelState = { ...base }

  if (incoming.welcomeCreateTutorial) {
    merged.welcomeCreateTutorial = incoming.welcomeCreateTutorial
  }
  if (incoming.firstPinCelebrationSeen) {
    merged.firstPinCelebrationSeen = true
  }

  const milestones = [...(merged.milestones ?? [])]
  const seen = new Set(milestones)
  for (const slug of incoming.milestones ?? []) {
    if (!seen.has(slug)) {
      seen.add(slug)
      milestones.push(slug)
    }
  }
  if (milestones.length) merged.milestones = milestones

  return merged
}

export function computeCreatorLevelProgress(
  state: ActivationFunnelState,
  levelMilestones: readonly CreatorMilestoneId[] = CREATOR_LEVEL_1_MILESTONES,
): CreatorLevelProgress {
  const total = levelMilestones.length || 1
  const achieved = new Set(state.milestones ?? [])
  const done = levelMilestones.filter((id) => achieved.has(id)).length
  const percent = Math.min(100, Math.round((done / total) * 100))
  const level = done >= total ? 2 : 1
  return { level, done, total, percent }
}

export function shouldShowWelcomeCreateTutorial(
  _state: ActivationFunnelState,
  _pinsCount: number,
): boolean {
  return false
}

export function shouldCelebrateFirstPin(
  state: ActivationFunnelState,
  pinsBeforePublish: number,
  isStory: boolean,
): boolean {
  if (isStory) return false
  if (pinsBeforePublish > 0) return false
  if (state.firstPinCelebrationSeen) return false
  return true
}
