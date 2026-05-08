import { computed, onMounted, onUnmounted, reactive, readonly } from 'vue'

import api from '../api'
import { API_BASE_URL } from '../env'
import type {
  ContestCreatorRow,
  ContestLeaderboardEvent,
  ContestPinRow,
  ContestSettingsDto,
} from '../types/contest'

type ContestLiveState = {
  loading: boolean
  connected: boolean
  usingPollingFallback: boolean
  error: string
  settings: ContestSettingsDto | null
  topPins: ContestPinRow[]
  topCreators: ContestCreatorRow[]
  liveEvents: ContestLeaderboardEvent[]
  lastSequence: number
  reconnectAttempts: number
}

const contestState = reactive<ContestLiveState>({
  loading: false,
  connected: false,
  usingPollingFallback: false,
  error: '',
  settings: null,
  topPins: [],
  topCreators: [],
  liveEvents: [],
  lastSequence: 0,
  reconnectAttempts: 0,
})

let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
let activeConsumers = 0
const wsUrl = `${API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '')}/api/contest/leaderboard/events/ws`
const tabChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('pinova-contest-live')
    : null

const contestRemainingMs = computed(() => {
  if (!contestState.settings) return 0
  return Math.max(0, new Date(contestState.settings.end_at).getTime() - Date.now())
})

function sortPins() {
  contestState.topPins.sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank
    return b.score - a.score
  })
}

function sortCreators() {
  contestState.topCreators.sort((a, b) => {
    if (a.rank && b.rank) return a.rank - b.rank
    return b.score - a.score
  })
}

function upsertPinFromEvent(payload: Record<string, unknown>) {
  const pinId = Number(payload.pin_id || payload.entity_id || 0)
  if (!pinId) return
  const index = contestState.topPins.findIndex((row) => row.pin_id === pinId)
  const rank = Number(payload.rank || 0)
  const previousRank = Number(payload.previous_rank || 0)
  const score = Number(payload.score || 0)
  if (index === -1) {
    contestState.topPins.push({
      pin_id: pinId,
      pin_slug: String(payload.pin_slug || ''),
      pin_title: String(payload.pin_title || 'Pin'),
      creator_id: Number(payload.creator_id || 0),
      creator_username: String(payload.creator_username || 'creator'),
      rank,
      previous_rank: previousRank,
      score,
    })
  } else {
    contestState.topPins[index] = {
      ...contestState.topPins[index],
      rank,
      previous_rank: previousRank,
      score,
    }
  }
  sortPins()
}

function upsertCreatorFromEvent(payload: Record<string, unknown>) {
  const creatorId = Number(payload.creator_id || payload.entity_id || 0)
  if (!creatorId) return
  const index = contestState.topCreators.findIndex((row) => row.creator_id === creatorId)
  const rank = Number(payload.rank || 0)
  const previousRank = Number(payload.previous_rank || 0)
  const score = Number(payload.score || 0)
  if (index === -1) {
    contestState.topCreators.push({
      creator_id: creatorId,
      creator_username: String(payload.creator_username || `creator-${creatorId}`),
      rank,
      previous_rank: previousRank,
      score,
    })
  } else {
    contestState.topCreators[index] = {
      ...contestState.topCreators[index],
      rank,
      previous_rank: previousRank,
      score,
    }
  }
  sortCreators()
}

function pushEvent(event: ContestLeaderboardEvent) {
  contestState.liveEvents = [...contestState.liveEvents.slice(-99), event]
  contestState.lastSequence = Math.max(contestState.lastSequence, event.sequence || 0)
  const payload = (event.payload || {}) as Record<string, unknown>
  if (event.entity_type === 'pin' || event.event_type.includes('pin_')) {
    upsertPinFromEvent(payload)
  }
  if (event.entity_type === 'creator' || event.event_type.includes('creator_')) {
    upsertCreatorFromEvent(payload)
  }
  tabChannel?.postMessage({ type: 'contest-event', event })
}

async function fetchCurrentContest() {
  const { data } = await api.get<ContestSettingsDto>('contest/current')
  contestState.settings = data
}

