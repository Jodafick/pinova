/** Au-delà de ce rang affiché, on montre « Non classé » (Unranked) au lieu du numéro. */
export const CONTEST_RANK_CLASSIFIED_MAX = 100

type TFn = (key: string, vars?: Record<string, string | number>) => string

/** Rang effectif d’une ligne du classement affiché (fallback index si `rank` absent). */
export function contestLeaderboardRowRank(row: { rank: number }, index: number): number {
  const r = Number(row.rank)
  if (Number.isFinite(r) && r >= 1) return Math.floor(r)
  return index + 1
}

/** Libellé médaille / liste : numéro ou clé i18n `contest.live.rankUnranked`. */
export function contestLeaderboardRankLabel(row: { rank: number }, index: number, t: TFn): string {
  const n = contestLeaderboardRowRank(row, index)
  if (n > CONTEST_RANK_CLASSIFIED_MAX) return t('contest.live.rankUnranked')
  return String(n)
}

/** Pour textes dynamiques (dock, notifications) à partir d’un rang API. */
export function contestRankDisplayLabel(rank: number | null | undefined, t: TFn): string {
  if (rank == null || !Number.isFinite(Number(rank))) return '—'
  const n = Math.floor(Number(rank))
  if (n < 1) return '—'
  if (n > CONTEST_RANK_CLASSIFIED_MAX) return t('contest.live.rankUnranked')
  return String(n)
}

export function contestRankIsClassed(rank: number | null | undefined): boolean {
  if (rank == null || !Number.isFinite(Number(rank))) return false
  const n = Math.floor(Number(rank))
  return n >= 1 && n <= CONTEST_RANK_CLASSIFIED_MAX
}
