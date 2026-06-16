/** Signaux d’engagement pour proposer notifications / PWA au bon moment (après une action à forte valeur). */
export type EngagementMoment =
  | 'pin_published'
  | 'foto_saved'
  | 'user_followed'
  | 'feed_engaged'

type Listener = (moment: EngagementMoment) => void

const listeners = new Set<Listener>()

export function recordEngagementMoment(moment: EngagementMoment): void {
  for (const listener of listeners) {
    try {
      listener(moment)
    } catch {
      /* ignore */
    }
  }
}

export function onEngagementMoment(listener: Listener): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}
