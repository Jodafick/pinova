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

/**
 * Hors du bloc affiché (top N configuré serveur via `leaderboard_display_pins`) : bandeau fixe avec rang + pin.
 */
const showMyRankDock = computed(
  () =>
    isAuthenticated.value &&
    viewer.value?.ranked === true &&
    viewer.value?.in_displayed_top === false &&
    !!viewerPin.value,
)

function isYourCreatorRow(creatorId: number) {
  return isAuthenticated.value && currentUser.value != null && currentUser.value.id === creatorId
}

/** Badge / surbrillance sur la carte du classement quand ta ligne fait partie du top affiché. */
function showYouHighlightForRow(row: { creator_id: number }) {
  return viewer.value?.ranked === true && isYourCreatorRow(row.creator_id)
}

const stickyPadClass = computed(
  () => (showMyRankDock.value && !contestState.loading ? 'pb-32 sm:pb-28' : ''),
)

/** Bandeau « hors top » : au-delà de ce rang, afficher « Non classé » au lieu du numéro. */
const MY_RANK_DOCK_NUMERIC_MAX = 100

const myRankDockRankLabel = computed(() => {
  const r = viewer.value?.rank
  if (r == null) return ''
  if (r > MY_RANK_DOCK_NUMERIC_MAX) return t('contest.live.myRankUnranked')
  return String(r)
})

const myRankDockRankIsNumeric = computed(() => {
  const r = viewer.value?.rank
  return r != null && r <= MY_RANK_DOCK_NUMERIC_MAX
})
</script>

