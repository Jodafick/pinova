<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import api from '../api/index'
import { useI18n } from '../i18n'
import type { ReferralRefereeRowDto } from '../types/referral'

const { t } = useI18n()

const rows = ref<ReferralRefereeRowDto[]>([])
const loading = ref(true)
const error = ref('')

const stats = computed(() => {
  const list = rows.value
  const active = list.filter((r) => r.status === 'active').length
  const rewardPoints = list.reduce((s, r) => s + Number(r.reward_points_credited ?? 0), 0)
  const pendingPoints = list.reduce((s, r) => s + Number(r.reward_points_pending ?? 0), 0)
  return { total: list.length, active, rewardPoints, pendingPoints }
})

function statusLabel(status: string) {
  if (status === 'active') return t('referral.history.status.active')
  if (status === 'pending_email') return t('referral.history.status.pending')
  if (status === 'revoked') return t('referral.history.status.revoked')
  return status
}

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.get<{ results: ReferralRefereeRowDto[] }>('referrals/my-referees/')
    rows.value = data.results || []
  } catch {
    error.value = t('referral.error.load')
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div class="w-full min-w-0 max-w-3xl mx-auto px-4 py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">{{ t('referral.history.title') }}</h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{{ t('referral.history.subtitle') }}</p>
    </div>

    <div v-if="loading" class="h-32 rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-else>
      <div class="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p class="text-[10px] uppercase text-neutral-500">{{ t('referral.history.stats.total') }}</p>
          <p class="text-xl font-bold">{{ stats.total }}</p>
        </div>
        <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p class="text-[10px] uppercase text-neutral-500">{{ t('referral.history.stats.active') }}</p>
          <p class="text-xl font-bold text-emerald-600">{{ stats.active }}</p>
        </div>
        <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p class="text-[10px] uppercase text-neutral-500">{{ t('referral.history.stats.rewarded') }}</p>
          <p class="text-xl font-bold text-violet-600">{{ Math.round(stats.rewardPoints) }}</p>
        </div>
        <div class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
          <p class="text-[10px] uppercase text-neutral-500">{{ t('referral.history.stats.pending_points') }}</p>
          <p class="text-xl font-bold text-amber-600 dark:text-amber-400">{{ Math.round(stats.pendingPoints) }}</p>
        </div>
      </div>

      <p
        v-if="stats.pendingPoints > 0"
        class="text-xs text-neutral-500 dark:text-neutral-400 -mt-2"
      >
        {{ t('referral.history.pending_points_footnote') }}
        <router-link to="/premium#trust-center" class="text-pink-700 font-semibold ml-1">{{ t('trust.center.learnMore') }}</router-link>
      </p>

      <ul class="space-y-2">
        <li
          v-for="r in rows"
          :key="r.id"
          class="rounded-xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 px-4 py-3 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
        >
          <div>
            <p class="font-semibold text-neutral-900 dark:text-white">@{{ r.referee_username }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">{{ r.created_at }}</p>
          </div>
          <div class="flex flex-wrap gap-2 items-center">
            <span
              class="text-xs font-medium rounded-full px-2.5 py-0.5"
              :class="
                r.status === 'active'
                  ? 'bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200'
                  : r.status === 'pending_email'
                    ? 'bg-amber-100 text-amber-900 dark:bg-amber-900/30 dark:text-amber-100'
                    : 'bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-300'
              "
            >
              {{ statusLabel(r.status) }}
            </span>
            <template v-if="Number(r.reward_points_pending ?? 0) > 0">
              <span class="text-xs text-amber-700 dark:text-amber-300">
                {{ t('referral.history.reward_pending_row', { n: Math.round(Number(r.reward_points_pending)) }) }}
              </span>
            </template>
            <span v-if="r.rewards_granted_at" class="text-xs text-violet-600 dark:text-violet-400">
              {{ t('referral.history.rewarded') }}
            </span>
          </div>
        </li>
      </ul>

      <p v-if="!rows.length" class="text-center text-sm text-neutral-500 py-8">{{ t('referral.history.empty') }}</p>
    </template>
  </div>
</template>
