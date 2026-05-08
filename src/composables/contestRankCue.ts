export type ContestSelfRankCueTone = 'up' | 'down' | 'steady'

export type ContestSelfRankCue = {
  title: string
  body: string
  tone: ContestSelfRankCueTone
}

/** Textes courts pour la bannière live (anti-spam côté client en plus du serveur). */
export function buildContestSelfRankCue(
  t: (key: string, values?: Record<string, string | number>) => string,
  params: {
    prevDisplay: number | null
    nextDisplay: number
    pinTitle: string
  },
): ContestSelfRankCue | null {
  const { prevDisplay, nextDisplay, pinTitle } = params
  if (!(nextDisplay > 0) || prevDisplay === nextDisplay) return null

  const prevS = prevDisplay == null ? '—' : String(prevDisplay)

  const prevInPodium = prevDisplay != null && prevDisplay <= 3
  const nextInPodium = nextDisplay <= 3
  const improved = prevDisplay == null || nextDisplay < prevDisplay
  const worse = prevDisplay != null && nextDisplay > prevDisplay

  if (nextDisplay === 1) {
    return {
      tone: improved ? 'up' : 'steady',
      title: t('contest.rankCue.title'),
      body: t('contest.rankCue.podium1', { title: pinTitle }),
    }
  }
  if (nextDisplay === 2) {
    return {
      tone: improved ? 'up' : worse ? 'down' : 'steady',
      title: t('contest.rankCue.title'),
      body: t('contest.rankCue.podium2', { title: pinTitle }),
    }
  }
  if (nextDisplay === 3) {
    return {
      tone: improved ? 'up' : worse ? 'down' : 'steady',
      title: t('contest.rankCue.title'),
      body: t('contest.rankCue.podium3', { title: pinTitle }),
    }
  }

  if (prevInPodium && !nextInPodium) {
    return {
      tone: 'down',
      title: t('contest.rankCue.title'),
      body: t('contest.rankCue.leftPodium', { title: pinTitle, rank: nextDisplay, prev: prevS }),
    }
  }

  if (improved) {
    return {
      tone: 'up',
      title: t('contest.rankCue.title'),
      body: t('contest.rankCue.up', { title: pinTitle, rank: nextDisplay, prev: prevS }),
    }
  }
  if (worse) {
    return {
      tone: 'down',
      title: t('contest.rankCue.title'),
      body: t('contest.rankCue.down', { title: pinTitle, rank: nextDisplay, prev: prevS }),
    }
  }
  return null
}