<template>
  <!-- w-full min-w-0 : comme les autres pages, évite que le flex parent rétrécisse la colonne (skeleton plus étroit que le contenu réel). -->
  <div class="w-full min-w-0 max-w-6xl mx-auto px-4 sm:px-6 py-6 sm:py-8" :class="stickyPadClass">
    <template v-if="contestState.loading">
      <!-- Gabarit voisin du hero réel : mêmes paddings + hauteurs proches (titre 2xl/3xl, countdown, stats avec ligne hint). -->
      <div
        class="w-full min-w-0 rounded-3xl border border-neutral-200/60 dark:border-neutral-700/80 bg-neutral-100/80 dark:bg-neutral-900/80 p-5 sm:p-7 mb-6 shadow-[0_18px_60px_-22px_rgba(0,0,0,0.12)] dark:shadow-[0_18px_60px_-22px_rgba(0,0,0,0.35)]"
      >
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 w-full min-w-0">
          <div class="min-w-0 flex-1 w-full space-y-2 sm:space-y-2.5">
            <div class="h-3.5 w-32 sm:w-40 rounded bg-neutral-300/85 dark:bg-neutral-700 animate-pulse" />
            <div class="h-10 sm:h-[2.75rem] w-full rounded-lg bg-neutral-300/85 dark:bg-neutral-700 animate-pulse" />
            <div class="h-5 w-full rounded-md bg-neutral-200/78 dark:bg-neutral-800 animate-pulse" />
            <div class="h-4 w-full sm:w-[90%] rounded-md bg-neutral-200/75 dark:bg-neutral-800 animate-pulse" />
          </div>
          <div class="flex flex-wrap items-center gap-2 sm:gap-3 sm:justify-end shrink-0 pt-1">
            <div class="h-8 w-[5.5rem] rounded-full bg-neutral-200/80 dark:bg-neutral-800 hidden sm:block animate-pulse" />
            <div class="h-8 w-28 rounded-full bg-neutral-200/80 dark:bg-neutral-800 hidden sm:block animate-pulse" />
            <div class="h-8 w-24 rounded-full bg-neutral-200/80 dark:bg-neutral-800 hidden sm:block animate-pulse" />
          </div>
        </div>
        <div class="mt-5 sm:mt-6 grid grid-cols-4 gap-2 sm:gap-3 w-full min-w-0">
          <div
            v-for="i in 4"
            :key="'cd-' + i"
            class="min-h-[5.5rem] sm:min-h-[6rem] min-w-0 rounded-xl border border-neutral-200/50 dark:border-neutral-600/60 bg-neutral-200/80 dark:bg-neutral-800 p-2 flex flex-col justify-center gap-2 animate-pulse"
          >
            <div class="h-7 w-12 mx-auto rounded-md bg-neutral-300/90 dark:bg-neutral-600/80" />
            <div class="h-2.5 w-10 mx-auto rounded bg-neutral-300/70 dark:bg-neutral-600/60" />
          </div>
        </div>
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 sm:mt-5 w-full min-w-0">
          <div
            v-for="i in 3"
            :key="'st-' + i"
            class="min-h-[6.75rem] min-w-0 rounded-2xl border border-neutral-200/50 dark:border-neutral-600/50 bg-neutral-200/72 dark:bg-neutral-800 px-3.5 py-3 flex flex-col justify-start gap-2 animate-pulse"
          >
            <div class="h-3 w-24 rounded bg-neutral-300/80 dark:bg-neutral-700" />
            <div class="h-8 w-16 rounded-md bg-neutral-300/85 dark:bg-neutral-700" />
            <div v-if="i !== 1" class="h-2.5 w-full rounded bg-neutral-300/70 dark:bg-neutral-600 mt-auto" />
          </div>
        </div>
      </div>
      <div class="flex flex-wrap items-center justify-between gap-3 mb-4 w-full min-w-0">
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

      <!-- Squelettes alignés sur le mode d’affichage (liste = rangées desktop, grille = cartes comme le rendu réel). -->
      <div v-if="layoutMode === 'list'" class="grid gap-3">
        <div
          v-for="i in skeletonGridCols"
          :key="'sk-row-' + i"
          class="rounded-2xl border border-neutral-200/60 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3 min-h-[7rem] sm:min-h-[8.5rem] animate-pulse"
        >
          <div class="w-11 h-11 shrink-0 rounded-full bg-neutral-200/90 dark:bg-neutral-700 animate-pulse" />
          <div class="w-14 h-14 shrink-0 rounded-xl bg-neutral-200/85 dark:bg-neutral-700 self-center animate-pulse" />
          <div class="min-w-0 flex-1 py-0.5 space-y-2 w-full">
            <div class="h-[1.05rem] w-full rounded bg-neutral-200/90 dark:bg-neutral-700 animate-pulse" />
            <div class="h-3.5 w-full max-w-[14rem] rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
            <div class="h-4 w-40 max-w-[50%] rounded bg-neutral-200/82 dark:bg-neutral-800 animate-pulse" />
            <div class="mt-1.5 flex flex-wrap gap-1.5">
              <span
                v-for="j in 5"
                :key="j"
                class="h-[1.375rem] w-11 rounded-md bg-neutral-100 dark:bg-neutral-800 ring-1 ring-neutral-200/80 dark:ring-neutral-700/80 animate-pulse"
              />
            </div>
          </div>
          <div class="hidden sm:flex shrink-0 w-20 flex-col items-end gap-2 self-center">
            <div class="h-3 w-14 rounded bg-neutral-200/75 dark:bg-neutral-800 animate-pulse" />
            <div class="h-[1.125rem] w-9 rounded-md bg-neutral-200/88 dark:bg-neutral-700 animate-pulse" />
          </div>
        </div>
      </div>
      <!-- Même structure que LeaderboardPinGridCard : image carrée + pied ~min-h du composant réel -->
      <div v-else class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-stretch auto-rows-fr w-full min-w-0">
        <div
          v-for="i in skeletonGridCols"
          :key="'sk-card-' + i"
          class="w-full min-w-0 rounded-2xl border border-neutral-200/70 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 overflow-hidden flex flex-col min-h-0"
        >
          <div class="aspect-square w-full bg-neutral-200/75 dark:bg-neutral-800 shrink-0" />
          <div class="p-2.5 flex flex-col gap-2 min-h-[5.25rem] flex-1 justify-between">
            <div class="space-y-2">
              <div class="h-3.5 w-full rounded-md bg-neutral-200/85 dark:bg-neutral-700" />
              <div class="h-3 w-4/5 rounded-md bg-neutral-200/78 dark:bg-neutral-800" />
            </div>
            <div class="h-3.5 w-28 rounded-md bg-neutral-200/82 dark:bg-neutral-800 shrink-0" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div class="w-full min-w-0 rounded-3xl border border-white/20 bg-gradient-to-br from-[#d946ef] via-[#db2777] to-[#7e22ce] text-white p-5 sm:p-7 mb-6 shadow-[0_18px_60px_-22px_rgba(126,34,206,0.7)]">
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 w-full min-w-0">
          <div class="min-w-0 flex-1">
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
        <div class="grid grid-cols-1 sm:grid-cols-3 gap-3 mt-4 w-full min-w-0">
          <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3 min-w-0">
            <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.rankedPins') }}</p>
            <p class="text-xl font-black mt-0.5">{{ topPins.length }}</p>
          </div>
          <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3 min-w-0">
            <p class="text-[11px] uppercase tracking-wide text-pink-100/90">{{ t('contest.stats.rewardsSlots') }}</p>
            <p class="text-xl font-black mt-0.5">{{ rewardsCount }}</p>
            <p class="text-[10px] text-pink-100/80 mt-0.5">{{ t('contest.stats.rewardsSlotsHint') }}</p>
          </div>
          <div class="rounded-2xl bg-white/12 border border-white/25 px-3.5 py-3 min-w-0">
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

      <div class="flex flex-wrap items-center justify-between gap-3 mb-4 w-full min-w-0">
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

      <p v-if="contestState.error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 w-full min-w-0">
        {{ contestState.error }}
      </p>

      <div v-if="layoutMode === 'list'" class="grid gap-3 w-full min-w-0">
        <LeaderboardPinRow
          v-for="(row, idx) in topPins"
          :key="row.pin_id"
          :row="row"
          :index="idx"
          :is-you="showYouHighlightForRow(row)"
        />
      </div>
      <div v-else class="grid gap-3 grid-cols-1 md:grid-cols-2 lg:grid-cols-5 items-stretch auto-rows-fr">
        <LeaderboardPinGridCard
          v-for="row in topPins"
          :key="row.pin_id"
          :row="row"
          :is-you="showYouHighlightForRow(row)"
        />
      </div>
    </template>

    <div
      v-if="!contestState.loading && showMyRankDock && viewerPin && viewer?.rank != null"
      class="fixed bottom-0 left-0 right-0 z-[60] px-4 pb-[max(env(safe-area-inset-bottom,0px),16px)] pt-3 pointer-events-none"
      aria-label="Ma position hors top affiché"
    >
      <div class="w-full min-w-0 max-w-6xl mx-auto pointer-events-auto">
        <router-link
          :to="`/pin/${encodeURIComponent(viewerPin.pin_slug)}`"
          class="flex items-center gap-3 rounded-2xl border border-fuchsia-300 dark:border-fuchsia-600 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md shadow-[0_-8px_30px_-10px_rgba(168,85,247,0.55)] px-4 py-3 min-h-[4.75rem]"
        >
          <div class="w-14 h-14 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800 shrink-0 border border-fuchsia-200/60">
            <img v-if="viewerPin.pin_image_url" :src="viewerPin.pin_image_url" alt="" class="w-full h-full object-cover" />
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-xs font-black uppercase tracking-wide text-fuchsia-700 dark:text-fuchsia-300">{{ t('contest.live.myRankTitle') }}</p>
            <p class="text-sm font-bold text-neutral-900 dark:text-neutral-100 truncate">
              {{
                t('contest.live.myRankDetail', {
                  rank: myRankDockRankLabel,
                  points: viewerPin.score.toFixed(2),
                  title: viewerPin.pin_title,
                })
              }}
            </p>
          </div>
          <span
            class="shrink-0 font-black text-fuchsia-600 text-right leading-tight"
            :class="myRankDockRankIsNumeric ? 'text-2xl' : 'text-xs sm:text-sm max-w-[6.5rem]'"
          >{{ myRankDockRankLabel }}</span>
        </router-link>
      </div>
    </div>
  </div>
</template>
