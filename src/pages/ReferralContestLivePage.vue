<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import api from '../api/index'
import ContestCountdown from '../components/contest/ContestCountdown.vue'
import LeaderboardPodiumTopThree from '../components/contest/LeaderboardPodiumTopThree.vue'
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

const referralPodium1 = computed(() => displayRows.value.find((r) => r.rank === 1) ?? null)
const referralPodium2 = computed(() => displayRows.value.find((r) => r.rank === 2) ?? null)
const referralPodium3 = computed(() => displayRows.value.find((r) => r.rank === 3) ?? null)

const referralRowsAfterPodium = computed(() => displayRows.value.filter((r) => r.rank > 3))

function isYouRow(referrerId: number) {
  return isAuthenticated.value && currentUser.value?.id === referrerId
}

function rankMoved(prev: number | undefined | null, rank: number) {
  if (prev == null || prev <= 0) return false
  return prev !== rank
}
</script>

<template>
  <div class="w-full min-w-0 max-w-6xl mx-auto overflow-x-hidden px-3 sm:px-6 py-5 sm:py-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
    <div
      class="rounded-3xl border border-pink-200/55 dark:border-pink-900/40 bg-gradient-to-br from-pink-50/95 via-white to-violet-50/85 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950 p-5 sm:p-8 mb-5 sm:mb-6 shadow-[0_22px_64px_-26px_rgba(219,39,119,0.38)] dark:shadow-[0_22px_64px_-26px_rgba(0,0,0,0.55)] ring-1 ring-pink-500/[0.07] dark:ring-white/[0.06]"
    >
      <div class="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between lg:gap-8">
        <div class="min-w-0 space-y-3">
          <p
            class="inline-flex flex-wrap items-center gap-2 rounded-full bg-pink-500/[0.11] dark:bg-pink-400/[0.09] px-3 py-1.5 text-[11px] font-bold uppercase tracking-[0.14em] text-pink-700 dark:text-pink-400 ring-1 ring-pink-500/15 dark:ring-pink-500/20"
          >
            <span
              class="relative flex h-2 w-2 shrink-0"
              :class="referralState.connected && !referralState.offline ? '' : 'opacity-55'"
            >
              <span
                v-if="referralState.connected && !referralState.offline"
                class="animate-ping absolute inline-flex h-full w-full rounded-full bg-pink-600 dark:bg-pink-400 opacity-75"
              />
              <span class="relative inline-flex rounded-full h-2 w-2 bg-pink-600 dark:bg-pink-400" />
            </span>
            <span class="leading-none">{{ referralState.offline ? t('referral.live.offline') : t('referral.live.badge') }}</span>
          </p>
          <h1 class="text-[1.65rem] sm:text-3xl font-black text-neutral-900 dark:text-neutral-50 tracking-tight leading-[1.15]">
            {{ t('referral.live.title') }}
          </h1>
          <p class="text-sm sm:text-[0.9375rem] text-neutral-600 dark:text-neutral-400 max-w-xl leading-relaxed">
            {{ t('referral.live.subtitle') }}
          </p>
        </div>
        <div class="grid grid-cols-2 gap-2.5 sm:gap-3.5 w-full lg:max-w-[22rem] lg:shrink-0">
          <div
            class="rounded-2xl min-w-0 overflow-hidden bg-white/92 dark:bg-neutral-950/75 border border-neutral-200/85 dark:border-neutral-700/50 px-3 py-3 sm:px-4 sm:py-4 shadow-[0_10px_28px_-18px_rgba(219,39,119,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col gap-2.5 sm:flex-row sm:gap-3 sm:items-start"
          >
            <i
              class="fa-regular fa-clock text-[22px] shrink-0 rounded-xl bg-pink-500/10 dark:bg-pink-400/10 text-pink-700 dark:text-pink-400 p-2 ring-1 ring-pink-500/15 dark:ring-pink-500/25 sm:mt-0.5 self-center sm:self-start"
              aria-hidden="true"
            />
            <div class="min-w-0 w-full flex-1 sm:pt-0.5">
              <p class="text-[10px] uppercase tracking-[0.08em] font-semibold text-neutral-500 dark:text-neutral-500 mb-1.5 text-center sm:text-left">
                {{ t('referral.live.remaining') }}
              </p>
              <ContestCountdown :remaining-ms="referralRemainingMs" variant="referral" />
            </div>
          </div>
          <div
            class="rounded-2xl min-w-0 overflow-hidden bg-white/92 dark:bg-neutral-950/75 border border-neutral-200/85 dark:border-neutral-700/50 px-3 py-3 sm:px-4 sm:py-4 shadow-[0_10px_28px_-18px_rgba(219,39,119,0.22)] dark:shadow-[inset_0_1px_0_0_rgba(255,255,255,0.05)] flex flex-col gap-2.5 sm:flex-row sm:gap-3 sm:items-start"
          >
            <i
              class="fa-solid fa-award text-[22px] shrink-0 rounded-xl bg-violet-500/10 dark:bg-violet-400/10 text-violet-700 dark:text-violet-300 p-2 ring-1 ring-violet-500/15 dark:ring-violet-500/25 sm:mt-0.5 self-center sm:self-start"
              aria-hidden="true"
            />
            <div class="min-w-0 w-full flex-1 sm:pt-0.5">
              <p class="text-[10px] uppercase tracking-[0.08em] font-semibold text-neutral-500 dark:text-neutral-500 text-center sm:text-left">{{ t('referral.live.rewards') }}</p>
              <p class="text-xl font-black text-neutral-900 dark:text-neutral-100 tabular-nums mt-1.5 sm:mt-1 leading-none text-center sm:text-left">{{ rewardsCount }}</p>
            </div>
          </div>
        </div>
      </div>

      <div
        v-if="referralState.lastSelfDelta"
        class="mt-4 sm:mt-5 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 rounded-2xl border border-emerald-200/80 bg-emerald-50/90 dark:bg-emerald-950/35 dark:border-emerald-800/60 px-4 py-3"
      >
        <p class="text-sm text-emerald-900 dark:text-emerald-100 leading-snug min-w-0">
          {{
            t('referral.live.rankChange', {
              prev: referralState.lastSelfDelta.prev ?? '—',
              next: referralState.lastSelfDelta.next,
              score: referralState.lastSelfDelta.score.toFixed(1),
            })
          }}
        </p>
        <button
          type="button"
          class="text-xs font-medium text-emerald-800 dark:text-emerald-300 hover:underline shrink-0 self-end sm:self-auto"
          @click="dismissReferralSelfDelta"
        >
          {{ t('referral.live.dismissCue') }}
        </button>
      </div>
    </div>

    <nav v-if="isAuthenticated" class="flex flex-wrap gap-2 mb-5 sm:mb-6 text-sm">
      <router-link
        to="/referrals/invite"
        class="rounded-full px-3.5 sm:px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-pink-600 dark:hover:border-pink-500 transition min-h-[2.5rem] inline-flex items-center"
      >
        {{ t('referral.nav.invite') }}
      </router-link>
      <router-link
        to="/referrals/history"
        class="rounded-full px-3.5 sm:px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-pink-600 dark:hover:border-pink-500 transition min-h-[2.5rem] inline-flex items-center"
      >
        {{ t('referral.nav.history') }}
      </router-link>
      <router-link
        to="/referrals/notifications"
        class="rounded-full px-3.5 sm:px-4 py-2 bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-700 hover:border-pink-600 dark:hover:border-pink-500 transition min-h-[2.5rem] inline-flex items-center"
      >
        {{ t('referral.nav.notifications') }}
      </router-link>
    </nav>

    <div v-if="referralState.loading" class="space-y-2.5 sm:space-y-3 animate-pulse px-0.5">
      <div v-for="i in 8" :key="i" class="h-14 sm:h-[4.25rem] rounded-2xl bg-neutral-200/80 dark:bg-neutral-800/90" />
    </div>

    <div
      v-else-if="referralState.error && !referralState.contest"
      class="rounded-2xl border border-amber-200 bg-amber-50 dark:bg-amber-950/30 dark:border-amber-800 p-5 sm:p-6 text-sm text-amber-900 dark:text-amber-100"
    >
      {{ referralState.error }}
      <button type="button" class="ml-2 underline font-medium" @click="refreshReferralNow">{{ t('referral.retry') }}</button>
    </div>

    <div v-else class="space-y-4 sm:space-y-5">
      <p
        v-if="!referralState.contest"
        class="text-center text-sm text-neutral-500 dark:text-neutral-400 py-2"
      >
        {{ t('referral.live.noContest') }}
      </p>
      <div
        v-if="isAuthenticated && referralState.viewer?.ranked && referralState.viewer.row"
        class="rounded-2xl border border-pink-300/60 dark:border-pink-800/45 bg-pink-50/70 dark:bg-pink-950/22 p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="text-xs font-semibold text-pink-700 dark:text-pink-400 uppercase tracking-wide">
            {{ t('referral.live.you') }}
          </p>
          <p class="text-lg font-bold text-neutral-900 dark:text-neutral-100">
            {{
              t('referral.live.yourRank', {
                rank: referralState.viewer.rank ?? '—',
                score: referralState.viewer.row.total_score.toFixed(1),
              })
            }}
          </p>
        </div>
        <p v-if="!referralState.viewer.in_displayed_top" class="text-xs text-neutral-600 dark:text-neutral-400 leading-relaxed">
          {{ t('referral.live.outsideTop') }}
        </p>
      </div>

      <LeaderboardPodiumTopThree
        v-if="referralState.contest"
        variant="referral"
        :rank2="referralPodium2"
        :rank1="referralPodium1"
        :rank3="referralPodium3"
        :you-referrer-id="currentUser?.id ?? null"
      />

      <div
        class="rounded-2xl border border-neutral-200/90 dark:border-neutral-800 bg-gradient-to-b from-neutral-50/80 to-white dark:from-neutral-900/35 dark:to-neutral-950 shadow-[0_8px_30px_-18px_rgba(0,0,0,0.2)] dark:shadow-[0_8px_30px_-18px_rgba(0,0,0,0.45)] overflow-hidden"
      >
        <div
          class="grid grid-cols-[minmax(2.25rem,auto)_1fr_minmax(4.25rem,auto)] sm:grid-cols-[3rem_1fr_6.5rem] gap-x-2 sm:gap-x-3 px-3 sm:px-4 py-2.5 text-[10px] sm:text-xs font-bold uppercase tracking-wider text-neutral-600 dark:text-neutral-400 bg-neutral-100/95 dark:bg-neutral-950/90 backdrop-blur-sm border-b border-neutral-200/80 dark:border-neutral-800 sticky top-0 z-10"
        >
          <span>#</span>
          <span class="truncate">{{ t('referral.live.colUser') }}</span>
          <span class="text-right">{{ t('referral.live.colScore') }}</span>
        </div>
        <div class="p-2 sm:p-3">
          <TransitionGroup name="referral-lb" tag="div" class="flex flex-col gap-1.5 sm:gap-2">
            <div
              v-for="row in referralRowsAfterPodium"
              :key="row.referrer_id"
              class="grid grid-cols-[minmax(2.25rem,auto)_1fr_minmax(4.25rem,auto)] sm:grid-cols-[3rem_1fr_6.5rem] gap-x-2 sm:gap-x-3 items-center rounded-xl px-2 sm:px-3 py-2.5 sm:py-3 border transition-colors duration-300 min-h-[3.25rem] sm:min-h-0"
              :class="
                isYouRow(row.referrer_id)
                  ? 'border-pink-300/70 dark:border-pink-700/50 bg-gradient-to-r from-pink-50/95 to-white dark:from-pink-950/35 dark:to-neutral-900/80 shadow-sm ring-1 ring-pink-200/50 dark:ring-pink-900/40'
                  : 'border-neutral-200/70 dark:border-neutral-800/80 bg-white/90 dark:bg-neutral-900/45 hover:bg-neutral-50/95 dark:hover:bg-neutral-800/45'
              "
            >
              <span
                class="flex h-8 w-8 sm:h-9 sm:w-9 shrink-0 items-center justify-center rounded-full text-xs sm:text-sm font-bold tabular-nums transition-transform duration-500 shadow-inner"
                :class="
                  rankMoved(row.previous_rank, row.rank)
                    ? 'bg-pink-200/90 text-pink-900 dark:bg-pink-900/80 dark:text-pink-100 scale-105'
                    : 'bg-neutral-200/90 text-neutral-800 dark:bg-neutral-800 dark:text-neutral-200'
                "
              >
                {{ row.rank }}
              </span>
              <span class="min-w-0 font-medium text-neutral-900 dark:text-neutral-100 text-sm sm:text-[0.9375rem] leading-snug">
                <span class="truncate block">@{{ row.username }}</span>
                <span v-if="isYouRow(row.referrer_id)" class="text-pink-600 dark:text-pink-400 text-xs font-semibold">({{ t('referral.live.you') }})</span>
              </span>
              <span
                class="text-right text-sm sm:text-base font-mono font-bold tabular-nums text-pink-700 dark:text-pink-400 px-1 rounded-md bg-pink-50/80 dark:bg-pink-950/40"
              >
                {{ row.total_score.toFixed(1) }}
              </span>
            </div>
          </TransitionGroup>
        </div>
      </div>
    </div>
  </div>
</template>

<style scoped>
.referral-lb-move {
  transition: transform 0.45s ease;
}
</style>
