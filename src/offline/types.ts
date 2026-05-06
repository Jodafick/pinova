export type OfflineActionType = 'CREATE_POST' | 'LIKE_POST' | 'COMMENT_POST' | 'DELETE_POST'

export type OfflineActionStatus = 'pending' | 'synced' | 'failed'

export type OfflineAction = {
  id: string
  type: OfflineActionType
  payload: Record<string, unknown>
  timestamp: number
  client_id: string
  status: OfflineActionStatus
  attempts: number
  lastError?: string
}

export type CachedPost = {
  id: string
  slug: string
  title: string
  content: string
  likes: number
  updatedAt: number
  synced: boolean
}
