<script setup lang="ts">
import { computed } from 'vue'
import ContestCountdown from '../components/contest/ContestCountdown.vue'
import LeaderboardPinRow from '../components/contest/LeaderboardPinRow.vue'
import { useContestLive } from '../composables/useContestLive'
import { useI18n } from '../i18n'

const { t } = useI18n()
const { contestState, contestRemainingMs, refreshContestNow } = useContestLive()
const topPins = computed(() => contestState.topPins.slice(0, 100))
const overview = computed(() => {
  const pins = topPins.value
  const creators = new Set(pins.map((r) => r.creator_id)).size
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
  return { creators, engagement }
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div class="rounded-3xl border border-white/20 bg-gradient-to-br from-[#d946ef] via-[#db2777] to-[#7e22ce] text-white p-5 sm:p-7 mb-6 shadow-[0_18px_60px_-22px_rgba(126,34,206,0.7)]">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-pink-100/95">{{ t('contest.brand') }}</p>
          <h1 class="text-2xl sm:text-3xl font-black">{{ t('contest.title') }}</h1>
          <p class="text-sm text-pink-100 mt-1">{{ t('contest.subtitle') }}</p>
        </div>
        <div class="flex items-center gap-3 text-xs flex-wrap justify-end">
          <span v-if="contestState.connected" class="px-2 py-1 rounded-full bg-white/15">{{ t('contest.live') }}</span>
          <router-link
            to="/contest/history"
            class="px-3 py-1 rounded-full bg-white/20 text-white font-semibold hover:bg-white/30"
          >
            {{ t('contest.live.historyLink') }}
          </router-link>
          <button class="px-3 py-1 rounded-full bg-white text-pink-700 font-semibold hover:bg-pink-50" @click="refreshContestNow">
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
          <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.distinctCreators') }}</p>
          <p class="text-xl font-black mt-0.5">{{ overview.creators }}</p>
        </div>
        <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
          <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.totalSignals') }}</p>
          <p class="text-xl font-black mt-0.5">{{ overview.engagement }}</p>
          <p class="text-[10px] text-pink-100/80 mt-0.5">{{ t('contest.stats.signalsHint') }}</p>
        </div>
      </div>
    </div>

    <div v-if="contestState.loading" class="grid gap-3">
      <div v-for="i in 8" :key="i" class="h-20 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
    </div>

    <div v-else>
      <p v-if="contestState.error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3">
        {{ contestState.error }}
      </p>
      <div class="grid gap-3">
        <LeaderboardPinRow
          v-for="(row, idx) in topPins"
          :key="row.pin_id"
          :row="row"
          :index="idx"
        />
      </div>
    </div>
  </div>
</template>
