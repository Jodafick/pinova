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

const WS_BASE = `${API_BASE_URL.replace(/^http/i, 'ws').replace(/\/$/, '')}/api/notifications/ws`
const WS_AUTH_SUBPROTOCOL_PREFIX = 'pinova.bearer.'
const HEARTBEAT_INTERVAL_MS = 30_000
const MAX_RECONNECT_DELAY_MS = 60_000

function readAccessToken(): string {
  if (typeof window === 'undefined') return ''
  return window.localStorage.getItem('pinova_token') || ''
}

function wsReconnectDelayMs(attempt: number): number {
  const base = Math.min(MAX_RECONNECT_DELAY_MS, 1_000 * 2 ** attempt)
  return base + Math.floor(Math.random() * 1_000)
}

function shouldShowInAppToast(payload: NotificationLivePayload): boolean {
  if (payload.is_read) return false
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

  const ingest = (payload: NotificationLivePayload) => {
    if (!payload?.id || payload.id <= lastEventId) return
    lastEventId = Math.max(lastEventId, payload.id)
    emitNotificationLive(payload)
    if (!payload.is_read) {
      bumpUnreadCountOptimistic(1)
    }
    if (!shouldShowInAppToast(payload)) return
    const title = (payload.title || '').trim()
    const message = (payload.message || '').trim()
    pushToast({
      message: title || t('header.notifications'),
      description: message || undefined,
      kind: 'info',
      dedupKey: `notif-${payload.id}`,
      actionLabel: t('notifications.live.view'),
      onAction: () => {
        navigateWebNotificationDeepLink(
          router,
          {
            metadata: payload.metadata ?? null,
            pin_slug: payload.pin_slug ?? null,
            pin_id: payload.pin_id ?? null,
            comment_id: payload.comment_id ?? null,
            action_url: payload.action_url ?? null,
            notification_type: payload.notification_type ?? null,
          },
          'header',
        )
      },
    })
  }

  const fetchEventDeltas = async () => {
    if (!isAuthenticated.value) return
    const { data } = await api.get<{ results: NotificationLivePayload[]; last_id?: number }>(
      'notifications/events/',
      { params: { since_id: lastEventId, limit: 120 } },
    )
    for (const row of data.results || []) {
      ingest(row)
    }
    if (typeof data.last_id === 'number' && data.last_id > lastEventId) {
      lastEventId = data.last_id
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
    lastEventId = 0
    try {
      await fetchEventDeltas()
    } catch {
      usingPollingFallback.value = true
    }
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
