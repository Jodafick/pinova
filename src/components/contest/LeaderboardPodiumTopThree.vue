<script setup lang="ts">
import { computed } from 'vue'
import { RouterLink } from 'vue-router'

import ContestPinMetrics from './ContestPinMetrics.vue'
import { useI18n } from '../../i18n'
import type { ContestPinRow } from '../../types/contest'
import type { ReferralLeaderboardRowDto } from '../../types/referral'

const props = withDefaults(
  defineProps<{
    variant: 'pin' | 'referral'
    rank2: ContestPinRow | ReferralLeaderboardRowDto | null
    rank1: ContestPinRow | ReferralLeaderboardRowDto | null
    rank3: ContestPinRow | ReferralLeaderboardRowDto | null
    youCreatorId?: number | null
    youReferrerId?: number | null
  }>(),
  { youCreatorId: null, youReferrerId: null },
)

const { t } = useI18n()

type PodiumRank = 1 | 2 | 3
type PodiumRow = ContestPinRow | ReferralLeaderboardRowDto

const columns = computed(() => [
  { podiumRank: 2 as PodiumRank, row: props.rank2 },
  { podiumRank: 1 as PodiumRank, row: props.rank1 },
  { podiumRank: 3 as PodiumRank, row: props.rank3 },
])

const showPodium = computed(() => columns.value.some((c) => c.row != null))

function isPinRow(r: PodiumRow | null): r is ContestPinRow {
  return r != null && 'pin_id' in r
}

function rowScore(r: PodiumRow): number {
  return isPinRow(r) ? r.score : r.total_score
}

function pinTitle(r: PodiumRow): string {
  if (isPinRow(r)) return r.pin_title || t('contest.row.pinPlaceholder')
  return `@${r.username}`
}

function pinSubtitle(r: PodiumRow): string {
  if (isPinRow(r)) return `@${r.creator_username}`
  return ''
}

function trendFor(r: PodiumRow | null): 'neutral' | { dir: 'up' | 'down'; n: number } {
  if (r == null) return 'neutral'
  const prev = r.previous_rank
  const rank = r.rank
  if (prev == null || prev <= 0) return 'neutral'
  const delta = prev - rank
  if (delta === 0) return 'neutral'
  if (delta > 0) return { dir: 'up', n: delta }
  return { dir: 'down', n: -delta }
}

function trendBadgeTone(r: PodiumRow | null): 'neutral' | 'up' | 'down' {
  const tr = trendFor(r)
  if (tr === 'neutral') return 'neutral'
  return tr.dir
}

function podiumAnimDelay(idx: number): string {
  return `${0.15 + idx * 0.15}s`
}

function placeLabel(rank: PodiumRank): string {
  if (rank === 1) return t('contest.podium.place1')
  if (rank === 2) return t('contest.podium.place2')
  return t('contest.podium.place3')
}

function medalFaClass(rank: PodiumRank): string {
  if (rank === 1) return 'fa-trophy'
  return 'fa-medal'
}

function trendText(r: PodiumRow | null): string {
  const tr = trendFor(r)
  if (tr === 'neutral') return t('contest.podium.stable')
  if (tr.dir === 'up') return t('contest.podium.upPlaces', { n: tr.n })
  return t('contest.podium.downPlaces', { n: tr.n })
}

function isYouRow(r: PodiumRow | null): boolean {
  if (r == null) return false
  if (props.variant === 'pin' && isPinRow(r)) {
    return props.youCreatorId != null && r.creator_id === props.youCreatorId
  }
  if (props.variant === 'referral' && !isPinRow(r)) {
    return props.youReferrerId != null && r.referrer_id === props.youReferrerId
  }
  return false
}

function linkForRow(r: PodiumRow | null) {
  if (props.variant !== 'pin' || !isPinRow(r)) return null
  return `/pin/${encodeURIComponent(r.pin_slug)}`
}

