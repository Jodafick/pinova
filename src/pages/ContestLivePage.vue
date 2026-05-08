<script setup lang="ts">
import { computed, ref } from 'vue'

import ContestCountdown from '../components/contest/ContestCountdown.vue'
import LeaderboardPinGridCard from '../components/contest/LeaderboardPinGridCard.vue'
import LeaderboardPinRow from '../components/contest/LeaderboardPinRow.vue'
import { useContestLive } from '../composables/useContestLive'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const { t } = useI18n()
const { currentUser, isAuthenticated } = useAuth()
const { contestState, contestRemainingMs, refreshContestNow, dismissContestRankCue } = useContestLive()

const layoutMode = ref<'list' | 'grid'>('list')

const displayPins = computed(() => {
  const n = contestState.settings?.leaderboard_display_pins
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.max(1, Math.min(Math.floor(n), 500))
  }
  return 10
})

const rewardsCount = computed(() => Math.max(0, contestState.settings?.max_winners ?? 0))

const topPins = computed(() => contestState.topPins.slice(0, displayPins.value))

const overview = computed(() => {
  const pins = topPins.value
  const engagement = pins.reduce((sum, row) => {
    if (row.engagement_total != null) return sum + Number(row.engagement_total)
    return (
      sum +
      (row.likes || 0) +
      (row.views || 0) +
      (row.shares || 0) +
      (row.saves || 0) +
      (row.comments || 0)
    )
  }, 0)
  return { engagement }
})

/** Limite squelette pour éviter des centaines de blocs si `leaderboard_display_pins` est élevé. */
const skeletonGridCols = computed(() => Math.min(displayPins.value, 24))

const viewer = computed(() => contestState.viewer)
const viewerPin = computed(() => (viewer.value?.ranked ? viewer.value?.pin ?? null : null))

const showMyRankDock = computed(
  () => isAuthenticated.value && viewer.value?.ranked === true && viewer.value?.in_displayed_top === false && !!viewerPin.value,
)

function isYourCreatorRow(creatorId: number) {
  return isAuthenticated.value && currentUser.value != null && currentUser.value.id === creatorId
}

