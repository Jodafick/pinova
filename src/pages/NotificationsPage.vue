<script setup lang="ts">
import { computed, onActivated, onDeactivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api/index'
import {
  navigateWebNotificationDeepLink,
  type WebNotificationNavInput,
} from '../utils/notificationDeepLink'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import AvatarDisc from '../components/AvatarDisc.vue'
import PinDetailOverlayHost from '../components/PinDetailOverlayHost.vue'
import { displayInitials } from '../utils/displayInitials'
import { subscribeUnreadCountFromHeader, subscribeNotificationLive } from '../lib/notificationRefresh'
import {
  setMobileHeaderSubtitle,
  setMobileMarkAllReadTrailing,
} from '../composables/mobileHeaderContext'
import PinovaButton from '../components/ui/PinovaButton.vue'
import PinovaEmptyState from '../components/ui/PinovaEmptyState.vue'
import PinovaErrorState from '../components/ui/PinovaErrorState.vue'
import NotificationListSkeleton from '../components/NotificationListSkeleton.vue'
import {
  getCachedNotificationsFirstPage,
  setCachedNotificationsFirstPage,
} from '../lib/cache/notificationsClientCache'
import { runBackground, shallowJsonEqual } from '../lib/cache/staleRevalidate'

const { t, currentLang } = useI18n()
const route = useRoute()
const router = useRouter()
const { isAuthenticated } = useAuth()

type NotificationRow = {
  id: number
  title?: string
  message: string
  sender_username?: string
  sender_avatar_url?: string | null
  sender_avatar_color?: string | null
  is_read: boolean
  pin_slug?: string | null
  pin_id?: number | null
  comment_id?: number | null
  action_url?: string | null
  metadata?: Record<string, unknown> | null
  notification_type?: string | null
}

const notifications = ref<NotificationRow[]>([])
const page = ref(1)
const hasNext = ref(false)
const loading = ref(false)
const loadingMore = ref(false)
const error = ref(false)
const unreadCount = ref(0)
const loadedOnce = ref(false)
let unsubscribe: (() => void) | null = null
let unsubscribeLive: (() => void) | null = null

const hasItems = computed(() => notifications.value.length > 0)
const showInitialSkeleton = computed(() => loading.value && !loadedOnce.value)

async function markAllAsRead() {
  try {
    await api.post('notifications/mark_all_as_read/')
    notifications.value.forEach((n) => (n.is_read = true))
    unreadCount.value = 0
    syncNotificationsMobileHeader()
  } catch (err) {
    console.error('NotificationsPage: mark all read error', err)
  }
}

function syncNotificationsMobileHeader() {
  /*
   * KeepAlive : ce composant reste monté hors route. Sans garde, chaque update du
   * compteur (via GlobalHeader) réinjectait sous-titre + bouton dans App.vue pour
   * TOUTES les pages — il faut ne synchroniser que lorsque /notifications est active.
   */
  if (route.name !== 'notifications' || !isAuthenticated.value) {
    setMobileHeaderSubtitle(null)
    setMobileMarkAllReadTrailing(null)
    return
  }
  setMobileHeaderSubtitle(
    unreadCount.value > 0 ? t('notifications.unreadCount', { count: unreadCount.value }) : null,
  )
  setMobileMarkAllReadTrailing(
    unreadCount.value > 0
      ? {
          ariaLabel: t('header.notifications.markAllRead'),
          onClick: () => {
            void markAllAsRead()
          },
        }
      : null,
  )
}

async function load(reset = true, opts?: { silent?: boolean }) {
  if (!isAuthenticated.value) return
  const nextPage = reset ? 1 : page.value + 1

  if (reset && !opts?.silent) {
    const cached = getCachedNotificationsFirstPage(currentLang.value)
    if (cached?.items?.length) {
      notifications.value = cached.items as NotificationRow[]
      hasNext.value = cached.hasNext
      page.value = 1
      loadedOnce.value = true
      loading.value = false
      error.value = false
      syncNotificationsMobileHeader()
      runBackground(async () => {
        await load(true, { silent: true })
      })
      return
    }
  }

  if (reset && !opts?.silent) {
    loading.value = true
    error.value = false
  } else if (!reset) {
    loadingMore.value = true
  }
  try {
    const response = await api.get('notifications/', {
      params: { page: nextPage, page_size: 20, lang: currentLang.value },
    })
    const data = response.data
    let chunk: NotificationRow[] = []
    if (Array.isArray(data)) {
      chunk = data
      hasNext.value = false
      page.value = 1
    } else {
      chunk = (data?.results ?? []) as NotificationRow[]
      hasNext.value = !!data?.next
      page.value = nextPage
    }
    const nextList = reset ? chunk : [...notifications.value, ...chunk]
    if (!shallowJsonEqual(nextList, notifications.value)) {
      notifications.value = nextList
    }
    if (reset && nextPage === 1) {
      setCachedNotificationsFirstPage(currentLang.value, notifications.value, hasNext.value)
    }
    loadedOnce.value = true
  } catch (err) {
    console.error('NotificationsPage: load error', err)
    if (reset && !opts?.silent && notifications.value.length === 0) {
      notifications.value = []
      hasNext.value = false
      error.value = true
    }
  } finally {
    loading.value = false
    loadingMore.value = false
    syncNotificationsMobileHeader()
  }
}

async function handleClick(notification: NotificationRow) {
  if (!notification.is_read) {
    try {
      await api.post(`notifications/${notification.id}/mark_as_read/`)
      notification.is_read = true
      unreadCount.value = Math.max(0, unreadCount.value - 1)
      syncNotificationsMobileHeader()
    } catch (err) {
      console.error('NotificationsPage: mark read error', err)
    }
  }
  const meta =
    notification.metadata && typeof notification.metadata === 'object'
      ? (notification.metadata as Record<string, unknown>)
      : null
  const input: WebNotificationNavInput = {
    metadata: meta,
    pin_slug: notification.pin_slug ?? null,
    pin_id: notification.pin_id ?? null,
    comment_id: notification.comment_id ?? null,
    action_url: notification.action_url ?? null,
    notification_type: notification.notification_type ?? null,
    sender_username: notification.sender_username ?? null,
  }
  navigateWebNotificationDeepLink(router, input, 'notificationsPage', {
    path: route.path,
    query: route.query as Record<string, string | string[]>,
  })
}

onMounted(() => {
  unsubscribe = subscribeUnreadCountFromHeader((n) => {
    unreadCount.value = n
    syncNotificationsMobileHeader()
  })
  unsubscribeLive = subscribeNotificationLive((payload) => {
    if (!payload?.id) return
    if (notifications.value.some((n) => n.id === payload.id)) return
    notifications.value = [
      {
        id: payload.id,
        title: payload.title,
        message: payload.message || '',
        sender_username: payload.sender_username,
        sender_avatar_url: payload.sender_avatar_url ?? null,
        sender_avatar_color: payload.sender_avatar_color ?? null,
        is_read: !!payload.is_read,
        pin_slug: payload.pin_slug ?? null,
        pin_id: payload.pin_id ?? null,
        comment_id: payload.comment_id ?? null,
        action_url: payload.action_url ?? null,
        metadata: payload.metadata ?? null,
        notification_type: payload.notification_type ?? null,
      },
      ...notifications.value,
    ]
    syncNotificationsMobileHeader()
  })
  void load(true)
})

onActivated(() => {
  syncNotificationsMobileHeader()
  if (loadedOnce.value) {
    void load(true, { silent: true })
  }
})

onDeactivated(() => {
  setMobileHeaderSubtitle(null)
  setMobileMarkAllReadTrailing(null)
})

onUnmounted(() => {
  unsubscribe?.()
  unsubscribe = null
  unsubscribeLive?.()
  unsubscribeLive = null
  setMobileHeaderSubtitle(null)
  setMobileMarkAllReadTrailing(null)
})

watch(currentLang, () => {
  if (loadedOnce.value) void load(true)
  syncNotificationsMobileHeader()
})

watch(isAuthenticated, (auth) => {
  if (!auth) {
    notifications.value = []
    hasNext.value = false
    page.value = 1
    unreadCount.value = 0
    loadedOnce.value = false
    setMobileHeaderSubtitle(null)
    setMobileMarkAllReadTrailing(null)
  } else if (!loadedOnce.value) {
    void load(true)
  } else {
    syncNotificationsMobileHeader()
  }
})

/** Quitte /notifications : vide le contexte header tout de suite (avant KeepAlive / callbacks différés). */
watch(
  () => route.name,
  (name) => {
    if (name !== 'notifications') {
      setMobileHeaderSubtitle(null)
      setMobileMarkAllReadTrailing(null)
    }
  },
)
</script>

<template>
  <div
    class="w-full min-w-0 bg-gradient-to-b from-pink-50/40 via-transparent to-transparent px-3 py-4 sm:px-6 sm:py-8 lg:px-10 xl:px-16 dark:from-pink-950/25"
  >
    <div class="mx-auto max-w-3xl">
      <!-- Desktop : titre + compteur + action (le mobile utilise `AppMobilePageHeader` via contexte). -->
      <header class="mb-5 hidden items-center justify-between gap-3 sm:mb-7 lg:flex">
        <div class="min-w-0">
          <h1 class="text-2xl font-bold text-neutral-900 dark:text-neutral-100 sm:text-3xl">
            {{ t('header.notifications') }}
          </h1>
          <p
            v-if="unreadCount > 0"
            class="mt-1 text-xs font-semibold text-neutral-900 dark:text-neutral-100 sm:text-sm"
          >
            {{ t('notifications.unreadCount', { count: unreadCount }) }}
          </p>
        </div>
        <PinovaButton
          v-if="unreadCount > 0"
          variant="secondary"
          size="sm"
          @click="markAllAsRead"
        >
          <span class="material-symbols-outlined text-base leading-none">done_all</span>
          {{ t('header.notifications.markAllRead') }}
        </PinovaButton>
      </header>

      <NotificationListSkeleton v-if="showInitialSkeleton" />

      <div
        v-else-if="error && !hasItems"
        class="rounded-2xl border border-white/50 bg-white/55 shadow-sm backdrop-blur-xl dark:border-white/10 dark:bg-neutral-900/50"
      >
        <PinovaErrorState
          icon="cloud_off"
          :title="t('notifications.loadError')"
        >
          <template #action>
            <PinovaButton variant="primary" size="sm" block @click="load(true)">
              {{ t('common.retry') }}
            </PinovaButton>
          </template>
        </PinovaErrorState>
      </div>

      <div
        v-else-if="!hasItems"
        class="rounded-2xl border border-dashed border-neutral-200/90 bg-white/50 backdrop-blur-xl dark:border-neutral-700/80 dark:bg-neutral-900/45"
      >
        <PinovaEmptyState
          icon="notifications_off"
          :title="t('header.notifications.empty')"
          :description="t('notifications.emptyHint')"
        />
      </div>

      <ul v-else class="space-y-3">
        <li
          v-for="notification in notifications"
          :key="notification.id"
          class="rounded-2xl border border-white/50 bg-white/55 shadow-sm backdrop-blur-xl transition dark:border-white/10 dark:bg-neutral-900/45 dark:shadow-none"
          :class="
            !notification.is_read
              ? 'ring-1 ring-pink-300/50 dark:ring-pink-700/40'
              : 'hover:border-pink-200/70 dark:hover:border-pink-800/50'
          "
        >
          <button
            type="button"
            class="flex w-full items-start gap-3 rounded-2xl p-4 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600"
            @click="handleClick(notification)"
          >
            <AvatarDisc
              :color="notification.sender_avatar_color || DEFAULT_AVATAR_COLOR_CLASS"
              frame-class="w-11 h-11 text-xs shrink-0"
              text-class="text-white"
              :has-image="!!notification.sender_avatar_url"
            >
              <img
                v-if="notification.sender_avatar_url"
                :src="notification.sender_avatar_url"
                alt=""
                class="h-full w-full object-cover"
              />
              <span v-else>{{ displayInitials(notification.sender_username) }}</span>
            </AvatarDisc>
            <div class="min-w-0 flex-1">
              <p
                v-if="notification.title"
                class="mb-0.5 text-[11px] font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400"
              >
                {{ notification.title }}
              </p>
              <p class="text-sm leading-snug text-neutral-900 dark:text-neutral-100">
                {{ notification.message }}
              </p>
              <p v-if="notification.sender_username" class="mt-1 text-xs text-neutral-500 dark:text-neutral-400">
                @{{ notification.sender_username }}
              </p>
            </div>
            <span
              v-if="!notification.is_read"
              class="mt-1 inline-block h-2.5 w-2.5 shrink-0 rounded-full bg-pink-700 dark:bg-pink-600"
              aria-hidden="true"
            />
          </button>
        </li>
      </ul>

      <NotificationListSkeleton v-if="loadingMore" :rows="2" compact class="mt-3" />

      <div v-if="hasNext && hasItems" class="mt-6 flex justify-center">
        <button
          type="button"
          class="rounded-full border border-white/60 bg-white/70 px-5 py-2.5 text-sm font-semibold text-neutral-700 shadow-sm backdrop-blur-md transition hover:bg-white/90 disabled:opacity-60 dark:border-white/10 dark:bg-neutral-900/55 dark:text-neutral-200 dark:hover:bg-neutral-900/75"
          :disabled="loadingMore"
          @click="load(false)"
        >
          <span v-if="loadingMore" class="material-symbols-outlined animate-spin text-base">progress_activity</span>
          <span v-else>{{ t('header.notifications.loadMore') }}</span>
        </button>
      </div>
    </div>

    <!-- Fiche pin en surcouche (même mécanisme que home / profil) sans quitter la page. -->
    <PinDetailOverlayHost :pins="[]" />
  </div>
</template>
