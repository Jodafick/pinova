export const PENDING_INTENT_STORAGE_KEY = 'pinova-pending-intent'
export const PENDING_INTENT_TTL_MS = 30 * 60 * 1000

export type PendingIntentType = 'like' | 'save' | 'follow' | 'comment' | 'translate' | 'contest'

export type PendingIntentScope = 'pin' | 'comment'

export interface PendingIntentMetadata {
  scope?: PendingIntentScope
  pinSlug?: string
  text?: string
  parentId?: number | null
  gif?: string | null
  target?: 'description' | 'comment'
  lang?: string
  commentId?: number
  returnPath?: string
}

export interface PendingIntent {
  id: string
  type: PendingIntentType
  resourceId: string
  metadata?: PendingIntentMetadata
  createdAt: number
}

export type GuestAuthPayload = {
  resourceId: string
  metadata?: PendingIntentMetadata
}

export function isReplayableGuestIntent(intent: string): intent is PendingIntentType {
  return (
    intent === 'like' ||
    intent === 'save' ||
    intent === 'follow' ||
    intent === 'comment' ||
    intent === 'translate' ||
    intent === 'contest'
  )
}

export function createPendingIntentId(): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return crypto.randomUUID()
  }
  return `pi-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`
}
