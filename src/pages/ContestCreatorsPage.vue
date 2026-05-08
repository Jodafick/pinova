<script setup lang="ts">
import LeaderboardCreatorRow from '../components/contest/LeaderboardCreatorRow.vue'
import { useContestLive } from '../composables/useContestLive'

const { contestState } = useContestLive()
</script>

<template>
  <div class="max-w-5xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <div class="mb-6">
      <h1 class="text-2xl sm:text-3xl font-black">Classement des créateurs</h1>
      <p class="text-sm text-neutral-500 mt-1">Agrégation live des performances de pins du mois.</p>
    </div>
    <div v-if="contestState.loading" class="grid gap-3">
      <div v-for="i in 10" :key="i" class="h-20 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
    </div>
    <div v-else class="grid gap-3">
      <LeaderboardCreatorRow
        v-for="(row, idx) in contestState.topCreators.slice(0, 100)"
        :key="row.creator_id"
        :row="row"
        :index="idx"
      />
    </div>
  </div>
</template>
