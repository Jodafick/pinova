<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api'

type ContestHistoryResult = {
  contest_key: string
  start_at: string
  end_at: string
  result: {
    winners: { rank: number; pin_id: number; creator_id: number; score: number }[]
    payouts: unknown[]
    finalized_at: string | null
  }
}

const loading = ref(false)
const inputKey = ref('')
const history = ref<ContestHistoryResult | null>(null)
const error = ref('')

async function loadHistoryByKey(contestKey: string) {
  if (!contestKey.trim()) return
  loading.value = true
  error.value = ''
  try {
    const { data } = await api.get<ContestHistoryResult>(`contest/history/${encodeURIComponent(contestKey.trim())}`)
    history.value = data
  } catch {
    error.value = 'Historique introuvable pour cette période.'
    history.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  inputKey.value = `${now.getFullYear()}-${month}`
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8">
    <h1 class="text-2xl sm:text-3xl font-black mb-1">Historique des concours</h1>
    <p class="text-sm text-neutral-500 mb-6">Consulte les résultats mensuels archivés.</p>

    <div class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 sm:p-5 mb-6">
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="inputKey"
          type="text"
          placeholder="YYYY-MM (ex: 2026-05)"
          class="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-transparent px-3 py-2 text-sm"
        />
        <button class="rounded-xl px-4 py-2 bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700" @click="loadHistoryByKey(inputKey)">
          Charger
        </button>
      </div>
    </div>

    <div v-if="loading" class="h-28 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
    <p v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3">{{ error }}</p>

    <div v-else-if="history" class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 sm:p-5">
      <p class="text-sm text-neutral-500 mb-3">
        Contest <span class="font-semibold text-neutral-800 dark:text-neutral-100">{{ history.contest_key }}</span>
      </p>
      <div class="grid gap-3">
        <div
          v-for="winner in history.result.winners"
          :key="winner.rank"
          class="rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between"
        >
          <p class="font-semibold">#{{ winner.rank }} · Créateur {{ winner.creator_id }} · Pin {{ winner.pin_id }}</p>
          <p class="text-pink-600 font-bold">{{ Number(winner.score || 0).toFixed(2) }} pts</p>
        </div>
      </div>
    </div>
  </div>
</template>
