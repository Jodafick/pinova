<script setup lang="ts">
import { computed } from 'vue'

import ContestCountdown from '../components/contest/ContestCountdown.vue'
import LeaderboardPodiumTopThree from '../components/contest/LeaderboardPodiumTopThree.vue'
import LeaderboardFotoRow from '../components/contest/LeaderboardFotoRow.vue'
import { useContestLive } from '../composables/useContestLive'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const { t } = useI18n()
const { currentUser, isAuthenticated } = useAuth()
const { contestState, contestRemainingMs, refreshContestNow, dismissContestRankCue } = useContestLive()

const displayPins = computed(() => {
  const n = contestState.settings?.leaderboard_display_pins
  if (typeof n === 'number' && Number.isFinite(n)) {
    return Math.max(1, Math.min(Math.floor(n), 500))
  }
  return 10
})

const rewardsCount = computed(() => Math.max(0, contestState.settings?.max_winners ?? 0))

const topPins = computed(() => contestState.topPins.slice(0, displayPins.value))

const podiumRank1 = computed(() => topPins.value.find((p) => p.rank === 1) ?? null)
const podiumRank2 = computed(() => topPins.value.find((p) => p.rank === 2) ?? null)
const podiumRank3 = computed(() => topPins.value.find((p) => p.rank === 3) ?? null)

/** Lignes hors podium (évite le doublon avec le top 3). */
const pinsAfterPodium = computed(() => topPins.value.filter((p) => p.rank > 3))

/** Squelettes liste (hors top 3) — plafonné pour les grands N. */
const skeletonListRows = computed(() => Math.min(Math.max(0, displayPins.value - 3), 24))

const viewer = computed(() => contestState.viewer)
const viewerPin = computed(() => (viewer.value?.ranked ? viewer.value?.pin ?? null : null))

