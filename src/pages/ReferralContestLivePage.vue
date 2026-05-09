<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useReferralLive } from '../composables/useReferralLive'
import { useI18n } from '../i18n'
import type { ContestSettingsDto } from '../types/contest'

const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { referralState, referralRemainingMs, refreshReferralNow, dismissReferralSelfDelta } = useReferralLive()

const pinsContest = ref<ContestSettingsDto | null>(null)

onMounted(async () => {
  try {
    const { data } = await api.get<ContestSettingsDto>('contest/current')
    pinsContest.value = data
  } catch {
    pinsContest.value = null
  }
})

const rewardsCount = computed(() => Math.max(0, pinsContest.value?.max_winners ?? 0))

const displayRows = computed(() => referralState.rows.slice(0, 50))

function formatDuration(ms: number) {
  if (ms <= 0) return '0:00:00'
  const totalSec = Math.floor(ms / 1000)
  const h = Math.floor(totalSec / 3600)
  const m = Math.floor((totalSec % 3600) / 60)
  const s = totalSec % 60
  return `${h}:${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`
}

function isYouRow(referrerId: number) {
  return isAuthenticated.value && currentUser.value?.id === referrerId
}

function rankMoved(prev: number | undefined | null, rank: number) {
  if (prev == null || prev <= 0) return false
  return prev !== rank
}
</script>

