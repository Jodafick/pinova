import {
  computed,
  onActivated,
  onDeactivated,
  onMounted,
  onUnmounted,
  reactive,
  readonly,
  ref,
  watchEffect,
} from 'vue'

import api from '../api/index'
import { useAuth } from './useAuth'
import { API_BASE_URL } from '../config/env'
import { useI18n } from '../i18n'
import type {
  ReferralContestMetaDto,
  ReferralLeaderboardEventDto,
  ReferralLeaderboardHttpDto,
  ReferralLeaderboardRowDto,
  ReferralViewerDto,
} from '../types/referral'

const { t } = useI18n()

type ReferralLiveState = {
  loading: boolean
  connected: boolean
  usingPollingFallback: boolean
  offline: boolean
  error: string
  contest: ReferralContestMetaDto | null
  rows: ReferralLeaderboardRowDto[]
  viewer: ReferralViewerDto | null
  contestKey: string | null
  lastSequence: number
  reconnectAttempts: number
  /** Dernière évolution de rang du viewer (animation / feedback). */
  lastSelfDelta: { prev: number | null; next: number; score: number } | null
}

const referralState = reactive<ReferralLiveState>({
  loading: true,
  connected: false,
  usingPollingFallback: false,
  offline: typeof navigator !== 'undefined' ? !navigator.onLine : false,
  error: '',
  contest: null,
  rows: [],
  viewer: null,
  contestKey: null,
  lastSequence: 0,
  reconnectAttempts: 0,
  lastSelfDelta: null,
})

let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let selfDeltaTimer: ReturnType<typeof setTimeout> | null = null
let referralLiveTransportActive = false

const wsUrl = `${API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '')}/api/referrals/leaderboard/ws`

const referralClockTick = ref(0)

const referralRemainingMs = computed(() => {
  referralClockTick.value
  if (!referralState.contest?.end_at) return 0
  return Math.max(0, new Date(referralState.contest.end_at).getTime() - Date.now())
})

function scheduleSelfDeltaClear() {
  if (selfDeltaTimer) clearTimeout(selfDeltaTimer)
  selfDeltaTimer = setTimeout(() => {
    referralState.lastSelfDelta = null
    selfDeltaTimer = null
  }, 6000)
}

function sortRows(rows: ReferralLeaderboardRowDto[]): ReferralLeaderboardRowDto[] {
  return [...rows]
    .sort((a, b) => b.total_score - a.total_score || a.referrer_id - b.referrer_id)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

const DISPLAY_LIMIT = 50

function updateViewerFromRows() {
  const uid = referralLiveViewerUid
  if (uid == null) {
    return
  }
  const selfRow = referralState.rows.find((r) => r.referrer_id === uid)
  if (!selfRow) {
    referralState.viewer = { ranked: false, rank: null, in_displayed_top: false, row: null }
    return
  }
  referralState.viewer = {
    ranked: true,
    rank: selfRow.rank,
    in_displayed_top: selfRow.rank <= DISPLAY_LIMIT,
    row: { ...selfRow },
  }
}

function applyRankEvent(event: ReferralLeaderboardEventDto) {
  if (event.event_type !== 'referrer_rank_updated') return
  const p = event.payload || {}
  const referrerId = Number(p.referrer_id ?? event.entity_id ?? 0)
  if (!referrerId) return
  const username = String(p.username || '')
  const totalScore = Number(p.total_score ?? 0)
  const previousRank = p.previous_rank != null && p.previous_rank !== '' ? Number(p.previous_rank) : null

  const idx = referralState.rows.findIndex((r) => r.referrer_id === referrerId)
  const row: ReferralLeaderboardRowDto = {
    rank: 0,
    referrer_id: referrerId,
    username: idx >= 0 ? referralState.rows[idx]!.username : username || `user_${referrerId}`,
    total_score: totalScore,
    previous_rank: previousRank,
  }
  if (idx >= 0) {
    referralState.rows[idx] = { ...referralState.rows[idx]!, ...row }
  } else {
    referralState.rows.push(row)
  }
  referralState.rows = sortRows(referralState.rows)

  const uid = referralLiveViewerUid
  if (uid != null && uid === referrerId) {
    const nextRank = referralState.rows.find((r) => r.referrer_id === referrerId)?.rank ?? 0
    const prevDisplay =
      previousRank != null && previousRank > 0 ? previousRank : referralState.viewer?.rank ?? null
    if (prevDisplay != null && prevDisplay !== nextRank) {
      referralState.lastSelfDelta = { prev: prevDisplay, next: nextRank, score: totalScore }
      scheduleSelfDeltaClear()
    }
  }
  if (referralLiveViewerUid != null) {
    const selfInSlice = referralState.rows.some((r) => r.referrer_id === referralLiveViewerUid)
    if (selfInSlice) {
      updateViewerFromRows()
    } else if (
      referralLiveViewerUid === referrerId &&
      referralState.viewer?.ranked &&
      referralState.viewer.row
    ) {
      referralState.viewer = {
        ...referralState.viewer,
        rank: Number(p.rank ?? referralState.viewer.rank ?? 0) || referralState.viewer.rank,
        row: {
          ...referralState.viewer.row,
          total_score: totalScore,
          rank: Number(p.rank ?? referralState.viewer.row.rank),
          previous_rank: previousRank ?? referralState.viewer.row.previous_rank,
        },
      }
    }
  }
}

function pushEvent(event: ReferralLeaderboardEventDto) {
  if (!referralLiveTransportActive) return
  referralState.lastSequence = Math.max(referralState.lastSequence, event.sequence || 0)
  applyRankEvent(event)
}

async function fetchContestMeta() {
  try {
    const { data } = await api.get<ReferralContestMetaDto>('referrals/contest/current')
    referralState.contest = data
    referralState.contestKey = data.contest_key
  } catch {
    referralState.contest = null
    referralState.contestKey = null
  }
}

async function fetchLeaderboardSnapshot() {
  const { data } = await api.get<ReferralLeaderboardHttpDto>('referrals/leaderboard/', {
    params: { limit: DISPLAY_LIMIT },
  })
  referralState.contestKey = data.contest_key ?? referralState.contestKey
  referralState.rows = sortRows(data.results || [])
  referralState.viewer = data.viewer ?? null
}

async function fetchEventDeltas() {
  const { data } = await api.get<{ contest_key: string | null; results: ReferralLeaderboardEventDto[] }>(
    'referrals/leaderboard/events/',
    {
      params: { since: referralState.lastSequence, limit: 300 },
    },
  )
  if (data.contest_key) referralState.contestKey = data.contest_key
  for (const event of data.results || []) {
    pushEvent(event)
  }
}

function scheduleWsReconnect() {
  if (!referralLiveTransportActive) return
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
  const delay = Math.min(20_000, 1_000 * (referralState.reconnectAttempts + 1))
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectWebSocket()
  }, delay)
}