const stickyPadClass = computed(() => (showMyRankDock.value ? 'pb-32 sm:pb-28' : ''))
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8" :class="stickyPadClass">
    <template v-if="contestState.loading">
      <div class="rounded-3xl border border-neutral-200/60 dark:border-neutral-700/80 bg-neutral-100/80 dark:bg-neutral-900/80 p-5 sm:p-7 mb-6 animate-pulse">
        <div class="h-3 w-32 rounded bg-neutral-300/80 dark:bg-neutral-700" />
        <div class="mt-4 h-8 w-2/3 max-w-md rounded-lg bg-neutral-300/80 dark:bg-neutral-700" />
        <div class="mt-2 h-4 w-full max-w-lg rounded bg-neutral-200/70 dark:bg-neutral-800" />
        <div class="mt-5 flex gap-2">
          <div v-for="i in 4" :key="'cd-' + i" class="flex-1 h-16 rounded-xl bg-neutral-200/70 dark:bg-neutral-800" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div v-for="i in 3" :key="'st-' + i" class="h-20 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800" />
        </div>
      </div>
      <div class="flex flex-wrap gap-2 mb-4">
        <div class="h-9 w-24 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
        <div class="h-9 w-24 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
      </div>
      <div class="grid gap-3 md:grid-cols-2 lg:grid-cols-5">
        <div
          v-for="i in skeletonGridCols"
          :key="'sk-' + i"
          class="h-36 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800 animate-pulse"
        />
      </div>
    </template>

    <template v-else>
      <div class="rounded-3xl border border-white/20 bg-gradient-to-br from-[#d946ef] via-[#db2777] to-[#7e22ce] text-white p-5 sm:p-7 mb-6 shadow-[0_18px_60px_-22px_rgba(126,34,206,0.7)]">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
          <div>
            <p class="text-xs uppercase tracking-[0.24em] text-pink-100/95">{{ t('contest.brand') }}</p>
            <h1 class="text-2xl sm:text-3xl font-black">{{ t('contest.title') }}</h1>
            <p class="text-sm text-pink-100 mt-1">{{ t('contest.subtitle') }}</p>
            <p class="text-[11px] text-pink-100/85 mt-2 font-semibold">{{ t('contest.live.rankedPinsHint', { count: displayPins }) }}</p>
          </div>
          <div class="flex items-center gap-3 text-xs flex-wrap justify-end">
            <span v-if="contestState.connected" class="px-2 py-1 rounded-full bg-white/15">{{ t('contest.live') }}</span>
            <router-link
              to="/contest/history"
              class="px-3 py-1 rounded-full bg-white/20 text-white font-semibold hover:bg-white/30"
            >
              {{ t('contest.live.historyLink') }}
            </router-link>
            <button type="button" class="px-3 py-1 rounded-full bg-white text-pink-700 font-semibold hover:bg-pink-50" @click="refreshContestNow">
              {{ t('contest.refresh') }}
            </button>
          </div>
        </div>
        <div class="mt-5">
          <ContestCountdown :remaining-ms="contestRemainingMs" />
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
          <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
            <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.rankedPins') }}</p>
            <p class="text-xl font-black mt-0.5">{{ topPins.length }}</p>
          </div>
          <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
            <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.rewardsSlots') }}</p>
            <p class="text-xl font-black mt-0.5">{{ rewardsCount }}</p>
            <p class="text-[10px] text-pink-100/80 mt-0.5">{{ t('contest.stats.rewardsSlotsHint') }}</p>
          </div>
          <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
            <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.totalSignals') }}</p>
            <p class="text-xl font-black mt-0.5">{{ overview.engagement }}</p>
            <p class="text-[10px] text-pink-100/80 mt-0.5">{{ t('contest.stats.signalsHint') }}</p>
          </div>
        </div>
      </div>

      <div
        v-if="contestState.selfRankCue && !contestState.loading"
        role="status"
        class="mb-4 rounded-2xl border px-4 py-3 flex gap-3 items-start shadow-lg"
        :class="
          contestState.selfRankCue.tone === 'up'
            ? 'border-emerald-400/70 bg-emerald-50/95 dark:bg-emerald-950/40 dark:border-emerald-700'
            : contestState.selfRankCue.tone === 'down'
              ? 'border-amber-400/80 bg-amber-50/95 dark:bg-amber-950/35 dark:border-amber-700'
              : 'border-fuchsia-400/70 bg-fuchsia-50/90 dark:bg-fuchsia-950/30 dark:border-fuchsia-700'
        "
      >
        <div class="min-w-0 flex-1">
          <p class="text-[11px] font-black uppercase tracking-wide text-neutral-600 dark:text-neutral-300">{{ contestState.selfRankCue.title }}</p>
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-50 mt-0.5">{{ contestState.selfRankCue.body }}</p>
        </div>
        <button
          type="button"
          class="shrink-0 text-xs font-bold px-2 py-1 rounded-lg bg-neutral-900/90 text-white hover:bg-neutral-800 dark:bg-white dark:text-neutral-900"
          @click="dismissContestRankCue"
        >
          {{ t('contest.rankCue.close') }}
        </button>
      </div>

      <div class="flex flex-wrap items-center justify-between gap-3 mb-4">
        <div class="inline-flex rounded-full border border-neutral-200 dark:border-neutral-600 p-0.5 bg-neutral-50 dark:bg-neutral-900/60">
          <button
            type="button"
            class="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            :class="layoutMode === 'list' ? 'bg-white dark:bg-neutral-800 shadow-sm' : 'text-neutral-500'"
            @click="layoutMode = 'list'"
          >
            {{ t('contest.layout.list') }}
          </button>
          <button
            type="button"
            class="px-4 py-1.5 rounded-full text-sm font-semibold transition"
            :class="layoutMode === 'grid' ? 'bg-white dark:bg-neutral-800 shadow-sm' : 'text-neutral-500'"
            @click="layoutMode = 'grid'"
          >
            {{ t('contest.layout.grid') }}
          </button>
        </div>
      </div>

      <p v-if="contestState.error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3">
        {{ contestState.error }}
      </p>

      <div v-if="layoutMode === 'list'" class="grid gap-3">
        <LeaderboardPinRow
          v-for="(row, idx) in topPins"
          :key="row.pin_id"
          :row="row"
          :index="idx"
          :is-you="isYourCreatorRow(row.creator_id) && viewer?.in_displayed_top === true"
        />
      </div>
      <div v-else class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-stretch auto-rows-fr">
        <LeaderboardPinGridCard
          v-for="row in topPins"
          :key="row.pin_id"
          :row="row"
          :is-you="isYourCreatorRow(row.creator_id) && viewer?.in_displayed_top === true"
        />
      </div>
    </template>

    <div
      v-if="showMyRankDock && viewerPin && viewer?.rank != null"
      class="fixed bottom-0 left-0 right-0 z-[50] px-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] pt-3 pointer-events-none"
    >
      <div class="max-w-6xl mx-auto pointer-events-auto">
        <router-link
          :to="`/pin/${encodeURIComponent(viewerPin.pin_slug)}`"
          class="flex items-center gap-3 rounded-2xl border border-fuchsia-300 dark:border-fuchsia-600 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-[0_-8px_30px_-10px_rgba(168,85,247,0.55)] px-4 py-3"
        >
          <div class="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-fuchsia-200/60">
            <img v-if="viewerPin.pin_image_url" :src="viewerPin.pin_image_url" alt="" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-black uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300">{{ t('contest.live.myRankTitle') }}</p>
            <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {{
                t('contest.live.myRankDetail', {
                  rank: viewer.rank,
                  points: viewerPin.score.toFixed(2),
                  title: viewerPin.pin_title,
                })
              }}
            </p>
          </div>
          <span class="shrink-0 text-2xl font-black text-fuchsia-600">{{ viewer.rank }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>
