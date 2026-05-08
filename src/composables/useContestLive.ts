import { computed, onMounted, onUnmounted, reactive, readonly } from 'vue'

import api from '../api'
import { API_BASE_URL } from '../env'
import { useI18n } from '../i18n'
import type { ContestPinRow, ContestSettingsDto } from '../types/contest'

const { t } = useI18n()

type ContestEvent = {
  sequence: number
  event_type: string
  entity_type: string
  payload: Record<string, unknown>
}

type ContestLiveState = {
  loading: boolean
  connected: boolean
  usingPollingFallback: boolean
  error: string
  settings: ContestSettingsDto | null
  topPins: ContestPinRow[]
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

/** Aligné backend : au plus un pin par créateur (meilleur score), rangs réaffichés 1…n */
function dedupeBestPinPerCreator(rows: ContestPinRow[]): ContestPinRow[] {
  const best = new Map<number, ContestPinRow>()
  for (const row of rows) {
    const prev = best.get(row.creator_id)
    if (
      !prev ||
      row.score > prev.score ||
      (row.score === prev.score && row.pin_id < prev.pin_id)
    ) {
      best.set(row.creator_id, row)
    }
  }
  return Array.from(best.values())
    .sort((a, b) => b.score - a.score || a.pin_id - b.pin_id)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function upsertPinFromEvent(payload: Record<string, unknown>) {
  const pinId = Number(payload.pin_id || payload.entity_id || 0)
  if (!pinId) return
  const index = contestState.topPins.findIndex((row) => row.pin_id === pinId)
  const rank = Number(payload.rank || 0)
  const previousRank = Number(payload.previous_rank || 0)
  const score = Number(payload.score || 0)
  const merged =
    index === -1
      ? { likes: 0, views: 0, shares: 0, saves: 0, comments: 0 }
      : contestState.topPins[index]!

  const likes = Number(payload.likes ?? merged.likes ?? 0)
  const views = Number(payload.views ?? merged.views ?? 0)
  const shares = Number(payload.shares ?? merged.shares ?? 0)
  const saves = Number(payload.saves ?? merged.saves ?? 0)
  const comments = Number(payload.comments ?? merged.comments ?? 0)
  const engagement_total =
    payload.engagement_total != null
      ? Number(payload.engagement_total)
      : likes + views + shares + saves + comments

  if (index === -1) {
    contestState.topPins.push({
      pin_id: pinId,
      pin_slug: String(payload.pin_slug || ''),
      pin_title: String(payload.pin_title || 'Pin'),
      pin_image_url: String(payload.pin_image_url || ''),
      creator_id: Number(payload.creator_id || 0),
      creator_username: String(payload.creator_username || 'creator'),
      rank,
      previous_rank: previousRank,
      score,
      likes,
      views,
      shares,
      saves,
      comments,
      engagement_total,
    })
  } else {
    contestState.topPins[index] = {
      ...contestState.topPins[index],
      rank,
      previous_rank: previousRank,
      score,
      pin_image_url: String(payload.pin_image_url || contestState.topPins[index].pin_image_url || ''),
      likes,
      views,
      shares,
      saves,
      comments,
      engagement_total,
    }
  }
  sortPins()
}

function pushEvent(event: ContestEvent) {
  contestState.lastSequence = Math.max(contestState.lastSequence, event.sequence || 0)
  const payload = (event.payload || {}) as Record<string, unknown>
  if (event.entity_type === 'pin' || event.event_type.includes('pin_')) {
    upsertPinFromEvent(payload)
  }
  tabChannel?.postMessage({ type: 'contest-pin-event', event })
}

async function fetchCurrentContest() {
  const { data } = await api.get<ContestSettingsDto>('contest/current')
  contestState.settings = data
}

async function fetchBoardsSnapshot() {
  const pinsResp = await api.get<{ contest_key: string; results: ContestPinRow[] }>('contest/leaderboard/pins', {
    params: { limit: 100 },
  })
  contestState.topPins = dedupeBestPinPerCreator(pinsResp.data.results || [])
}

async function fetchEventDeltas() {
  const { data } = await api.get<{ contest_key: string; results: ContestEvent[] }>(
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
        event?: ContestEvent
        events?: ContestEvent[]
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
  }, 60_000)
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
  } catch {
    contestState.error = t('contest.error.load')
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
  if (payload?.type === 'contest-pin-event' && payload.event) {
    const evt = payload.event as ContestEvent
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