function connectWebSocket() {
  if (typeof window === 'undefined' || !referralLiveTransportActive) return
  try {
    ws?.close()
    ws = new WebSocket(`${wsUrl}?since=${referralState.lastSequence}`)
    ws.onopen = () => {
      referralState.connected = true
      referralState.usingPollingFallback = false
      referralState.reconnectAttempts = 0
    }
    ws.onmessage = (messageEvent) => {
      const raw = JSON.parse(String(messageEvent.data || '{}')) as {
        event?: ReferralLeaderboardEventDto
        events?: ReferralLeaderboardEventDto[]
      }
      if (raw.event) {
        pushEvent(raw.event)
      } else if (Array.isArray(raw.events)) {
        for (const evt of raw.events) pushEvent(evt)
      }
    }
    ws.onerror = () => {
      referralState.connected = false
    }
    ws.onclose = () => {
      referralState.connected = false
      referralState.reconnectAttempts += 1
      referralState.usingPollingFallback = true
      if (referralLiveTransportActive) scheduleWsReconnect()
    }
  } catch {
    referralState.connected = false
    referralState.usingPollingFallback = true
  }
}

function startPollingFallback() {
  if (!referralLiveTransportActive || pollTimer) return
  pollTimer = setInterval(() => {
    if (!referralLiveTransportActive) return
    void fetchEventDeltas().catch(() => undefined)
    void fetchLeaderboardSnapshot().catch(() => undefined)
  }, 45_000)
}

function stopPollingFallback() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

function onOnline() {
  referralState.offline = false
  if (referralLiveTransportActive) {
    connectWebSocket()
    void fetchLeaderboardSnapshot().catch(() => undefined)
  }
}

function onOffline() {
  referralState.offline = true
  referralState.connected = false
  referralState.usingPollingFallback = true
}

async function initReferralLive() {
  referralState.loading = true
  referralState.error = ''
  try {
    await fetchContestMeta()
    await fetchLeaderboardSnapshot()
    await fetchEventDeltas()
    connectWebSocket()
    startPollingFallback()
    if (!countdownTimer) {
      countdownTimer = setInterval(() => {
        referralClockTick.value += 1
        if (!referralState.contest?.end_at) return
        const ms = Math.max(0, new Date(referralState.contest.end_at).getTime() - Date.now())
        if (ms <= 0) {
          void fetchContestMeta().catch(() => undefined)
        }
      }, 1_000)
    }
  } catch {
    referralState.error = t('referral.error.load')
    referralState.usingPollingFallback = true
  } finally {
    referralState.loading = false
  }
}

function teardownReferralLive() {
  ws?.close()
  ws = null
  stopPollingFallback()
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
  if (selfDeltaTimer) {
    clearTimeout(selfDeltaTimer)
    selfDeltaTimer = null
  }
}

function startReferralLiveTransport() {
  if (referralLiveTransportActive) return
  referralLiveTransportActive = true
  if (typeof window !== 'undefined') {
    window.addEventListener('online', onOnline)
    window.addEventListener('offline', onOffline)
  }
  void initReferralLive()
}

function stopReferralLiveTransport() {
  if (!referralLiveTransportActive) return
  referralLiveTransportActive = false
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', onOnline)
    window.removeEventListener('offline', onOffline)
  }
  teardownReferralLive()
}

let referralLiveViewerUid: number | null = null

export function dismissReferralSelfDelta() {
  referralState.lastSelfDelta = null
  if (selfDeltaTimer) {
    clearTimeout(selfDeltaTimer)
    selfDeltaTimer = null
  }
}

export function useReferralLive() {
  const { currentUser } = useAuth()
  watchEffect(() => {
    referralLiveViewerUid = currentUser.value?.id ?? null
  })

  onMounted(() => {
    startReferralLiveTransport()
  })
  onActivated(() => {
    startReferralLiveTransport()
  })
  onDeactivated(() => {
    stopReferralLiveTransport()
  })
  onUnmounted(() => {
    stopReferralLiveTransport()
  })

  return {
    referralState: readonly(referralState),
    referralRemainingMs,
    dismissReferralSelfDelta,
    refreshReferralNow: async () => {
      await fetchContestMeta()
      await fetchLeaderboardSnapshot()
      await fetchEventDeltas()
    },
  }
}
