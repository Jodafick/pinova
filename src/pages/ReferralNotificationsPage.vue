<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import api from '../api/index'
import { useI18n } from '../i18n'
import { useRouter } from 'vue-router'

const { t, currentLang } = useI18n()
const router = useRouter()

type NotifRow = {
  id: number
  title?: string
  message?: string
  is_read?: boolean
  action_url?: string
  metadata?: { kind?: string; contest_key?: string }
}

const all = ref<NotifRow[]>([])
const loading = ref(true)
const error = ref('')

function isReferralNotif(n: NotifRow) {
  const k = (n.metadata?.kind || '').toLowerCase()
  return k.startsWith('referral_')
}

const referralNotifs = computed(() => all.value.filter(isReferralNotif))

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get('notifications/', {
      params: { page: 1, page_size: 80, lang: currentLang.value as string },
    })
    if (Array.isArray(data)) {
      all.value = data as NotifRow[]
    } else {
      all.value = (data?.results ?? []) as NotifRow[]
    }
  } catch {
    error.value = t('referral.error.load')
  } finally {
    loading.value = false
  }
})

function openNotif(n: NotifRow) {
  const path = n.action_url
  if (path && path.startsWith('/')) {
    void router.push(path)
  }
}
</script>

<template>
  <div class="w-full min-w-0 max-w-2xl mx-auto px-4 py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">{{ t('referral.notifications.title') }}</h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{{ t('referral.notifications.subtitle') }}</p>
    </div>

    <div v-if="loading" class="h-40 rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <ul v-else class="space-y-2">
      <li
        v-for="n in referralNotifs"
        :key="n.id"
        class="rounded-xl border px-4 py-3 cursor-pointer transition hover:bg-neutral-50 dark:hover:bg-neutral-800/60"
        :class="
          n.is_read
            ? 'border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900'
            : 'border-pink-300/70 bg-pink-50/50 dark:bg-pink-950/20 dark:border-pink-900/40'
        "
        @click="openNotif(n)"
      >
        <p class="font-semibold text-neutral-900 dark:text-white text-sm">{{ n.title }}</p>
        <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{{ n.message }}</p>
        <p v-if="n.metadata?.contest_key" class="text-[10px] text-neutral-400 mt-2 font-mono">
          {{ n.metadata.contest_key }}
        </p>
      </li>
    </ul>

    <p v-if="!loading && !referralNotifs.length" class="text-center text-sm text-neutral-500 py-8">
      {{ t('referral.notifications.empty') }}
    </p>

    <router-link to="/referrals/contest" class="block text-center text-sm font-medium text-pink-700 hover:underline">
      {{ t('referral.notifications.backContest') }}
    </router-link>
  </div>
</template>