function cardRingClass(rank: PodiumRank): string {
  if (rank === 1)
    return 'text-amber-700 dark:text-[#FFDF99] ring-[rgba(180,135,42,0.35)] dark:ring-[rgba(255,210,120,0.55)] bg-amber-50/90 dark:bg-[rgba(255,200,90,0.2)]'
  if (rank === 2)
    return 'text-slate-600 dark:text-[#F0F6FF] ring-[rgba(100,116,139,0.35)] dark:ring-[rgba(200,215,235,0.55)] bg-slate-100/95 dark:bg-[rgba(190,205,225,0.18)]'
  return 'text-amber-900 dark:text-[#FFCF94] ring-[rgba(139,90,43,0.35)] dark:ring-[rgba(255,180,120,0.5)] bg-amber-100/85 dark:bg-[rgba(230,150,95,0.18)]'
}

function scoreClass(rank: PodiumRank): string {
  if (rank === 1) return 'text-amber-800 dark:text-[#FFE9A8]'
  if (rank === 2) return 'text-slate-700 dark:text-[#F8FAFC]'
  return 'text-amber-950 dark:text-[#FFD2A8]'
}

function podiumBlockClass(rank: PodiumRank): string {
  if (rank === 1) {
    return 'h-[5.625rem] sm:h-[6rem] bg-[rgba(200,146,42,0.34)] dark:bg-[rgba(255,190,75,0.5)] border-t border-[rgba(200,146,42,0.42)] dark:border-[rgba(255,210,130,0.65)]'
  }
  if (rank === 2) {
    return 'h-[3.625rem] sm:h-16 bg-[rgba(142,155,170,0.22)] dark:bg-[rgba(200,215,235,0.35)] border-t border-[rgba(142,155,170,0.34)] dark:border-[rgba(220,230,245,0.55)]'
  }
  return 'h-10 sm:h-[2.375rem] bg-[rgba(139,90,43,0.22)] dark:bg-[rgba(255,160,85,0.4)] border-t border-[rgba(139,90,43,0.34)] dark:border-[rgba(255,195,130,0.55)]'
}

function cardBorderClass(rank: PodiumRank, you: boolean): string {
  const base =
    'rounded-2xl rounded-b-none border bg-white dark:bg-[#131519] transition duration-200 hover:-translate-y-1'
  const youRing = you ? ' ring-2 ring-pink-500/70 ring-offset-2 ring-offset-white dark:ring-offset-[#0c0d0f]' : ''
  if (rank === 1)
    return `${base} border-[rgba(180,135,42,0.35)] dark:border-[rgba(255,205,110,0.55)] shadow-[0_14px_48px_-20px_rgba(200,146,42,0.22)] dark:shadow-[0_0_48px_rgba(255,200,80,0.18)]${youRing}`
  if (rank === 2)
    return `${base} border-[rgba(142,155,170,0.45)] dark:border-[rgba(210,225,245,0.45)] shadow-[0_12px_40px_-20px_rgba(100,116,139,0.14)] dark:shadow-[0_0_40px_rgba(200,215,235,0.12)]${youRing}`
  return `${base} border-[rgba(139,90,43,0.38)] dark:border-[rgba(255,175,110,0.5)] shadow-[0_12px_40px_-20px_rgba(120,74,42,0.12)] dark:shadow-[0_0_42px_rgba(255,150,80,0.14)]${youRing}`
}
</script>

