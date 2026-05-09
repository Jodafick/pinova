export type ReferralContestMetaDto = {
  contest_key: string
  contest_id: number
  start_at: string
  end_at: string
  timezone?: string
  now?: string
  refresh_interval?: number
}

export type ReferralLeaderboardRowDto = {
  rank: number
  referrer_id: number
  username: string
  total_score: number
  previous_rank?: number | null
}

export type ReferralViewerDto = {
  ranked: boolean
  rank: number | null
  in_displayed_top: boolean
  row: ReferralLeaderboardRowDto | null
}

export type ReferralLeaderboardHttpDto = {
  contest_key: string | null
  contest_id?: number
  results: ReferralLeaderboardRowDto[]
  viewer: ReferralViewerDto | null
  refresh_interval?: number
}

export type ReferralMeDto = {
  my_code: string
  link_web: string
  link_deep: string
  link_universal: string
  received: { referrer_username: string; status: string } | null
}

export type ReferralLeaderboardEventDto = {
  sequence: number
  event_type: string
  entity_id: number
  payload: Record<string, unknown>
  created_at?: string
}

export type ReferralRefereeRowDto = {
  id: number
  referee_username: string
  status: string
  source: string
  created_at: string | null
  activated_at: string | null
  email_verified_at: string | null
  rewards_granted_at: string | null
  /** Points crédités pour le bloc signup/finalization quand récompense accordée */
  reward_points_credited?: number
  /** Points du même bloc encore soumis aux règles du concours (filleul actif, récompense non créditée) */
  reward_points_pending?: number
}
