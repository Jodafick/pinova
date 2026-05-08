export type ContestSettingsDto = {
  contest_key: string
  start_at: string
  end_at: string
  timezone: string
  max_winners: number
  refresh_interval: number
  now: string
}

export type ContestPinRow = {
  pin_id: number
  pin_slug: string
  pin_title: string
  creator_id: number
  creator_username: string
  rank: number
  previous_rank: number
  score: number
  likes?: number
  views?: number
  shares?: number
  saves?: number
  comments?: number
}

export type ContestCreatorRow = {
  creator_id: number
  creator_username: string
  rank: number
  previous_rank: number
  score: number
}

export type ContestLeaderboardEvent = {
  sequence: number
  event_type: string
  entity_type: 'pin' | 'creator'
  entity_id: number
  payload: Record<string, unknown>
  created_at: string
}
