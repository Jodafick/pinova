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
import { buildContestSelfRankCue, type ContestSelfRankCue } from './contestRankCue'
import { useAuth } from './useAuth'
import { API_BASE_URL } from '../config/env'
import { useI18n } from '../i18n'
import type { ContestFotoRow, ContestSettingsDto, ContestViewerDto } from '../types/contest'

const DEFAULT_LEADERBOARD_PINS_CAP = 10

function leaderboardFotosCap(): number {
  const raw = contestState.settings?.leaderboard_display_pins
  if (typeof raw === 'number' && Number.isFinite(raw)) {
    return Math.max(1, Math.min(Math.floor(raw), 500))
  }
  return DEFAULT_LEADERBOARD_PINS_CAP
}

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
  topPins: ContestFotoRow[]
  viewer: ContestViewerDto | null
  /** Bannière concours réservée au créateur dont le foto bouge au classement affiché. */
  selfRankCue: ContestSelfRankCue | null
  lastSequence: number
  reconnectAttempts: number
}

const contestState = reactive<ContestLiveState>({
  /** True au démarrage : évite un premier rendu « concours chargé » vide (hero + 0 foto) avant le mount. */
  loading: true,
  connected: false,
  usingPollingFallback: false,
  error: '',
  settings: null,
  topPins: [],
  viewer: null,
  selfRankCue: null,
  lastSequence: 0,
  reconnectAttempts: 0,
})

let ws: WebSocket | null = null
let wsReconnectTimer: ReturnType<typeof setTimeout> | null = null
let pollTimer: ReturnType<typeof setInterval> | null = null
let countdownTimer: ReturnType<typeof setInterval> | null = null
/** Anti-spam bannière (le serveur notif déjà sous contrôle). */
let lastSelfContestCueAt = 0
const CLIENT_CONTEST_CUE_GAP_MS = 52000
let selfCueDismissTimer: ReturnType<typeof setTimeout> | null = null

/** Polling / WebSocket uniquement lorsque la page concours live est visible (inclut prise en charge du KeepAlive : onDeactivated stoppe le transport). */
let contestLiveTransportActive = false

function startContestLiveTransport() {
  if (contestLiveTransportActive) return
  contestLiveTransportActive = true
  void initContestLive()
}

function stopContestLiveTransport() {
  if (!contestLiveTransportActive) return
  contestLiveTransportActive = false
  teardownContestLive()
}

function scheduleContestSelfCueDismiss() {
  if (selfCueDismissTimer) clearTimeout(selfCueDismissTimer)
  selfCueDismissTimer = setTimeout(() => {
    contestState.selfRankCue = null
    selfCueDismissTimer = null
  }, 6500)
}
const wsUrl = `${API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '')}/api/contest/leaderboard/events/ws`
const tabChannel =
  typeof window !== 'undefined' && 'BroadcastChannel' in window
    ? new BroadcastChannel('fotoce-contest-live')
    : null

/** Mis à jour chaque seconde pour que `contestRemainingMs` et le template se rafraîchissent (Date.now seul n'est pas réactif). */
const contestClockTick = ref(0)

const contestRemainingMs = computed(() => {
  contestClockTick.value
  if (!contestState.settings) return 0
  return Math.max(0, new Date(contestState.settings.end_at).getTime() - Date.now())
})

/** Aligné backend : au plus un foto par créateur (meilleur score), rangs réaffichés 1…n */
function dedupeBestPinPerCreator(rows: ContestFotoRow[]): ContestFotoRow[] {
  const best = new Map<number, ContestFotoRow>()
  for (const row of rows) {
    const prev = best.get(row.creator_id)
    if (
      !prev ||
      row.score > prev.score ||
      (row.score === prev.score && row.foto_id < prev.foto_id)
    ) {
      best.set(row.creator_id, row)
    }
  }
  return Array.from(best.values())
    .sort((a, b) => b.score - a.score || a.foto_id - b.foto_id)
    .map((r, i) => ({ ...r, rank: i + 1 }))
}

function tryContestSelfRankCueFromWs(event: ContestEvent, payload: Record<string, unknown>, viewerUid: number | null) {
  if (event.event_type !== 'pin_rank_updated') return
  if (viewerUid == null || viewerUid !== Number(payload.creator_id || 0)) return
  if (payload.display_rank == null) return
  const nextDisplay = Number(payload.display_rank)
  if (!(nextDisplay >= 1)) return
  const rawPrev = payload.previous_display_rank
  const prevDisplay =
    rawPrev === undefined || rawPrev === null || rawPrev === '' ? null : Number(rawPrev)
  if (!(prevDisplay === null || prevDisplay >= 1)) return
  if (prevDisplay === nextDisplay) return
  const now = Date.now()
  if (now - lastSelfContestCueAt < CLIENT_CONTEST_CUE_GAP_MS) return
  const pinTitle = String(payload.pin_title || 'Foto')
  const cue = buildContestSelfRankCue(t, { prevDisplay, nextDisplay, pinTitle })
  if (!cue) return
  lastSelfContestCueAt = now
  contestState.selfRankCue = cue
  scheduleContestSelfCueDismiss()
}