<template>
  <section
    v-if="showPodium"
    class="relative z-[1] w-full max-w-[49rem] mx-auto mb-6 sm:mb-8 px-1 sm:px-2 text-neutral-900 dark:text-[#F0EDE8]"
    aria-label="Top 3"
  >
    <div
      class="pointer-events-none absolute -top-24 left-1/2 h-[400px] w-[400px] -translate-x-1/2 rounded-full bg-[rgba(200,146,42,0.08)] blur-[120px]"
      aria-hidden="true"
    />
    <header class="podium-fade mb-6 sm:mb-8 text-center podium-fade-header">
      <p class="podium-dm text-[11px] font-normal uppercase tracking-[0.22em] text-[#C8922A] dark:text-[#FFC94D]">
        {{ t('contest.podium.eyebrow') }}
      </p>
      <h2
        class="podium-bebas text-[clamp(2.5rem,7vw,4.25rem)] leading-none tracking-[0.05em] text-transparent bg-clip-text bg-gradient-to-br from-amber-900 via-amber-700 to-yellow-700 dark:from-[#FFFDF8] dark:via-[#FFEFC0] dark:to-[#FFD875]"
      >
        {{ t('contest.podium.title') }}
      </h2>
    </header>

    <div class="relative z-[2] flex items-end justify-center gap-1.5 sm:gap-2.5 w-full min-w-0 max-w-full">
      <div
        v-for="(col, idx) in columns"
        :key="'p-' + col.podiumRank"
        class="podium-fade flex min-w-0 flex-1 max-w-[9.25rem] sm:max-w-[14.375rem] flex-col items-center"
        :style="{ animationDelay: podiumAnimDelay(idx) }"
      >
        <component
          :is="linkForRow(col.row) ? RouterLink : 'div'"
          v-bind="linkForRow(col.row) ? { to: linkForRow(col.row) } : {}"
          class="group relative w-full overflow-hidden px-2.5 sm:px-3.5 pt-4 pb-3.5 text-center outline-none focus-visible:ring-2 focus-visible:ring-pink-500/80"
          :class="cardBorderClass(col.podiumRank, isYouRow(col.row))"
        >
          <div
            class="pointer-events-none absolute inset-0 rounded-2xl rounded-b-none opacity-0 transition-opacity duration-300 group-hover:opacity-100"
            :class="
              col.podiumRank === 1
                ? 'bg-[radial-gradient(ellipse_at_top,rgba(200,146,42,0.08)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,200,90,0.2)_0%,transparent_72%)]'
                : col.podiumRank === 2
                  ? 'bg-[radial-gradient(ellipse_at_top,rgba(142,155,170,0.07)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(210,225,245,0.16)_0%,transparent_72%)]'
                  : 'bg-[radial-gradient(ellipse_at_top,rgba(139,90,43,0.07)_0%,transparent_70%)] dark:bg-[radial-gradient(ellipse_at_top,rgba(255,170,100,0.18)_0%,transparent_72%)]'
            "
          />
          <template v-if="col.row">
            <div
              class="relative z-[1] mx-auto flex h-12 w-12 shrink-0 items-center justify-center rounded-full border text-[22px] leading-none ring-1"
              :class="cardRingClass(col.podiumRank)"
              aria-hidden="true"
            >
              <i class="fa-solid text-[22px] leading-none" :class="medalFaClass(col.podiumRank)" aria-hidden="true" />
            </div>
            <p
              class="relative z-[1] mb-2 mt-2 podium-dm text-[10px] font-light uppercase tracking-[0.18em] text-neutral-500 dark:text-[rgba(240,237,232,0.45)]"
            >
              {{ placeLabel(col.podiumRank) }}
              <span
                v-if="isYouRow(col.row)"
                class="ml-1.5 rounded-full bg-pink-500/[0.16] px-1.5 py-px text-[9px] font-semibold text-pink-800 dark:bg-pink-500/25 dark:text-pink-200"
              >
                {{ t('contest.live.youBadge') }}
              </span>
            </p>
            <p
              class="relative z-[1] min-h-[2.125rem] podium-dm text-[11px] font-medium leading-snug text-neutral-900 dark:text-[#F0EDE8] sm:text-[13px] line-clamp-2 px-0.5"
            >
              {{ pinTitle(col.row) }}
            </p>
            <p
              v-if="pinSubtitle(col.row)"
              class="relative z-[1] mb-3.5 mt-1 podium-dm text-[11px] font-light text-neutral-500 dark:text-[rgba(240,237,232,0.45)] truncate px-0.5"
            >
              {{ pinSubtitle(col.row) }}
            </p>
            <div v-else class="mb-3.5" />

            <div class="relative z-[1] mb-3">
              <span class="podium-bebas text-[clamp(1.85rem,6vw,2.375rem)] leading-none tabular-nums" :class="scoreClass(col.podiumRank)">
                {{ rowScore(col.row).toFixed(2) }}
              </span>
              <p class="podium-dm text-[10px] font-light uppercase tracking-[0.2em] text-neutral-500 dark:text-[rgba(240,237,232,0.45)]">
                {{ t('contest.podium.pointsUnit') }}
              </p>
            </div>
            <div
              class="relative z-[1] mx-auto mb-2.5 h-px w-7 bg-[rgba(255,255,255,0.06)]"
              :class="
                col.podiumRank === 1
                  ? 'bg-[rgba(200,146,42,0.25)]'
                  : col.podiumRank === 2
                    ? 'bg-[rgba(142,155,170,0.2)]'
                    : 'bg-[rgba(139,90,43,0.2)]'
              "
            />
            <ContestPinMetrics
              v-if="variant === 'pin' && isPinRow(col.row)"
              class="relative z-[1] podium-dm"
              variant="podium"
              :likes="col.row.likes"
              :views="col.row.views"
              :shares="col.row.shares"
              :saves="col.row.saves"
              :comments="col.row.comments"
            />
            <div v-else-if="col.row && variant === 'referral'" class="relative z-[1] flex justify-center">
              <span class="flex items-center gap-1 podium-dm text-[11px] font-light text-neutral-500 dark:text-[rgba(240,237,232,0.45)]">
                <i class="fa-solid fa-bolt text-[12px] leading-none" aria-hidden="true" />
                {{ t('referral.live.colScore') }}
              </span>
            </div>
            <span
              class="relative z-[1] mt-2.5 inline-block rounded-full px-2.5 py-0.5 podium-dm text-[10px] tracking-wide"
              :class="
                trendBadgeTone(col.row) === 'neutral'
                  ? 'border border-neutral-200/90 bg-neutral-100 text-neutral-600 dark:border-[rgba(255,255,255,0.06)] dark:bg-[rgba(255,255,255,0.04)] dark:text-[rgba(240,237,232,0.45)]'
                  : trendBadgeTone(col.row) === 'up'
                    ? 'border border-[rgba(59,109,17,0.35)] bg-[rgba(59,109,17,0.12)] text-emerald-800 dark:border-[rgba(59,109,17,0.3)] dark:bg-[rgba(59,109,17,0.18)] dark:text-[#7EC850]'
                    : 'border border-rose-200/90 bg-rose-50 text-rose-700 dark:border-[rgba(180,50,50,0.35)] dark:bg-[rgba(180,50,50,0.15)] dark:text-[#f87171]'
              "
            >
              {{ trendBadgeTone(col.row) === 'neutral' ? `— ${trendText(col.row)}` : trendText(col.row) }}
            </span>
          </template>
          <template v-else>
            <div class="py-10 podium-dm text-sm text-neutral-400 dark:text-[rgba(240,237,232,0.28)]">
              —
            </div>
          </template>
        </component>
        <div class="relative z-[1] w-full flex items-center justify-center" :class="podiumBlockClass(col.podiumRank)">
          <span class="podium-bebas text-[1.75rem] text-neutral-900/35 dark:text-white/20">{{ col.podiumRank }}</span>
        </div>
      </div>
    </div>
  </section>
</template>

<style scoped>
.podium-dm {
  font-family: 'DM Sans', ui-sans-serif, system-ui, sans-serif;
}
.podium-bebas {
  font-family: 'Bebas Neue', sans-serif;
}

/* Animations : pas de utility Tailwind — les @keyframes scoped sont renommés par Vue et doivent correspondre. */
.podium-fade {
  animation: fadeUpPodium 0.7s ease forwards;
  opacity: 0;
}
.podium-fade-header {
  animation-duration: 0.6s;
}

@keyframes fadeUpPodium {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
