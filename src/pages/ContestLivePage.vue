<script setup lang="ts">
import { computed } from 'vue'
import ContestCountdown from '../components/contest/ContestCountdown.vue'
import LeaderboardPinRow from '../components/contest/LeaderboardPinRow.vue'
import { useContestLive } from '../composables/useContestLive'

const { contestState, contestRemainingMs, refreshContestNow } = useContestLive()
const topPins = computed(() => contestState.topPins.slice(0, 100))
const totals = computed(() => {
  return topPins.value.reduce(
    (acc, row) => {
      acc.total += Number(row.total_interactions || 0)
      acc.eligible += Number(row.eligible_interactions || 0)
      return acc
    },
    { total: 0, eligible: 0 },
  )
})
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div class="rounded-3xl border border-white/20 bg-gradient-to-br from-[#d946ef] via-[#db2777] to-[#7e22ce] text-white p-5 sm:p-7 mb-6 shadow-[0_18px_60px_-22px_rgba(126,34,206,0.7)]">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.24em] text-pink-100/95">Pinova Contest</p>
          <h1 class="text-2xl sm:text-3xl font-black">Live Top Pins du mois</h1>
          <p class="text-sm text-pink-100 mt-1">
            Classement en direct (1 seul pin retenu par créateur: son meilleur score).
          </p>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="px-2 py-1 rounded-full bg-white/15">{{ contestState.connected ? 'WebSocket live' : 'Synchro' }}</span>
          <button class="px-3 py-1 rounded-full bg-white text-pink-700 font-semibold hover:bg-pink-50" @click="refreshContestNow">
            Refresh
          </button>
        </div>
      </div>
      <div class="mt-5">
        <ContestCountdown :remaining-ms="contestRemainingMs" />
      </div>
      <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4">
        <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
          <p class="text-[11px] uppercase tracking-wide text-pink-100/90">Pins classés</p>
          <p class="text-xl font-black mt-0.5">{{ topPins.length }}</p>
        </div>
        <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
          <p class="text-[11px] uppercase tracking-wide text-pink-100/90">Interactions totales</p>
          <p class="text-xl font-black mt-0.5">{{ totals.total }}</p>
        </div>
        <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3">
          <p class="text-[11px] uppercase tracking-wide text-pink-100/90">Interactions éligibles</p>
          <p class="text-xl font-black mt-0.5">{{ totals.eligible }}</p>
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