async function fetchBoardsSnapshot() {
  const [pinsResp, creatorsResp] = await Promise.all([
    api.get<{ contest_key: string; results: ContestPinRow[] }>('contest/leaderboard/pins', {
      params: { limit: 100 },
    }),
    api.get<{ contest_key: string; results: ContestCreatorRow[] }>('contest/leaderboard/creators', {
      params: { limit: 100 },
    }),
  ])
  contestState.topPins = pinsResp.data.results || []
  contestState.topCreators = creatorsResp.data.results || []
  sortPins()
  sortCreators()
}

async function fetchEventDeltas() {
  const { data } = await api.get<{ contest_key: string; results: ContestLeaderboardEvent[] }>(
    'contest/leaderboard/events',
    {
      params: { since: contestState.lastSequence, limit: 300 },
    },
  )
  for (const event of data.results || []) {
    pushEvent(event)
  }
}

function scheduleWsReconnect() {
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
  const delay = Math.min(20_000, 1_000 * (contestState.reconnectAttempts + 1))
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectWebSocket()
  }, delay)
}

function connectWebSocket() {
  if (typeof window === 'undefined') return
  try {
    ws?.close()
    ws = new WebSocket(`${wsUrl}?since=${contestState.lastSequence}`)
    ws.onopen = () => {
      contestState.connected = true
      contestState.usingPollingFallback = false
      contestState.reconnectAttempts = 0
    }
    ws.onmessage = (messageEvent) => {
      const payload = JSON.parse(String(messageEvent.data || '{}')) as {
        event?: ContestLeaderboardEvent
        events?: ContestLeaderboardEvent[]
      }
      if (payload.event) {
        pushEvent(payload.event)
      } else if (Array.isArray(payload.events)) {
        for (const evt of payload.events) pushEvent(evt)
      }
    }
    ws.onerror = () => {
      contestState.connected = false
    }
    ws.onclose = () => {
      contestState.connected = false
      contestState.reconnectAttempts += 1
      contestState.usingPollingFallback = true
      scheduleWsReconnect()
    }
  } catch {
    contestState.connected = false
    contestState.usingPollingFallback = true
  }
}

function startPollingFallback() {
  if (pollTimer) return
  pollTimer = setInterval(() => {
    void fetchEventDeltas().catch(() => undefined)
  }, Math.max(2_000, Number(contestState.settings?.refresh_interval || 3) * 1_000))
}

function stopPollingFallback() {
  if (!pollTimer) return
  clearInterval(pollTimer)
  pollTimer = null
}

async function initContestLive() {
  contestState.loading = true
  contestState.error = ''
  try {
    await fetchCurrentContest()
    await fetchBoardsSnapshot()
    await fetchEventDeltas()
    connectWebSocket()
    startPollingFallback()
    if (!countdownTimer) {
      countdownTimer = setInterval(() => {
        if (contestRemainingMs.value <= 0) {
          void fetchCurrentContest().catch(() => undefined)
        }
      }, 1_000)
    }
  } catch (err) {
    contestState.error = 'Impossible de charger le concours pour le moment.'
    contestState.usingPollingFallback = true
  } finally {
    contestState.loading = false
  }
}

function teardownContestLive() {
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
}

tabChannel?.addEventListener('message', (event: MessageEvent) => {
  const payload = event.data || {}
  if (payload?.type === 'contest-event' && payload.event) {
    const evt = payload.event as ContestLeaderboardEvent
    if (evt.sequence > contestState.lastSequence) {
      pushEvent(evt)
    }
  }
})

export function useContestLive() {
  onMounted(() => {
    activeConsumers += 1
    if (activeConsumers === 1) {
      void initContestLive()
    }
  })

  onUnmounted(() => {
    activeConsumers = Math.max(0, activeConsumers - 1)
    if (activeConsumers === 0) {
      teardownContestLive()
    }
  })

  return {
    contestState: readonly(contestState),
    contestRemainingMs,
    refreshContestNow: async () => {
      await fetchCurrentContest()
      await fetchBoardsSnapshot()
      await fetchEventDeltas()
    },
  }
}
