export type ContestSettingsDto = {
  contest_key: string
  start_at: string
  end_at: string
  timezone: string
  max_winners: number
  /** Nombre de lignes classement (meilleur pin / créateur) affichées côté live. */
  leaderboard_display_pins: number
  refresh_interval: number
  now: string
}

export type ContestPinRow = {
  pin_id: number
  pin_slug: string
  pin_title: string
  pin_image_url?: string
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
  /** ❤️+👁+↗+📌+💬 (cumul agrégé, plus lisible que le bruit événements bruts). */
  engagement_total?: number
}

/** Position du viewer connecté (hors ou dans le top affiché). */
export type ContestViewerDto = {
  ranked: boolean
  rank: number | null
  in_displayed_top: boolean
  pin: ContestPinRow | null
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