function upsertPinFromEvent(payload: Record<string, unknown>) {
  const fotoId = Number(payload.foto_id || payload.entity_id || 0)
  if (!fotoId) return
  const index = contestState.topPins.findIndex((row) => row.foto_id === fotoId)
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
      foto_id: fotoId,
      foto_slug: String(payload.foto_slug || ''),
      pin_title: String(payload.pin_title || 'Foto'),
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
  contestState.topPins = dedupeBestPinPerCreator(contestState.topPins).slice(0, leaderboardFotosCap())
}

function pushEvent(event: ContestEvent) {
  if (!contestLiveTransportActive) return
  contestState.lastSequence = Math.max(contestState.lastSequence, event.sequence || 0)
  const payload = (event.payload || {}) as Record<string, unknown>
  tryContestSelfRankCueFromWs(event, payload, contestLiveViewerUid)
  if (event.entity_type === 'foto' || event.event_type.includes('foto_')) {
    upsertPinFromEvent(payload)
  }
  tabChannel?.postMessage({ type: 'contest-foto-event', event })
}

async function fetchCurrentContest() {
  const { data } = await api.get<ContestSettingsDto>('contest/current')
  contestState.settings = {
    ...data,
    leaderboard_display_pins: data.leaderboard_display_pins ?? DEFAULT_LEADERBOARD_PINS_CAP,
    max_winners: data.max_winners ?? 0,
  }
}

async function fetchBoardsSnapshot() {
  type PinsPayload = {
    contest_key: string
    results: ContestFotoRow[]
    viewer?: ContestViewerDto | null
  }
  const pinsResp = await api.get<PinsPayload>('contest/leaderboard/pins', {
    params: { limit: leaderboardFotosCap() },
  })
  contestState.topPins = dedupeBestPinPerCreator(pinsResp.data.results || []).slice(0, leaderboardFotosCap())
  contestState.viewer = pinsResp.data.viewer ?? null
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
  if (!contestLiveTransportActive) return
  if (wsReconnectTimer) clearTimeout(wsReconnectTimer)
  const delay = Math.min(20_000, 1_000 * (contestState.reconnectAttempts + 1))
  wsReconnectTimer = setTimeout(() => {
    wsReconnectTimer = null
    connectWebSocket()
  }, delay)
}

function connectWebSocket() {
  if (typeof window === 'undefined' || !contestLiveTransportActive) return
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
      if (contestLiveTransportActive) scheduleWsReconnect()
    }
  } catch {
    contestState.connected = false
    contestState.usingPollingFallback = true
  }
}

function startPollingFallback() {
  if (!contestLiveTransportActive || pollTimer) return
  pollTimer = setInterval(() => {
    if (!contestLiveTransportActive) return
    void fetchEventDeltas().catch(() => undefined)
    void fetchBoardsSnapshot().catch(() => undefined)
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
        contestClockTick.value += 1
        if (!contestState.settings) return
        const ms = Math.max(
          0,
          new Date(contestState.settings.end_at).getTime() - Date.now(),
        )
        if (ms <= 0) {
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
  contestState.selfRankCue = null
  if (selfCueDismissTimer) {
    clearTimeout(selfCueDismissTimer)
    selfCueDismissTimer = null
  }
  if (wsReconnectTimer) {
    clearTimeout(wsReconnectTimer)
    wsReconnectTimer = null
  }
  if (countdownTimer) {
    clearInterval(countdownTimer)
    countdownTimer = null
  }
}

/** UID du viewer connecté (mis à jour par `useContestLive()`). */
let contestLiveViewerUid: number | null = null

export function clearContestRankCue() {
  contestState.selfRankCue = null
  if (selfCueDismissTimer) {
    clearTimeout(selfCueDismissTimer)
    selfCueDismissTimer = null
  }
}

tabChannel?.addEventListener('message', (event: MessageEvent) => {
  if (!contestLiveTransportActive) return
  const payload = event.data || {}
  if (payload?.type === 'contest-foto-event' && payload.event) {
    const evt = payload.event as ContestEvent
    if (evt.sequence > contestState.lastSequence) {
      pushEvent(evt)
    }
  }
})

export function useContestLive() {
  const { currentUser } = useAuth()
  watchEffect(() => {
    contestLiveViewerUid = currentUser.value?.id ?? null
  })

  onMounted(() => {
    startContestLiveTransport()
  })

  /** KeepAlive : premier affichage = `onMounted` puis `onActivated` — le second est ignoré (transport déjà actif). À la navigation : stop ici puis restart au retour. */
  onActivated(() => {
    startContestLiveTransport()
  })

  onDeactivated(() => {
    stopContestLiveTransport()
  })

  onUnmounted(() => {
    stopContestLiveTransport()
  })

  return {
    contestState: readonly(contestState),
    contestRemainingMs,
    dismissContestRankCue: clearContestRankCue,
    refreshContestNow: async () => {
      await fetchCurrentContest()
      await fetchBoardsSnapshot()
      await fetchEventDeltas()
    },
  }
}