<template>
  <div class="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div
      class="rounded-3xl border border-pink-200/50 dark:border-pink-900/40 bg-gradient-to-br from-pink-50/90 via-white to-violet-50/80 dark:from-pink-950/40 dark:via-neutral-900 dark:to-violet-950/30 p-5 sm:p-8 mb-6 shadow-[0_20px_60px_-24px_rgba(219,39,119,0.35)]"
    >
      <div class="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-4">
        <div class="min-w-0 space-y-2">
          <p
            class="inline-flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-pink-600 dark:text-pink-400"
          >
            <span
              class="relative flex h-2 w-2"
              :class="referralState.connected && !referralState.offline ? '' : 'opacity-60'"
            >
              <span
                v-if="referralState.connected && !referralState.offline"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-400 opacity-75"
              />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-pink-500" />
            </span>
            {{ referralState.offline ? t('referral.live.offline') : t('referral.live.badge') }}
            <span v-if="referralState.usingPollingFallback && !referralState.offline" class="text-neutral-500 font-normal">
              · {{ t('referral.live.fallback') }}
            </span>
          </p>
          <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-white tracking-tight">
            {{ t('referral.live.title') }}
          </h1>
          <p class="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
            {{ t('referral.live.subtitle') }}
          </p>
        </div>
        <div class="flex flex-wrap items-end gap-4">
          <div
            class="rounded-2xl bg-white/80 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 px-4 py-3 min-w-[9rem]"
          >
            <p class="text-[10px] uppercase tracking-wide text-neutral-500">{{ t('referral.live.remaining') }}</p>
            <p class="text-xl font-mono font-bold text-pink-600 dark:text-pink-400 tabular-nums">
              {{ formatDuration(referralRemainingMs) }}
            </p>
          </div>
          <div
            class="rounded-2xl bg-white/80 dark:bg-neutral-800/80 border border-neutral-200/80 dark:border-neutral-700 px-4 py-3"
          >
            <p class="text-[10px] uppercase tracking-wide text-neutral-500">{{ t('referral.live.rewards') }}</p>
            <p class="text-xl font-bold text-neutral-900 dark:text-white">{{ rewardsCount }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="referralState.lastSelfDelta"
        class="mt-5 flex items-center justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 dark:bg-emerald-950/40 dark:border-emerald-800 px-4 py-3"
      >
        <p class="text-sm text-emerald-900 dark:text-emerald-100">
          {{
            t('referral.live.rankChange', {
              prev: referralState.lastSelfDelta.prev,
              next: referralState.lastSelfDelta.next,
              score: referralState.lastSelfDelta.score.toFixed(1),
            })
          }}
        </p>
        <button
          type="button"
          class="text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:underline shrink-0"
          @click="dismissReferralSelfDelta"
        >
          {{ t('referral.live.dismissCue') }}
        </button>
      </div>
    </div>

    <nav v-if="isAuthenticated" class="flex flex-wrap gap-2 mb-6 text-sm">
      <router-link
        to="/referrals/invite"
        class="rounded-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-pink-400 transition"
      >
        {{ t('referral.nav.invite') }}
      </router-link>
      <router-link
        to="/referrals/history"
        class="rounded-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-pink-400 transition"
      >
        {{ t('referral.nav.history') }}
      </router-link>
      <router-link
        to="/referrals/notifications"
        class="rounded-full px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-pink-400 transition"
      >
        {{ t('referral.nav.notifications') }}
      </router-link>
    </nav>

    <div v-if="referralState.loading" class="space-y-3 animate-pulse">
      <div v-for="i in 8" :key="i" class="h-14 rounded-2xl bg-neutral-200/80 dark:bg-neutral-800" />
    </div>

    <div
      v-else-if="referralState.error && !referralState.contest"
      class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-6 text-sm text-amber-900 dark:text-amber-100"
    >
      {{ referralState.error }}
      <button type="button" class="ml-2 underline font-medium" @click="refreshReferralNow">{{ t('referral.retry') }}</button>
    </div>

    <div v-else class="space-y-4">
      <p
        v-if="!referralState.contest"
        class="text-center text-sm text-neutral-500 dark:text-neutral-400 py-2"
      >
        {{ t('referral.live.noContest') }}
      </p>
      <div
        v-if="isAuthenticated && referralState.viewer?.ranked && referralState.viewer.row"
        class="rounded-2xl border border-pink-300/60 dark:border-pink-700/50 bg-pink-50/50 dark:bg-pink-950/20 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div>
          <p class="text-xs font-semibold text-pink-700 dark:text-pink-300 uppercase tracking-wide">
            {{ t('referral.live.you') }}
          </p>
          <p class="text-lg font-bold text-neutral-900 dark:text-white">
            {{ t('referral.live.yourRank', { rank: referralState.viewer.rank, score: referralState.viewer.row.total_score.toFixed(1) }) }}
          </p>
        </div>
        <p v-if="!referralState.viewer.in_displayed_top" class="text-xs text-neutral-600 dark:text-neutral-400">
          {{ t('referral.live.outsideTop') }}
        </p>
      </div>

      <div class="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 overflow-hidden bg-white dark:bg-neutral-900 shadow-sm">
        <div
          class="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[3rem_1fr_6rem] gap-2 px-3 sm:px-4 py-2 text-[10px] sm:text-xs font-semibold uppercase tracking-wide text-neutral-500 bg-neutral-50 dark:bg-neutral-950/80"
        >
          <span>#</span>
          <span>{{ t('referral.live.colUser') }}</span>
          <span class="text-right">{{ t('referral.live.colScore') }}</span>
        </div>
        <TransitionGroup name="referral-lb" tag="div">
          <div
            v-for="row in displayRows"
            :key="row.referrer_id"
            class="grid grid-cols-[2.5rem_1fr_5rem] sm:grid-cols-[3rem_1fr_6rem] gap-2 px-3 sm:px-4 py-3 border-t border-neutral-100 dark:border-neutral-800 items-center transition-colors duration-300"
            :class="
              isYouRow(row.referrer_id)
                ? 'bg-pink-50/80 dark:bg-pink-950/25 ring-1 ring-inset ring-pink-200/60 dark:ring-pink-800/40'
                : 'hover:bg-neutral-50 dark:hover:bg-neutral-800/40'
            "
          >
            <span
              class="font-mono text-sm font-bold tabular-nums transition-transform duration-500"
              :class="rankMoved(row.previous_rank, row.rank) ? 'text-pink-600 scale-110' : 'text-neutral-700 dark:text-neutral-300'"
            >
              {{ row.rank }}
            </span>
            <span class="truncate font-medium text-neutral-900 dark:text-neutral-100">
              @{{ row.username }}
              <span v-if="isYouRow(row.referrer_id)" class="text-pink-600 text-xs ml-1">({{ t('referral.live.you') }})</span>
            </span>
            <span class="text-right font-mono text-sm text-pink-700 dark:text-pink-300 tabular-nums">
              {{ row.total_score.toFixed(1) }}
            </span>
          </div>
        </TransitionGroup>
      </div>
    </div>
  </div>
</template>

<style scoped>
.referral-lb-move {
  transition: transform 0.45s ease;
}
</style>
