<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import api from '../api'
import { useContestLive } from '../composables/useContestLive'

type NotificationItem = {
  id: number
  notification_type: string
  title: string
  message: string
  is_read: boolean
  created_at: string
  pin_slug?: string
  action_url?: string
}

const notifications = ref<NotificationItem[]>([])
const loading = ref(false)
const { contestState } = useContestLive()

const unread = computed(() => notifications.value.filter((n) => !n.is_read).length)

async function fetchNotifications() {
  loading.value = true
  try {
    const { data } = await api.get<{ results?: NotificationItem[] } | NotificationItem[]>('notifications/', {
      params: { page_size: 50 },
    })
    notifications.value = Array.isArray(data) ? data : data.results || []
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void fetchNotifications()
})
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div class="flex items-center justify-between mb-5">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black">Notifications concours</h1>
        <p class="text-sm text-neutral-500 mt-1">Flux live + notifications in-app.</p>
      </div>
      <span class="text-xs px-2 py-1 rounded-full bg-neutral-900 text-white dark:bg-white dark:text-neutral-900">
        {{ unread }} non lues
      </span>
    </div>

    <div class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 mb-5">
      <p class="text-xs uppercase tracking-[0.2em] text-neutral-500 mb-2">Live events</p>
      <div class="max-h-44 overflow-y-auto space-y-2">
        <p
          v-for="evt in contestState.liveEvents.slice().reverse().slice(0, 20)"
          :key="evt.sequence"
          class="text-sm rounded-lg bg-neutral-100 dark:bg-neutral-800 px-3 py-2"
        >
          #{{ evt.sequence }} · {{ evt.event_type }}
        </p>
      </div>
    </div>

    <div v-if="loading" class="grid gap-3">
      <div v-for="i in 8" :key="i" class="h-18 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
    </div>
    <div v-else class="grid gap-3">
      <div
        v-for="n in notifications"
        :key="n.id"
        class="rounded-2xl border px-4 py-3"
        :class="n.is_read ? 'border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900' : 'border-pink-200 bg-pink-50/60 dark:border-pink-700 dark:bg-pink-900/20'"
      >
        <p class="text-xs uppercase tracking-wide text-neutral-500">{{ n.notification_type }}</p>
        <p class="font-semibold mt-0.5">{{ n.title || 'Notification' }}</p>
        <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ n.message }}</p>
      </div>
    </div>
  </div>
</template>
