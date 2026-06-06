<script setup lang="ts">
import { useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useGuestAuthGate } from '../composables/useGuestAuthGate'

const { t } = useI18n()
const router = useRouter()
const { promptGuest } = useGuestAuthGate()

function openContest() {
  void router.push({ name: 'contest-live' })
}

function joinToCompete() {
  promptGuest('contest')
}
</script>

<template>
  <div class="rounded-2xl border border-pink-200/80 dark:border-pink-900/50 bg-gradient-to-r from-pink-50 to-violet-50 dark:from-pink-950/40 dark:to-violet-950/30 p-4 flex flex-col sm:flex-row sm:items-center gap-3">
    <div class="flex-1 min-w-0">
      <p class="text-[10px] font-bold uppercase tracking-widest text-pink-600">{{ t('contest.guestTeaser.kicker') }}</p>
      <p class="text-sm font-bold text-neutral-900 dark:text-neutral-50">{{ t('contest.guestTeaser.title') }}</p>
      <p class="text-xs text-neutral-600 dark:text-neutral-400 mt-1">{{ t('contest.guestTeaser.desc') }}</p>
    </div>
    <div class="flex flex-wrap gap-2 shrink-0">
      <button
        type="button"
        class="rounded-xl border border-pink-300 dark:border-pink-800 px-3 py-2 text-xs font-bold text-pink-700 dark:text-pink-400"
        @click="openContest"
      >
        {{ t('contest.guestTeaser.viewLeaderboard') }}
      </button>
      <button
        type="button"
        class="rounded-xl bg-pink-700 text-white px-3 py-2 text-xs font-bold"
        @click="joinToCompete"
      >
        {{ t('contest.guestTeaser.cta') }}
      </button>
    </div>
  </div>
</template>