/**
 * Hors du bloc affiché (top N configuré serveur via `leaderboard_display_pins`) : bandeau fixe avec rang + foto.
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

const stickyPadClass = computed(() => {
  if (!showMyRankDock.value || contestState.loading) return 'pb-[calc(1rem+env(safe-area-inset-bottom,0px))]'
  return 'pb-[calc(5.5rem+env(safe-area-inset-bottom,0px))]'
})

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
  <div class="w-full min-w-0 max-w-6xl mx-auto overflow-x-hidden px-4 sm:px-6 py-6 sm:py-8" :class="stickyPadClass">
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
          <div
            class="flex flex-row flex-nowrap items-center gap-2 sm:gap-2.5 justify-start sm:justify-end shrink-0 pt-1 min-w-0 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <div class="h-8 w-[4.75rem] shrink-0 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
            <div class="h-8 w-[7.25rem] shrink-0 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
            <div class="h-8 w-[6.25rem] shrink-0 rounded-full bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
          </div>
        </div>
        <div class="mt-5 sm:mt-6 grid grid-cols-4 gap-1.5 sm:gap-3 w-full min-w-0">
          <div
            v-for="i in 4"
            :key="'cd-' + i"
            class="min-h-[4.75rem] sm:min-h-[5.75rem] min-w-0 rounded-xl border border-neutral-200/50 dark:border-neutral-600/60 bg-neutral-200/80 dark:bg-neutral-800 px-1 py-2 sm:p-2.5 flex flex-col justify-center items-center gap-1 sm:gap-1.5 animate-pulse"
          >
            <div class="h-3.5 w-3.5 sm:h-4 sm:w-4 rounded bg-neutral-300/90 dark:bg-neutral-600/80" />
            <div class="h-5 sm:h-7 w-9 sm:w-12 mx-auto rounded-md bg-neutral-300/90 dark:bg-neutral-600/80" />
            <div class="h-2 w-8 sm:w-10 mx-auto rounded bg-neutral-300/70 dark:bg-neutral-600/60" />
          </div>
        </div>
        <div class="grid grid-cols-2 gap-3 mt-4 sm:mt-5 w-full min-w-0">
          <div
            v-for="i in 2"
            :key="'st-' + i"
            class="min-h-[6.75rem] min-w-0 rounded-2xl border border-neutral-200/50 dark:border-neutral-600/50 bg-neutral-200/72 dark:bg-neutral-800 px-3.5 py-3 flex flex-col justify-start gap-2 animate-pulse"
          >
            <div class="h-3 w-24 rounded bg-neutral-300/80 dark:bg-neutral-700" />
            <div class="h-8 w-16 rounded-md bg-neutral-300/85 dark:bg-neutral-700" />
            <div v-if="i === 2" class="h-2.5 w-full rounded bg-neutral-300/70 dark:bg-neutral-600 mt-auto" />
          </div>
        </div>
      </div>

      <!-- Squelette top 3 (colonnes 2-1-3, cartes sombres + socles comme le podium réel). -->
      <div class="w-full max-w-[49rem] mx-auto mb-6 sm:mb-8 px-1 sm:px-2">
        <div class="mb-6 sm:mb-8 text-center space-y-3">
          <div class="h-3 w-28 sm:w-32 mx-auto rounded-md bg-neutral-300/80 dark:bg-neutral-700 animate-pulse" />
          <div class="h-11 sm:h-[3.25rem] max-w-[13rem] mx-auto w-[85%] rounded-lg bg-neutral-300/82 dark:bg-neutral-700 animate-pulse" />
        </div>
        <div class="flex items-end justify-center gap-1.5 sm:gap-2.5 w-full min-w-0">
          <!-- 2e -->
          <div class="flex min-w-0 flex-1 max-w-[9.25rem] sm:max-w-[14.375rem] flex-col items-center">
            <div
              class="w-full min-h-[11.5rem] sm:min-h-[12rem] rounded-2xl rounded-b-none border border-neutral-200/80 dark:border-neutral-700/90 bg-white/95 dark:bg-[#131519] shadow-[0_10px_32px_-20px_rgba(15,23,42,0.1)] dark:shadow-none p-2.5 sm:p-3 flex flex-col items-center gap-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-full bg-neutral-400/35 dark:bg-white/15" />
              <div class="h-2 w-16 rounded bg-neutral-400/30 dark:bg-white/12" />
              <div class="h-9 w-full rounded-md bg-neutral-400/28 dark:bg-white/10" />
              <div class="h-5 w-3/4 max-w-[9rem] rounded bg-neutral-400/25 dark:bg-white/10" />
              <div class="flex flex-wrap justify-center gap-1.5 w-full px-0.5">
                <span v-for="j in 5" :key="'p2-' + j" class="h-3 w-7 rounded bg-neutral-400/28 dark:bg-white/10" />
              </div>
              <div class="h-5 w-[72%] max-w-[6.5rem] rounded-full bg-neutral-400/22 dark:bg-white/10" />
            </div>
            <div class="w-full h-14 sm:h-16 rounded-b-lg border-t border-neutral-300/60 dark:border-white/12 bg-neutral-300/55 dark:bg-white/12 animate-pulse" />
          </div>
          <!-- 1er -->
          <div class="flex min-w-0 flex-1 max-w-[9.25rem] sm:max-w-[14.375rem] flex-col items-center">
            <div
              class="w-full min-h-[13rem] sm:min-h-[14rem] rounded-2xl rounded-b-none border border-neutral-200/65 dark:border-neutral-700/90 bg-[#1a1b20]/90 dark:bg-[#131519] p-2.5 sm:p-3 flex flex-col items-center gap-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-full bg-neutral-400/40 dark:bg-white/18" />
              <div class="h-2 w-16 rounded bg-neutral-400/32 dark:bg-white/14" />
              <div class="h-10 w-full rounded-md bg-neutral-400/30 dark:bg-white/12" />
              <div class="h-6 w-4/5 max-w-[10rem] rounded bg-neutral-400/28 dark:bg-white/11" />
              <div class="flex flex-wrap justify-center gap-1.5 w-full px-0.5">
                <span v-for="j in 5" :key="'p1-' + j" class="h-3 w-7 rounded bg-neutral-400/28 dark:bg-white/10" />
              </div>
              <div class="h-5 w-[72%] max-w-[6.5rem] rounded-full bg-neutral-400/25 dark:bg-white/10" />
            </div>
            <div
              class="w-full h-[5.625rem] sm:h-24 rounded-b-lg border-t border-neutral-300/50 dark:border-white/12 bg-neutral-300/50 dark:bg-white/14 animate-pulse"
            />
          </div>
          <!-- 3e -->
          <div class="flex min-w-0 flex-1 max-w-[9.25rem] sm:max-w-[14.375rem] flex-col items-center">
            <div
              class="w-full min-h-[10.5rem] sm:min-h-[11rem] rounded-2xl rounded-b-none border border-neutral-200/80 dark:border-neutral-700/90 bg-white/95 dark:bg-[#131519] shadow-[0_10px_32px_-20px_rgba(120,74,42,0.1)] dark:shadow-none p-2.5 sm:p-3 flex flex-col items-center gap-2 animate-pulse"
            >
              <div class="h-12 w-12 rounded-full bg-neutral-400/35 dark:bg-white/15" />
              <div class="h-2 w-16 rounded bg-neutral-400/30 dark:bg-white/12" />
              <div class="h-8 w-full rounded-md bg-neutral-400/28 dark:bg-white/10" />
              <div class="h-5 w-2/3 max-w-[8rem] rounded bg-neutral-400/25 dark:bg-white/10" />
              <div class="flex flex-wrap justify-center gap-1.5 w-full px-0.5">
                <span v-for="j in 5" :key="'p3-' + j" class="h-3 w-7 rounded bg-neutral-400/28 dark:bg-white/10" />
              </div>
              <div class="h-5 w-[70%] max-w-[6rem] rounded-full bg-neutral-400/22 dark:bg-white/10" />
            </div>
            <div class="w-full h-10 sm:h-14 rounded-b-lg border-t border-neutral-300/50 dark:border-white/12 bg-neutral-300/40 dark:bg-white/11 animate-pulse" />
          </div>
        </div>
      </div>

      <div class="grid gap-3 w-full min-w-0 max-w-full overflow-x-hidden mb-4">
        <div
          v-for="i in skeletonListRows"
          :key="'sk-row-' + i"
          class="rounded-2xl border border-neutral-200/60 dark:border-neutral-700/80 bg-white dark:bg-neutral-900 p-4 flex items-center gap-3 min-h-[7.5rem] sm:min-h-[9rem] animate-pulse"
        >
          <div class="w-11 h-11 shrink-0 rounded-full bg-neutral-200/90 dark:bg-neutral-700 animate-pulse" />
          <div class="w-14 h-14 shrink-0 rounded-xl bg-neutral-200/85 dark:bg-neutral-700 self-center animate-pulse" />
          <div class="min-w-0 flex-1 py-0.5 space-y-2 w-full">
            <div class="h-[1.05rem] w-full rounded bg-neutral-200/90 dark:bg-neutral-700 animate-pulse" />
            <div class="h-3.5 w-full max-w-[14rem] rounded bg-neutral-200/80 dark:bg-neutral-800 animate-pulse" />
            <div class="h-4 w-40 max-w-[50%] rounded bg-neutral-200/82 dark:bg-neutral-800 animate-pulse" />
            <div class="mt-1.5 flex flex-wrap gap-1.5 min-w-0">
              <span
                v-for="j in 5"
                :key="j"
                class="h-[1.125rem] w-9 shrink-0 rounded-md bg-neutral-100 dark:bg-neutral-800 ring-1 ring-neutral-200/80 dark:ring-neutral-700/80 animate-pulse"
              />
            </div>
            <div class="h-4 w-[85%] max-w-[14rem] rounded-full bg-neutral-200/75 dark:bg-neutral-800 sm:hidden" />
          </div>
          <div class="hidden sm:flex shrink-0 min-w-[5.5rem] flex-col items-end gap-2 self-center">
            <div class="h-3 w-16 rounded bg-neutral-200/75 dark:bg-neutral-800 animate-pulse" />
            <div class="h-3.5 w-full max-w-[5.5rem] rounded-md bg-neutral-200/80 dark:bg-neutral-700 animate-pulse" />
            <div class="h-3 w-[90%] max-w-[5rem] rounded-full bg-neutral-200/72 dark:bg-neutral-800 animate-pulse" />
          </div>
        </div>
      </div>
    </template>

    <template v-else>
      <div
        class="w-full min-w-0 rounded-3xl border border-white/20 bg-gradient-to-br from-[#d946ef] via-[#db2777] to-[#7e22ce] text-white p-5 sm:p-7 mb-6 shadow-[0_18px_60px_-22px_rgba(126,34,206,0.7)] dark:border-white/10 dark:from-[#5b1a7a] dark:via-[#7c1d4f] dark:to-[#4c1d6e] dark:shadow-[0_18px_60px_-22px_rgba(0,0,0,0.55)]"
      >
        <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 w-full min-w-0">
          <div class="min-w-0 flex-1 space-y-2">
            <p class="text-[11px] sm:text-xs uppercase tracking-[0.22em] text-pink-100/95 dark:text-pink-200/85 font-semibold">
              {{ t('contest.brand') }}
            </p>
            <h1 class="text-2xl sm:text-3xl font-black tracking-tight text-white drop-shadow-[0_1px_18px_rgba(0,0,0,0.18)]">
              {{ t('contest.title') }}
            </h1>
            <p class="text-sm text-pink-100/95 dark:text-pink-100/88 leading-relaxed max-w-2xl">
              {{ t('contest.subtitle') }}
            </p>
            <p
              class="text-[11px] sm:text-[11.5px] text-pink-100/82 dark:text-pink-100/72 font-medium leading-snug max-w-2xl border-l-[3px] border-white/28 pl-3.5 py-0.5 rounded-r-md bg-white/[0.06]"
            >
              {{ t('contest.live.rankedFotosHint', { count: displayPins }) }}
            </p>
          </div>
          <div
            class="flex flex-row flex-nowrap items-center gap-2 sm:gap-2.5 text-[11px] sm:text-xs w-full sm:w-auto sm:justify-end min-w-0 overflow-x-auto pb-0.5 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          >
            <span
              v-if="contestState.connected"
              class="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-full bg-emerald-400/20 text-white font-bold whitespace-nowrap shrink-0 ring-1 ring-emerald-300/35 shadow-[0_2px_14px_-6px_rgba(16,185,129,0.65)] backdrop-blur-[2px]"
            >
              <i class="fa-solid fa-tower-broadcast text-[15px] leading-none text-emerald-100" aria-hidden="true" />
              {{ t('contest.live') }}
            </span>
            <router-link
              to="/contest/history"
              class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white font-semibold whitespace-nowrap shrink-0 ring-1 ring-white/25 hover:bg-white/25 hover:ring-white/40 transition shadow-[0_2px_14px_-8px_rgba(0,0,0,0.45)] backdrop-blur-sm"
            >
              <i class="fa-solid fa-clock-rotate-left text-[15px] leading-none opacity-95" aria-hidden="true" />
              {{ t('contest.live.historyLink') }}
            </router-link>
            <button
              type="button"
              class="inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-full bg-white/15 text-white font-semibold whitespace-nowrap shrink-0 ring-1 ring-white/25 hover:bg-white/25 hover:ring-white/40 transition shadow-[0_2px_14px_-8px_rgba(0,0,0,0.45)] backdrop-blur-sm active:scale-[0.98]"
              @click="refreshContestNow"
            >
              <i class="fa-solid fa-arrows-rotate text-[15px] leading-none opacity-95" aria-hidden="true" />
              {{ t('contest.refresh') }}
            </button>
          </div>
        </div>
        <div class="mt-5">
          <ContestCountdown :remaining-ms="contestRemainingMs" surface="hero" />
        </div>
        <div class="grid grid-cols-2 gap-3 mt-4 w-full min-w-0">
          <div
            class="rounded-2xl px-3.5 py-3 min-w-0 bg-black/28 border border-white/14 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:bg-black/45 dark:border-white/10 flex gap-3 items-start"
          >
            <i
              class="fa-solid fa-list-ol text-[22px] shrink-0 rounded-xl bg-white/10 p-2 ring-1 ring-white/15 text-pink-50"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <p class="text-[11px] uppercase tracking-wide text-pink-100/78 dark:text-pink-100/65 line-clamp-2">{{ t('contest.stats.rankedFotos') }}</p>
              <p class="text-xl font-black mt-0.5 tabular-nums">{{ topPins.length }}</p>
            </div>
          </div>
          <div
            class="rounded-2xl px-3.5 py-3 min-w-0 bg-black/28 border border-white/14 shadow-[inset_0_1px_0_0_rgba(255,255,255,0.04)] dark:bg-black/45 dark:border-white/10 flex gap-3 items-start"
          >
            <i
              class="fa-solid fa-award text-[22px] shrink-0 rounded-xl bg-white/10 p-2 ring-1 ring-white/15 text-pink-50"
              aria-hidden="true"
            />
            <div class="min-w-0 flex-1">
              <p class="text-[11px] uppercase tracking-wide text-pink-100/78 dark:text-pink-100/65 line-clamp-2">{{ t('contest.stats.rewardsSlots') }}</p>
              <p class="text-xl font-black mt-0.5 tabular-nums">{{ rewardsCount }}</p>
              <p class="text-[10px] text-pink-100/72 dark:text-pink-100/60 mt-0.5 leading-snug line-clamp-3">{{ t('contest.stats.rewardsSlotsHint') }}</p>
            </div>
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

      <LeaderboardPodiumTopThree
        variant="foto"
        :rank2="podiumRank2"
        :rank1="podiumRank1"
        :rank3="podiumRank3"
        :you-creator-id="currentUser?.id ?? null"
      />

      <p v-if="contestState.error" class="mb-4 rounded-2xl border border-rose-200 bg-rose-50 text-rose-700 px-4 py-3 w-full min-w-0">
        {{ contestState.error }}
      </p>

      <div class="grid gap-3 w-full min-w-0 max-w-full overflow-x-hidden">
        <LeaderboardFotoRow
          v-for="(row, idx) in pinsAfterPodium"
          :key="row.foto_id"
          :row="row"
          :index="idx + 3"
          :is-you="showYouHighlightForRow(row)"
        />
      </div>
    </template>

    <div
      v-if="!contestState.loading && showMyRankDock && viewerPin && viewer?.rank != null"
      class="fixed bottom-0 left-0 right-0 z-[60] px-4 pb-[env(safe-area-inset-bottom,0px)] pt-3 pointer-events-none"
      aria-label="Ma position hors top affiché"
    >
      <div class="w-full min-w-0 max-w-6xl mx-auto pointer-events-auto">
        <router-link
          :to="`/foto/${encodeURIComponent(viewerPin.foto_slug)}`"
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
