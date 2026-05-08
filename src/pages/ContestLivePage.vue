<script setup lang="ts">
import ContestCountdown from '../components/contest/ContestCountdown.vue'
import LeaderboardPinRow from '../components/contest/LeaderboardPinRow.vue'
import { useContestLive } from '../composables/useContestLive'

const { contestState, contestRemainingMs, refreshContestNow } = useContestLive()
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div class="rounded-3xl border border-neutral-200 dark:border-neutral-700 bg-gradient-to-br from-pink-600 to-purple-600 text-white p-5 sm:p-7 mb-6">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4">
        <div>
          <p class="text-xs uppercase tracking-[0.2em] text-pink-100">Pinova Contest</p>
          <h1 class="text-2xl sm:text-3xl font-black">Live Top Pins du mois</h1>
          <p class="text-sm text-pink-100 mt-1">Classement en direct, mis à jour automatiquement.</p>
        </div>
        <div class="flex items-center gap-3 text-xs">
          <span class="px-2 py-1 rounded-full bg-white/15">
            {{ contestState.connected ? 'WebSocket live' : 'Mode fallback' }}
          </span>
          <button class="px-3 py-1 rounded-full bg-white text-pink-700 font-semibold hover:bg-pink-50" @click="refreshContestNow">
            Refresh
          </button>
        </div>
      </div>
      <div class="mt-5">
        <ContestCountdown :remaining-ms="contestRemainingMs" />
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
          v-for="(row, idx) in contestState.topPins.slice(0, 100)"
          :key="row.pin_id"
          :row="row"
          :index="idx"
        />
      </div>
    </div>
  </div>
</template>
