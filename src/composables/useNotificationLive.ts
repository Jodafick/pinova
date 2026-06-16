import { onMounted, onUnmounted, ref, watch } from 'vue'

import api from '../api/index'
import { useAuth } from './useAuth'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../config/env'
import { pushToast } from './useToast'
import { navigateWebNotificationDeepLink } from '../utils/notificationDeepLink'
import {
  bumpUnreadCountOptimistic,
  emitNotificationLive,
  type NotificationLivePayload,
} from '../lib/notificationRefresh'
import { useRouter } from 'vue-router'
import { readAccessToken as readStoredAccessToken } from '../utils/authStorage'

const WS_BASE = `${API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '')}/api/notifications/ws`
const WS_AUTH_SUBPROTOCOL_PREFIX = 'fotoce.bearer.'
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_RECONNECT_DELAY_MS = 60_000
const IN_APP_TOAST_BATCH_MS = 900
const SESSION_CURSOR_KEY = 'fotoce_notif_live_cursor'
const SESSION_TOAST_SEEN_KEY = 'fotoce_notif_toast_seen'

function readAccessToken(): string {
  return readStoredAccessToken() || ''
}

function wsReconnectDelayMs(attempt: number): number {
  const base = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** attempt)
  return base + Math.floor(Math.random() * 1_000)
}

function readSessionCursor(): number {
  if (typeof sessionStorage === 'undefined') return 0
  const n = parseInt(sessionStorage.getItem(SESSION_CURSOR_KEY) || '0', 10)
  return Number.isFinite(n) && n >= 0 ? n : 0
}

function writeSessionCursor(id: number): void {
  if (typeof sessionStorage === 'undefined') return
  sessionStorage.setItem(SESSION_CURSOR_KEY, String(Math.max(0, id)))
}

function readToastSeenSet(): Set<number> {
  if (typeof sessionStorage === 'undefined') return new Set()
  try {
    const raw = sessionStorage.getItem(SESSION_TOAST_SEEN_KEY)
    const arr = raw ? (JSON.parse(raw) as unknown) : []
    if (!Array.isArray(arr)) return new Set()
    return new Set(arr.filter((x) => typeof x === 'number' && x > 0))
  } catch {
    return new Set()
  }
}

function markToastSeen(id: number): void {
  if (typeof sessionStorage === 'undefined') return
  const set = readToastSeenSet()
  set.add(id)
  const trimmed = [...set].slice(-200)
  sessionStorage.setItem(SESSION_TOAST_SEEN_KEY, JSON.stringify(trimmed))
}

function shouldShowInAppToast(payload: NotificationLivePayload): boolean {
  if (payload.is_read) return false
  if (payload.in_app_toast === false) return false
  if (payload.in_app_toast === true) return true
  const kind = String(payload.metadata?.kind || '').toLowerCase()
  if (kind === 'contest_display_rank_change') return false
  return true
}

/**
 * Transport notifications utilisateur : WebSocket Channels + polling HTTP + badge en-tête.
 * Monté une fois dans App.vue (session authentifiée).
 */
