<script setup lang="ts">
import { onMounted, ref } from 'vue'
import api from '../api/index'
import { useI18n } from '../i18n'

const { t } = useI18n()

type ContestHistoryResult = {
  contest_key: string
  start_at: string
  end_at: string
  result: {
    winners: { rank: number; foto_id: number; creator_id: number; score: number }[]
    payouts: unknown[]
    finalized_at: string | null
  }
}

type ArchiveEntry = {
  contest_key: string
  start_at: string
  end_at: string
  finalized_at: string | null
}

const loading = ref(false)
const archivesLoading = ref(false)
const inputKey = ref('')
const archives = ref<ArchiveEntry[]>([])
const history = ref<ContestHistoryResult | null>(null)
const error = ref('')

async function loadArchives() {
  archivesLoading.value = true
  try {
    const { data } = await api.get<{ results: ArchiveEntry[] }>('contest/archives')
    archives.value = Array.isArray(data.results) ? data.results : []
  } catch {
    archives.value = []
  } finally {
    archivesLoading.value = false
  }
}

async function loadHistoryByKey(contestKey: string) {
  if (!contestKey.trim()) return
  loading.value = true
  error.value = ''
  inputKey.value = contestKey.trim()
  try {
    const { data } = await api.get<ContestHistoryResult>(
      `contest/history/${encodeURIComponent(contestKey.trim())}`,
    )
    history.value = data
  } catch {
    error.value = t('contest.history.notFound')
    history.value = null
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  const now = new Date()
  const month = String(now.getMonth() + 1).padStart(2, '0')
  inputKey.value = `${now.getFullYear()}-${month}`
  void loadArchives()
})
</script>

<template>
  <div class="max-w-4xl mx-auto px-4 sm:px-6 py-6 sm:py-8 pb-[calc(1rem+env(safe-area-inset-bottom,0px))]">
    <div class="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-6">
      <div>
        <h1 class="text-2xl sm:text-3xl font-black mb-1">{{ t('contest.history.title') }}</h1>
        <p class="text-sm text-neutral-500">{{ t('contest.history.lead') }}</p>
      </div>
      <router-link
        to="/contest/live"
        class="text-sm font-semibold text-pink-700 hover:text-pink-800 shrink-0"
      >
        ← {{ t('contest.title') }}
      </router-link>
    </div>

    <p class="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{{ t('contest.history.pastMonthsLead') }}</p>

    <div v-if="archivesLoading" class="h-12 rounded-xl bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse mb-4" />
    <div v-else-if="archives.length" class="flex flex-wrap gap-2 mb-6">
      <button
        v-for="a in archives"
        :key="a.contest_key"
        type="button"
        class="rounded-full border border-pink-200 bg-pink-50 px-3 py-1.5 text-xs font-bold text-pink-700 hover:bg-pink-100 dark:border-pink-800/60 dark:bg-pink-950/40 dark:text-pink-600"
        @click="loadHistoryByKey(a.contest_key)"
      >
        {{ a.contest_key }}
      </button>
    </div>

    <div class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 sm:p-5 mb-6">
      <div class="flex flex-col sm:flex-row gap-3">
        <input
          v-model="inputKey"
          type="text"
          :placeholder="t('contest.history.placeholder')"
          class="flex-1 rounded-xl border border-neutral-300 dark:border-neutral-600 bg-transparent px-3 py-2 text-sm"
        />
        <button
          type="button"
          class="rounded-xl px-4 py-2 bg-pink-700 dark:bg-pink-600 text-white text-sm font-semibold hover:bg-pink-800 dark:hover:opacity-90"
          @click="loadHistoryByKey(inputKey)"
        >
          {{ t('contest.history.load') }}
        </button>
      </div>
    </div>

    <div v-if="loading" class="h-28 rounded-2xl bg-neutral-200/70 dark:bg-neutral-800/70 animate-pulse" />
    <p v-else-if="error" class="rounded-xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3">{{ error }}</p>

    <div v-else-if="history" class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-4 sm:p-5">
      <p class="text-sm text-neutral-500 mb-3">
        {{ t('contest.history.periodLabel') }}
        <span class="font-semibold text-neutral-800 dark:text-neutral-100">{{ history.contest_key }}</span>
      </p>
      <div class="grid gap-3">
        <div
          v-for="winner in history.result.winners"
          :key="winner.rank"
          class="rounded-xl border border-neutral-200 dark:border-neutral-700 px-4 py-3 flex items-center justify-between"
        >
          <p class="font-semibold">
            {{
              t('contest.history.winnerSummary', {
                rank: winner.rank,
                creator_id: winner.creator_id,
                foto_id: winner.foto_id,
              })
            }}
          </p>
          <p class="text-pink-700 font-bold">{{ t('contest.row.points', { points: Number(winner.score || 0).toFixed(2) }) }}</p>
        </div>
      </div>
    </div>
  </div>
</template>