export function useNotificationLive() {
  const { isAuthenticated } = useAuth()
  const { t } = useI18n()
  const router = useRouter()

  const connected = ref(false)
  const usingPollingFallback = ref(false)

  let ws: WebSocket | null = null
  let pollTimer: ReturnType<typeof setInterval> | null = null
  let reconnectTimer: ReturnType<typeof setTimeout> | null = null
  let heartbeatTimer: ReturnType<typeof setInterval> | null = null
  let reconnectAttempts = 0
  let lastEventId = 0
  let active = false
  /** Après le premier sync, seuls les nouveaux événements déclenchent un toast. */
  let liveToastsEnabled = false
  let pendingToastBatch: NotificationLivePayload[] = []
  let toastBatchTimer: ReturnType<typeof setTimeout> | null = null

  const flushToastBatch = () => {
    toastBatchTimer = null
    const batch = pendingToastBatch.splice(0)
    if (!batch.length) return

    const openOne = (payload: NotificationLivePayload) => {
      if (readToastSeenSet().has(payload.id)) return
      markToastSeen(payload.id)
      const title = (payload.title || '').trim()
      const message = (payload.message || '').trim()
      pushToast({
        message: title || t('header.notifications'),
        description: message || undefined,
        kind: 'info',
        surface: 'notification',
        dedupKey: `notif-${payload.id}`,
        duration: 8500,
        actionLabel: t('notifications.live.view'),
        onAction: () => {
          navigateWebNotificationDeepLink(
            router,
            {
              metadata: payload.metadata ?? null,
              foto_slug: payload.foto_slug ?? null,
              foto_id: payload.foto_id ?? null,
              comment_id: payload.comment_id ?? null,
              action_url: payload.action_url ?? null,
              notification_type: payload.notification_type ?? null,
            },
            'header',
          )
        },
      })
    }

    if (batch.length === 1) {
      openOne(batch[0]!)
      return
    }

    const latest = batch[batch.length - 1]!
    for (const row of batch) markToastSeen(row.id)
    pushToast({
      message: t('notifications.live.batchTitle', { count: batch.length }),
      description: t('notifications.live.batchDesc'),
      kind: 'info',
      surface: 'notification',
      dedupKey: `notif-batch-${latest.id}`,
      duration: 6500,
      actionLabel: t('notifications.live.view'),
      onAction: () => {
        void router.push({ name: 'notifications' })
      },
    })
  }

  const queueInAppToast = (payload: NotificationLivePayload) => {
    if (!liveToastsEnabled) return
    if (!shouldShowInAppToast(payload)) return
    if (readToastSeenSet().has(payload.id)) return
    pendingToastBatch.push(payload)
    if (toastBatchTimer) clearTimeout(toastBatchTimer)
    toastBatchTimer = setTimeout(flushToastBatch, IN_APP_TOAST_BATCH_MS)
  }

  const ingest = (payload: NotificationLivePayload, opts?: { allowToast?: boolean }) => {
    if (!payload?.id || payload.id <= lastEventId) return
    lastEventId = Math.max(lastEventId, payload.id)
    writeSessionCursor(lastEventId)
    emitNotificationLive(payload)
    if (!payload.is_read) {
      bumpUnreadCountOptimistic(1)
    }
    if (opts?.allowToast !== false) {
      queueInAppToast(payload)
    }
  }

  const fetchEventDeltas = async (opts?: { allowToast?: boolean }) => {
    if (!isAuthenticated.value) return
    const { data } = await api.get<{ results: NotificationLivePayload[]; last_id?: number }>(
      'notifications/events/',
      { params: { since_id: lastEventId, limit: 120 } },
    )
    for (const row of data.results || []) {
      ingest(row, opts)
    }
    if (typeof data.last_id === 'number' && data.last_id > lastEventId) {
      lastEventId = data.last_id
      writeSessionCursor(lastEventId)
    }
  }

  const stopHeartbeat = () => {
    if (!heartbeatTimer) return
    clearInterval(heartbeatTimer)
    heartbeatTimer = null
  }

  const startHeartbeat = () => {
    stopHeartbeat()
    heartbeatTimer = setInterval(() => {
      if (ws?.readyState === WebSocket.OPEN) ws.send('ping')
    }, HEARTBEAT_INTERVAL_MS)
  }

  const scheduleReconnect = () => {
    if (!active) return
    if (reconnectTimer) clearTimeout(reconnectTimer)
    const delay = wsReconnectDelayMs(reconnectAttempts)
    reconnectTimer = setTimeout(() => {
      reconnectTimer = null
      connectWebSocket()
    }, delay)
  }

  const connectWebSocket = () => {
    if (!active || typeof window === 'undefined') return
    const token = readAccessToken()
    if (!token) return
    try {
      ws?.close()
      ws = new WebSocket(WS_BASE, [`${WS_AUTH_SUBPROTOCOL_PREFIX}${token}`])
      ws.onopen = () => {
        connected.value = true
        usingPollingFallback.value = false
        reconnectAttempts = 0
        startHeartbeat()
      }
      ws.onmessage = (ev) => {
        const raw = String(ev.data || '')
        if (raw === 'ping') {
          ws?.send('pong')
          return
        }
        try {
          const msg = JSON.parse(raw) as { event?: NotificationLivePayload }
          if (msg.event) ingest(msg.event)
        } catch {
          /* noop */
        }
      }
      ws.onerror = () => {
        connected.value = false
      }
      ws.onclose = () => {
        connected.value = false
        usingPollingFallback.value = true
        stopHeartbeat()
        reconnectAttempts += 1
        if (active) scheduleReconnect()
      }
    } catch {
      connected.value = false
      usingPollingFallback.value = true
    }
  }

  const startPolling = () => {
    if (pollTimer) return
    pollTimer = setInterval(() => {
      if (!active || !isAuthenticated.value) return
      void fetchEventDeltas().catch(() => undefined)
    }, 45_000)
  }

  const stopPolling = () => {
    if (!pollTimer) return
    clearInterval(pollTimer)
    pollTimer = null
  }

  const teardown = () => {
    active = false
    liveToastsEnabled = false
    pendingToastBatch = []
    if (toastBatchTimer) {
      clearTimeout(toastBatchTimer)
      toastBatchTimer = null
    }
    stopHeartbeat()
    ws?.close()
    ws = null
    stopPolling()
    if (reconnectTimer) {
      clearTimeout(reconnectTimer)
      reconnectTimer = null
    }
    connected.value = false
  }

  const bootstrap = async () => {
    if (!isAuthenticated.value) return
    active = true
    liveToastsEnabled = false
    lastEventId = readSessionCursor()
    try {
      await fetchEventDeltas({ allowToast: false })
    } catch {
      usingPollingFallback.value = true
    }
    liveToastsEnabled = true
    connectWebSocket()
    startPolling()
  }

  watch(
    isAuthenticated,
    (auth) => {
      teardown()
      if (auth) void bootstrap()
    },
    { immediate: true },
  )

  onMounted(() => {
    if (isAuthenticated.value && !active) void bootstrap()
  })

  onUnmounted(() => {
    teardown()
  })

  return {
    connected,
    usingPollingFallback,
    refreshNotificationEvents: fetchEventDeltas,
  }
}
