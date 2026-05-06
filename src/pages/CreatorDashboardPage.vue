<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CreatorDashboardSkeleton from '../components/CreatorDashboardSkeleton.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import { displayInitials } from '../utils/displayInitials'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { useI18n } from '../i18n'

const { t, currentLang } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated, fetchCurrentUser } = useAuth()
const { fetchCreatorStats, fetchCreatorWeeklyStats, fetchCreatorEngagement } = usePins()

const loading = ref(true)
const errorMsg = ref('')
const creatorTotals = ref<Record<string, number> | null>(null)
const topAllTime = ref<
  { id: number; slug: string; title: string; likes: number; saves: number; views: number }[]
>([])
type PeriodEngagement = {
  likes_period: number
  saves_period: number
  comments_period: number
  distinct_viewers_period: number
}

const weeklyPins = ref<
  {
    id: number
    slug: string
    title: string
    views_week: number
    likes_week?: number
    saves_week?: number
    comments_week?: number
    thumbnail_url: string | null
  }[]
>([])
const weeklyMeta = ref<{
  total_view_events_period: number
  period_days: number
  period_engagement?: PeriodEngagement | null
} | null>(null)
const topPinsHasMore = ref(false)
const weeklyPinsHasMore = ref(false)
const topPinsLoadingMore = ref(false)
const weeklyPinsLoadingMore = ref(false)
const topPinsPage = ref(1)
const weeklyPinsPage = ref(1)
const TOP_PAGE_SIZE = 10
const WEEKLY_PAGE_SIZE = 10
const AUDIENCE_PERIOD_DAYS = 30

const isPro = computed(() => currentUser.value?.subscription?.plan === 'pro')

const audienceOpen = ref(false)
const audienceKey = ref<TotalKey | null>(null)
const audienceLoading = ref(false)
const audienceErr = ref('')
type AudienceActor = {
  username: string
  display_name: string
  avatar_url: string
  avatar_color: string
  count: number
}
const audiencePayload = ref<{
  action: string
  period_days: number
  total_actions: number
  distinct_actors: number
  top_actors: AudienceActor[]
} | null>(null)

type TotalKey = 'pins' | 'views' | 'saves' | 'likes' | 'comments'

type KpiSpec = {
  key: TotalKey
  labelKey: string
  icon: string
  ring: string
  border: string
  darkBorder: string
  iconWrap: string
  darkIconWrap: string
  subtle: string
  darkSubtle: string
  accent: string
}

const kpiSpecs: readonly KpiSpec[] = [
  {
    key: 'pins',
    labelKey: 'creator.kpiPins',
    icon: 'push_pin',
    ring: 'ring-violet-500/20',
    border: 'border-violet-200/90',
    darkBorder: 'dark:border-violet-500/25',
    iconWrap: 'bg-violet-100 text-violet-700',
    darkIconWrap: 'dark:bg-violet-500/20 dark:text-violet-300',
    subtle: 'from-violet-50/95 to-white',
    darkSubtle: 'dark:from-violet-950/50 dark:to-neutral-900',
    accent: 'text-violet-600 dark:text-violet-400',
  },
  {
    key: 'views',
    labelKey: 'creator.kpiViews',
    icon: 'visibility',
    ring: 'ring-sky-500/20',
    border: 'border-sky-200/90',
    darkBorder: 'dark:border-sky-500/25',
    iconWrap: 'bg-sky-100 text-sky-800',
    darkIconWrap: 'dark:bg-sky-500/20 dark:text-sky-300',
    subtle: 'from-sky-50/95 to-white',
    darkSubtle: 'dark:from-sky-950/50 dark:to-neutral-900',
    accent: 'text-sky-600 dark:text-sky-400',
  },
  {
    key: 'saves',
    labelKey: 'creator.kpiSaves',
    icon: 'bookmark',
    ring: 'ring-teal-500/20',
    border: 'border-teal-200/90',
    darkBorder: 'dark:border-teal-500/25',
    iconWrap: 'bg-teal-100 text-teal-800',
    darkIconWrap: 'dark:bg-teal-500/20 dark:text-teal-300',
    subtle: 'from-teal-50/95 to-white',
    darkSubtle: 'dark:from-teal-950/50 dark:to-neutral-900',
    accent: 'text-teal-600 dark:text-teal-400',
  },
  {
    key: 'likes',
    labelKey: 'creator.kpiLikes',
    icon: 'favorite',
    ring: 'ring-rose-500/20',
    border: 'border-rose-200/90',
    darkBorder: 'dark:border-rose-500/25',
    iconWrap: 'bg-rose-100 text-rose-700',
    darkIconWrap: 'dark:bg-rose-500/20 dark:text-rose-300',
    subtle: 'from-rose-50/95 to-white',
    darkSubtle: 'dark:from-rose-950/50 dark:to-neutral-900',
    accent: 'text-rose-600 dark:text-rose-400',
  },
  {
    key: 'comments',
    labelKey: 'creator.kpiComments',
    icon: 'chat_bubble',
    ring: 'ring-amber-500/20',
    border: 'border-amber-200/90',
    darkBorder: 'dark:border-amber-500/25',
    iconWrap: 'bg-amber-100 text-amber-900',
    darkIconWrap: 'dark:bg-amber-500/20 dark:text-amber-300',
    subtle: 'from-amber-50/95 to-white',
    darkSubtle: 'dark:from-amber-950/50 dark:to-neutral-900',
    accent: 'text-amber-600 dark:text-amber-400',
  },
]

const formatStat = (n: number) => {
  if (!Number.isFinite(n)) return '0'
  try {
    return new Intl.NumberFormat(currentLang.value, {
      notation: Math.abs(n) >= 9999 ? 'compact' : 'standard',
      compactDisplay: 'short',
      maximumFractionDigits: Math.abs(n) >= 9999 ? 1 : 0,
    }).format(n)
  } catch {
    return String(Math.round(n))
  }
}

const kpis = computed(() =>
  kpiSpecs.map((s) => {
    const raw = Number(creatorTotals.value?.[s.key] ?? 0)
    return { ...s, label: t(s.labelKey), formatted: formatStat(raw), raw }
  }),
)

const audienceKpiLabel = computed(() => {
  const k = audienceKey.value
  if (!k) return ''
  const row = kpis.value.find((x) => x.key === k)
  return row?.label || ''
})

const periodSummaryLine = computed(() => {
  const pe = weeklyMeta.value?.period_engagement
  const days = weeklyMeta.value?.period_days ?? 7
  const screens = weeklyMeta.value?.total_view_events_period ?? 0
  if (!pe) return ''
  return t('creator.periodSummary', {
    days,
    viewers: pe.distinct_viewers_period,
    likes: pe.likes_period,
    saves: pe.saves_period,
    comments: pe.comments_period,
    screens,
  })
})

function audienceActionParam(key: Exclude<TotalKey, 'pins'>): 'likes' | 'saves' | 'comments' | 'views' {
  return key
}

async function openAudiencePanel(key: TotalKey) {
  if (key === 'pins') {
    const u = currentUser.value?.username
    if (u) await router.push({ path: `/profile/${encodeURIComponent(u)}` })
    return
  }
  audienceKey.value = key
  audienceOpen.value = true
  audienceLoading.value = true
  audienceErr.value = ''
  audiencePayload.value = null
  try {
    const data = await fetchCreatorEngagement({
      action: audienceActionParam(key),
      days: AUDIENCE_PERIOD_DAYS,
      limit: 40,
    })
    audiencePayload.value = data
  } catch {
    audienceErr.value = t('creator.errorLoad')
  } finally {
    audienceLoading.value = false
  }
}

function closeAudiencePanel() {
  audienceOpen.value = false
}

function rankAccent(idx: number) {
  if (idx === 0) return 'bg-gradient-to-br from-amber-300/95 via-amber-200 to-yellow-100 text-amber-950 ring-2 ring-amber-400/90 shadow-md shadow-amber-200/60 dark:from-amber-500/40 dark:via-amber-400/25 dark:to-amber-300/10 dark:text-amber-200 dark:ring-amber-500/50 dark:shadow-amber-900/30'
  if (idx === 1) return 'bg-gradient-to-br from-neutral-300/95 to-neutral-100 text-neutral-700 ring-2 ring-neutral-400/60 shadow-sm dark:from-neutral-500/30 dark:to-neutral-700/20 dark:text-neutral-300 dark:ring-neutral-500/40'
  if (idx === 2) return 'bg-gradient-to-br from-orange-300/95 to-orange-100 text-orange-950 ring-2 ring-orange-400/60 shadow-sm dark:from-orange-500/35 dark:to-orange-700/15 dark:text-orange-300 dark:ring-orange-500/40'
  return 'bg-white text-neutral-700 ring-2 ring-neutral-200/90 shadow-sm dark:bg-neutral-800 dark:text-neutral-300 dark:ring-neutral-700'
}

const load = async () => {
  if (!isAuthenticated.value || !isPro.value) {
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  topPinsHasMore.value = false
  weeklyPinsHasMore.value = false
  topPinsPage.value = 1
  weeklyPinsPage.value = 1
  try {
    const [all, weekly] = await Promise.all([
      fetchCreatorStats({ top_page: 1, top_page_size: TOP_PAGE_SIZE }),
      fetchCreatorWeeklyStats(7, { page: 1, page_size: WEEKLY_PAGE_SIZE }),
    ])
    creatorTotals.value = all?.totals || null
    topAllTime.value = all?.top_pins || []
    weeklyPins.value = weekly?.top_pins || []
    weeklyMeta.value = {
      total_view_events_period: weekly?.total_view_events_period ?? 0,
      period_days: weekly?.period_days ?? 7,
      period_engagement: weekly?.period_engagement ?? null,
    }
    topPinsHasMore.value = !!all?.top_pins_pagination?.has_next
    weeklyPinsHasMore.value = !!weekly?.pagination?.has_next
  } catch {
    errorMsg.value = t('creator.errorLoad')
    creatorTotals.value = null
    topAllTime.value = []
    weeklyPins.value = []
    weeklyMeta.value = null
  } finally {
    loading.value = false
  }
}

const loadMoreTopPins = async () => {
  if (!topPinsHasMore.value || topPinsLoadingMore.value) return
  const nextPage = topPinsPage.value + 1
  topPinsLoadingMore.value = true
  try {
    const all = await fetchCreatorStats({ top_page: nextPage, top_page_size: TOP_PAGE_SIZE })
    const chunk = all?.top_pins || []
    const seen = new Set(topAllTime.value.map((p) => p.id))
    for (const p of chunk) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        topAllTime.value.push(p)
      }
    }
    topPinsPage.value = nextPage
    topPinsHasMore.value = !!all?.top_pins_pagination?.has_next
  } finally {
    topPinsLoadingMore.value = false
  }
}

const loadMoreWeeklyPins = async () => {
  if (!weeklyPinsHasMore.value || weeklyPinsLoadingMore.value) return
  const nextPage = weeklyPinsPage.value + 1
  weeklyPinsLoadingMore.value = true
  try {
    const weekly = await fetchCreatorWeeklyStats(7, { page: nextPage, page_size: WEEKLY_PAGE_SIZE })
    const chunk = weekly?.top_pins || []
    const seen = new Set(weeklyPins.value.map((p) => p.id))
    for (const p of chunk) {
      if (!seen.has(p.id)) {
        seen.add(p.id)
        weeklyPins.value.push(p)
      }
    }
    weeklyPinsPage.value = nextPage
    weeklyPinsHasMore.value = !!weekly?.pagination?.has_next
  } finally {
    weeklyPinsLoadingMore.value = false
  }
}

onMounted(async () => {
  await fetchCurrentUser({ silent: true }).catch(() => undefined)
  if (!isAuthenticated.value) {
    loading.value = false
    router.replace('/login')
    return
  }
  if (!isPro.value) {
    loading.value = false
    router.replace('/premium')
    return
  }
  void load()
})
</script>

<template>
  <main
    class="min-h-[calc(100vh-6rem)] sm:min-h-[calc(100vh-8rem)]
           bg-gradient-to-b from-violet-50/40 via-white to-neutral-50/80
           dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900"
  >
    <div class="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 lg:py-12">

      <!-- Loading skeleton -->
      <div v-if="loading" aria-busy="true">
        <span class="sr-only">{{ t('app.loading') }}</span>
        <CreatorDashboardSkeleton />
      </div>

      <template v-else>

        <!-- ── Breadcrumb / nav ─────────────────────────────────── -->
        <nav
          class="flex flex-wrap gap-3 items-center justify-between mb-8 sm:mb-10"
          aria-label="breadcrumb"
        >
          <router-link
            to="/"
            class="inline-flex items-center gap-2 text-sm font-semibold
                   text-neutral-600 dark:text-neutral-400
                   hover:text-pink-600 dark:hover:text-pink-400
                   transition-colors rounded-xl px-3 py-2 -ml-1
                   hover:bg-white/80 dark:hover:bg-neutral-800/80
                   border border-transparent
                   hover:border-neutral-200/80 dark:hover:border-neutral-700/80"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">home</span>
            {{ t('nav.home') }}
          </router-link>

          <router-link
            to="/create"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold
                   bg-white dark:bg-neutral-900
                   text-neutral-900 dark:text-neutral-100
                   border border-neutral-200 dark:border-neutral-700
                   shadow-sm shadow-neutral-900/10 dark:shadow-black/30
                   hover:bg-neutral-50 dark:hover:bg-neutral-800
                   transition-colors
                   focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2
                   focus-visible:outline-pink-500"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            {{ t('nav.create') }}
          </router-link>
        </nav>

        <!-- ── Hero banner ─────────────────────────────────────── -->
        <div class="relative overflow-hidden rounded-[1.65rem] sm:rounded-[2rem]
                    bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-900
                    dark:from-fuchsia-700 dark:via-purple-800 dark:to-indigo-950
                    text-white shadow-2xl shadow-purple-950/35
                    ring-1 ring-black/10 dark:ring-white/5
                    mb-10 sm:mb-12 isolate">

          <!-- Decorative blobs -->
          <div class="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/12 blur-3xl" aria-hidden="true" />
          <div class="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl" aria-hidden="true" />
          <div class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,_transparent_48%,rgba(255,255,255,0.05)_72%,transparent)]" aria-hidden="true" />

          <div class="relative p-6 sm:p-9 md:p-10 flex flex-col lg:flex-row lg:items-end gap-8 lg:gap-12 lg:justify-between">
            <div class="flex gap-4 sm:gap-6 min-w-0 flex-1">
              <!-- Icon -->
              <div
                class="hidden sm:flex size-14 md:size-[4.5rem] shrink-0 rounded-[1rem] md:rounded-2xl
                       bg-white/12 backdrop-blur-md items-center justify-center
                       ring-2 ring-white/25 shadow-inner"
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[32px] md:text-[38px] text-white/95">insights</span>
              </div>
              <!-- Heading -->
              <header class="min-w-0 flex-1">
                <p class="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-white/70 mb-2 sm:mb-3">
                  {{ t('creator.badge') }}
                </p>
                <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3 sm:mb-4 drop-shadow-sm">
                  {{ t('creator.title') }}
                </h1>
                <p class="text-sm sm:text-[15px] leading-relaxed text-white/80 max-w-2xl">
                  {{ t('creator.subtitle') }}
                </p>
              </header>
            </div>

            <!-- Settings CTA -->
            <div class="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto lg:max-w-xs">
              <router-link
                to="/settings"
                class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5
                       text-sm font-semibold
                       bg-white/12 hover:bg-white/20
                       backdrop-blur-md border border-white/25
                       text-white transition-colors text-center"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">tune</span>
                {{ t('nav.settings') }}
              </router-link>
            </div>
          </div>
        </div>

        <!-- ── Error state ──────────────────────────────────────── -->
        <div
          v-if="errorMsg"
          class="mb-10 rounded-2xl border
                 border-rose-200/90 dark:border-rose-800/60
                 bg-rose-50/90 dark:bg-rose-950/30
                 px-5 py-6 sm:px-7 sm:py-8 text-center shadow-sm"
          role="alert"
        >
          <span class="material-symbols-outlined text-rose-500 dark:text-rose-400 text-[40px] mb-3 inline-block" aria-hidden="true">error</span>
          <p class="text-sm sm:text-base text-rose-900 dark:text-rose-300 font-medium">{{ errorMsg }}</p>
          <button
            type="button"
            class="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5
                   text-sm font-bold
                   bg-rose-600 dark:bg-rose-500 text-white
                   hover:bg-rose-500 dark:hover:bg-rose-400
                   transition-colors"
            @click="load"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            {{ t('creator.retry') }}
          </button>
        </div>

        <!-- ── KPI Totals ───────────────────────────────────────── -->
        <section id="totaux" aria-labelledby="creator-totals-heading" class="mb-10 sm:mb-12 scroll-mt-28">
          <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3 mb-5 sm:mb-6">
            <h2
              id="creator-totals-heading"
              class="text-xl sm:text-2xl font-bold tracking-tight
                     text-neutral-950 dark:text-neutral-100"
            >
              {{ t('creator.sectionTotals') }}
            </h2>
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-400 dark:text-neutral-500">
              {{ t('creator.badge') }}
            </span>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-3 sm:gap-4">
            <template v-for="item in kpis" :key="item.key">

              <!-- Pins → link to profile -->
              <router-link
                v-if="item.key === 'pins' && currentUser?.username"
                :to="{ path: `/profile/${encodeURIComponent(currentUser.username)}` }"
                class="group rounded-2xl border p-4 sm:p-5 min-h-[9.5rem]
                       flex flex-col items-center text-center gap-3
                       ring-4 transition-all duration-200
                       hover:shadow-lg hover:-translate-y-0.5
                       bg-gradient-to-br no-underline text-inherit
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500"
                :class="[item.border, item.darkBorder, item.ring, item.subtle, item.darkSubtle]"
              >
                <div class="flex items-center justify-center w-full">
                  <span
                    class="material-symbols-outlined shrink-0 size-11 sm:size-[3.125rem] rounded-xl grid place-items-center leading-none text-[22px]"
                    :class="[item.iconWrap, item.darkIconWrap]"
                    aria-hidden="true"
                  >{{ item.icon }}</span>
                </div>
                <div class="min-w-0 flex-1 w-full flex flex-col items-center">
                  <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wide
                             text-neutral-500 dark:text-neutral-400 mb-1">
                    {{ item.label }}
                  </p>
                  <p class="tabular-nums text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold
                             text-neutral-950 dark:text-neutral-50 tracking-tight">
                    {{ item.formatted }}
                  </p>
                </div>
              </router-link>

              <!-- Pins → no username (disabled) -->
              <button
                v-else-if="item.key === 'pins'"
                type="button"
                class="group rounded-2xl border p-4 sm:p-5 min-h-[9.5rem]
                       flex flex-col items-center text-center gap-3
                       ring-4 bg-gradient-to-br text-left text-inherit opacity-50 cursor-not-allowed"
                :class="[item.border, item.darkBorder, item.ring, item.subtle, item.darkSubtle]"
                disabled
              >
                <div class="flex items-center justify-center w-full">
                  <span
                    class="material-symbols-outlined shrink-0 size-11 sm:size-[3.125rem] rounded-xl grid place-items-center leading-none text-[22px]"
                    :class="[item.iconWrap, item.darkIconWrap]"
                    aria-hidden="true"
                  >{{ item.icon }}</span>
                </div>
                <div class="min-w-0 flex-1 w-full flex flex-col items-center">
                  <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wide
                             text-neutral-500 dark:text-neutral-400 mb-1">
                    {{ item.label }}
                  </p>
                  <p class="tabular-nums text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold
                             text-neutral-950 dark:text-neutral-50 tracking-tight">
                    {{ item.formatted }}
                  </p>
                </div>
              </button>

              <!-- Engagement metrics → open audience panel -->
              <button
                v-else
                type="button"
                class="group rounded-2xl border p-4 sm:p-5 min-h-[9.5rem]
                       flex flex-col items-center text-center gap-3
                       ring-4 transition-all duration-200
                       hover:shadow-lg hover:-translate-y-0.5
                       bg-gradient-to-br text-left text-inherit
                       focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500
                       cursor-pointer"
                :class="[item.border, item.darkBorder, item.ring, item.subtle, item.darkSubtle]"
                @click="openAudiencePanel(item.key)"
              >
                <div class="flex items-center justify-center w-full">
                  <span
                    class="material-symbols-outlined shrink-0 size-11 sm:size-[3.125rem] rounded-xl grid place-items-center leading-none text-[22px]"
                    :class="[item.iconWrap, item.darkIconWrap]"
                    aria-hidden="true"
                  >{{ item.icon }}</span>
                </div>
                <div class="min-w-0 flex-1 w-full flex flex-col items-center">
                  <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wide
                             text-neutral-500 dark:text-neutral-400 mb-1">
                    {{ item.label }}
                  </p>
                  <p class="tabular-nums text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold
                             text-neutral-950 dark:text-neutral-50 tracking-tight">
                    {{ item.formatted }}
                  </p>
                  <p class="mt-1 text-[10px] sm:text-[11px] font-semibold text-center" :class="item.accent">
                    {{ t('creator.audience.cta') }}
                  </p>
                </div>
              </button>

            </template>
          </div>
        </section>

        <!-- ── Weekly pins ─────────────────────────────────────── -->
        <section
          id="fenetre"
          class="mb-10 sm:mb-12 rounded-[1.5rem] sm:rounded-[1.85rem]
                 border border-neutral-200/80 dark:border-neutral-700/60
                 bg-white/92 dark:bg-neutral-900/92
                 backdrop-blur-sm
                 shadow-xl shadow-neutral-950/[0.04] dark:shadow-black/20
                 ring-1 ring-black/[0.03] dark:ring-white/[0.04]
                 overflow-hidden scroll-mt-28"
        >
          <!-- Header -->
          <div class="border-b border-neutral-100 dark:border-neutral-800
                      px-5 py-5 sm:px-7 sm:py-7
                      bg-gradient-to-br from-neutral-50/98 to-white
                      dark:from-neutral-900 dark:to-neutral-900/80">
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div class="min-w-0 flex-1">
                <h2
                  id="creator-week-heading"
                  class="text-lg sm:text-xl font-bold
                         text-neutral-950 dark:text-neutral-100 mb-2"
                >
                  {{ t('creator.sectionWeekly') }}
                </h2>
                <p class="text-sm text-neutral-500 dark:text-neutral-400 leading-relaxed max-w-prose">
                  {{ t('creator.weeklyExplain') }}
                </p>
              </div>

              <!-- Period summary badge -->
              <p
                v-if="weeklyMeta && periodSummaryLine"
                class="text-xs font-medium
                       text-neutral-600 dark:text-neutral-300
                       shrink-0 py-2 px-3 rounded-xl
                       bg-neutral-900/[0.04] dark:bg-neutral-800/60
                       border border-neutral-200/60 dark:border-neutral-700/60
                       self-start max-w-xl leading-snug"
              >
                {{ periodSummaryLine }}
              </p>
              <p
                v-else-if="weeklyMeta"
                class="text-xs font-medium
                       text-neutral-500 dark:text-neutral-400
                       shrink-0 py-2 px-3 rounded-xl
                       bg-neutral-900/[0.04] dark:bg-neutral-800/60
                       border border-neutral-200/60 dark:border-neutral-700/60
                       self-start"
              >
                {{ t('creator.weeklyEvents', { count: weeklyMeta.total_view_events_period, days: weeklyMeta.period_days }) }}
              </p>
            </div>
          </div>

          <!-- List body -->
          <div class="p-4 sm:p-6 md:p-7">
            <ul v-if="weeklyPins.length" class="flex flex-col gap-3 md:gap-4">
              <li
                v-for="(p, idx) in weeklyPins"
                :key="p.id"
                class="flex gap-4 rounded-2xl
                       border border-neutral-100 dark:border-neutral-800
                       bg-neutral-50/60 dark:bg-neutral-800/30
                       hover:bg-white dark:hover:bg-neutral-800/70
                       hover:border-pink-200/80 dark:hover:border-pink-700/50
                       hover:shadow-md dark:hover:shadow-black/20
                       transition-all duration-200 overflow-hidden group"
              >
                <!-- Rank badge -->
                <span
                  class="mt-5 ms-5 flex size-10 shrink-0 items-center justify-center rounded-full
                         text-lg font-black tabular-nums shadow-sm ring-2"
                  :class="rankAccent(idx)"
                  aria-hidden="true"
                >{{ idx + 1 }}</span>

                <!-- Thumbnail -->
                <router-link
                  :to="`/pin/${p.slug}`"
                  class="shrink-0 w-[4.75rem] h-[4.75rem] sm:w-[5.25rem] sm:h-[5.25rem]
                         my-5 rounded-xl overflow-hidden
                         bg-neutral-200 dark:bg-neutral-700
                         ring-1 ring-neutral-200/85 dark:ring-neutral-700/60"
                  :aria-label="p.title"
                >
                  <img
                    v-if="p.thumbnail_url"
                    :src="p.thumbnail_url"
                    :alt="p.title"
                    class="size-full object-cover group-hover:scale-[1.04] transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                  <span
                    v-else
                    class="flex size-full items-center justify-center material-symbols-outlined
                           text-neutral-400 dark:text-neutral-600 text-[2rem]"
                  >push_pin</span>
                </router-link>

                <!-- Content -->
                <div class="min-w-0 flex-1 pe-5 py-5 flex flex-col justify-center gap-2.5">
                  <router-link
                    :to="`/pin/${p.slug}`"
                    class="font-bold text-neutral-950 dark:text-neutral-100
                           hover:text-pink-600 dark:hover:text-pink-400
                           line-clamp-2 text-[15px] sm:text-base leading-snug transition-colors"
                  >{{ p.title }}</router-link>

                  <!-- Stats chips -->
                  <div class="flex flex-wrap items-center gap-2 text-xs sm:text-[13px]">
                    <span class="inline-flex items-center gap-1.5 rounded-full
                                 bg-white dark:bg-neutral-900
                                 px-2.5 py-1
                                 ring-1 ring-neutral-200/80 dark:ring-neutral-700/60
                                 text-neutral-600 dark:text-neutral-400
                                 shadow-sm tabular-nums">
                      <span class="material-symbols-outlined text-[15px] text-sky-500" aria-hidden="true">visibility</span>
                      {{ t('creator.viewsThisWeek', { count: p.views_week }) }}
                    </span>
                    <span
                      v-if="(p.likes_week ?? 0) > 0"
                      class="inline-flex items-center gap-1.5 rounded-full
                             bg-rose-50 dark:bg-rose-950/50
                             px-2.5 py-1
                             ring-1 ring-rose-100 dark:ring-rose-900/50
                             text-rose-700 dark:text-rose-300
                             shadow-sm tabular-nums"
                    >
                      <span class="material-symbols-outlined text-[15px] text-rose-500 dark:text-rose-400" aria-hidden="true">favorite</span>
                      {{ t('creator.weekLikes', { n: p.likes_week ?? 0 }) }}
                    </span>
                    <span
                      v-if="(p.saves_week ?? 0) > 0"
                      class="inline-flex items-center gap-1.5 rounded-full
                             bg-teal-50 dark:bg-teal-950/50
                             px-2.5 py-1
                             ring-1 ring-teal-100 dark:ring-teal-900/50
                             text-teal-700 dark:text-teal-300
                             shadow-sm tabular-nums"
                    >
                      <span class="material-symbols-outlined text-[15px] text-teal-500 dark:text-teal-400" aria-hidden="true">bookmark</span>
                      {{ t('creator.weekSaves', { n: p.saves_week ?? 0 }) }}
                    </span>
                    <span
                      v-if="(p.comments_week ?? 0) > 0"
                      class="inline-flex items-center gap-1.5 rounded-full
                             bg-amber-50 dark:bg-amber-950/50
                             px-2.5 py-1
                             ring-1 ring-amber-100 dark:ring-amber-900/50
                             text-amber-800 dark:text-amber-300
                             shadow-sm tabular-nums"
                    >
                      <span class="material-symbols-outlined text-[15px] text-amber-500 dark:text-amber-400" aria-hidden="true">chat_bubble</span>
                      {{ t('creator.weekComments', { n: p.comments_week ?? 0 }) }}
                    </span>
                  </div>
                </div>
              </li>
            </ul>

            <!-- Load more weekly -->
            <div v-if="weeklyPins.length && weeklyPinsHasMore" class="mt-5 flex justify-center">
              <button
                type="button"
                class="inline-flex items-center gap-2 rounded-full
                       border border-neutral-200 dark:border-neutral-700
                       bg-white dark:bg-neutral-800
                       px-5 py-2.5 text-sm font-semibold
                       text-neutral-700 dark:text-neutral-300
                       shadow-sm
                       hover:border-pink-200 dark:hover:border-pink-700/60
                       hover:bg-pink-50/50 dark:hover:bg-pink-950/30
                       hover:text-pink-700 dark:hover:text-pink-400
                       disabled:opacity-40 transition-all duration-150"
                :disabled="weeklyPinsLoadingMore"
                @click="loadMoreWeeklyPins"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">expand_more</span>
                {{ t('creator.loadMoreWeekly') }}
              </button>
            </div>

            <!-- Empty weekly state -->
            <div
              v-else-if="!weeklyPins.length"
              class="flex flex-col items-center justify-center text-center
                     px-6 py-16 sm:py-20 rounded-xl
                     border border-dashed
                     border-neutral-200 dark:border-neutral-700/70
                     bg-neutral-50/65 dark:bg-neutral-800/30"
            >
              <span
                class="material-symbols-outlined text-[48px]
                       text-neutral-300 dark:text-neutral-600 mb-4"
                aria-hidden="true"
              >bar_chart</span>
              <p class="text-neutral-500 dark:text-neutral-400 text-sm max-w-md leading-relaxed">
                {{ t('creator.weeklyEmpty') }}
              </p>
            </div>
          </div>
        </section>

        <!-- ── Top all-time pins ────────────────────────────────── -->
        <section
          v-if="topAllTime.length"
          id="top-classement"
          aria-labelledby="creator-top-heading"
          class="mb-10 sm:mb-12 rounded-[1.5rem] sm:rounded-[1.85rem]
                 border border-neutral-200/80 dark:border-neutral-700/60
                 bg-white/95 dark:bg-neutral-900/95
                 shadow-lg shadow-neutral-950/[0.03] dark:shadow-black/20
                 overflow-hidden scroll-mt-28"
        >
          <!-- Header -->
          <div class="px-5 py-5 sm:px-7 sm:py-6
                      border-b border-neutral-100 dark:border-neutral-800
                      bg-gradient-to-r from-neutral-50 to-white
                      dark:from-neutral-900 dark:to-neutral-900/80">
            <h2
              id="creator-top-heading"
              class="text-lg sm:text-xl font-bold
                     text-neutral-950 dark:text-neutral-100"
            >
              {{ t('creator.sectionTopAll') }}
            </h2>
          </div>

          <!-- Rows -->
          <ul class="divide-y divide-neutral-100 dark:divide-neutral-800/80">
            <li
              v-for="(p, idx) in topAllTime"
              :key="p.id"
              class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5
                     px-5 py-4 sm:px-7
                     hover:bg-pink-50/40 dark:hover:bg-pink-950/20
                     transition-colors duration-150"
            >
              <!-- Left: rank + title -->
              <div class="flex items-center gap-4 min-w-0 flex-1">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full
                         text-sm font-black tabular-nums ring-2 shadow-sm"
                  :class="rankAccent(idx)"
                  aria-hidden="true"
                >{{ idx + 1 }}</span>
                <router-link
                  :to="`/pin/${p.slug}`"
                  class="font-semibold
                         text-neutral-900 dark:text-neutral-100
                         hover:text-pink-600 dark:hover:text-pink-400
                         truncate min-w-0 text-[15px] sm:text-base
                         transition-colors"
                >{{ p.title }}</router-link>
              </div>

              <!-- Right: stats -->
              <div class="flex items-center gap-4 sm:gap-5 ps-[3.25rem] sm:ps-0 shrink-0
                          text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span class="inline-flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[17px] text-sky-500" aria-hidden="true">visibility</span>
                  {{ formatStat(p.views) }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[17px] text-rose-500" aria-hidden="true">favorite</span>
                  {{ formatStat(p.likes) }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <span class="material-symbols-outlined text-[17px] text-teal-500" aria-hidden="true">bookmark</span>
                  {{ formatStat(p.saves) }}
                </span>
              </div>
            </li>
          </ul>

          <!-- Load more top -->
          <div
            v-if="topPinsHasMore"
            class="px-5 py-4 sm:px-7 border-t border-neutral-100 dark:border-neutral-800
                   flex justify-center
                   bg-neutral-50/40 dark:bg-neutral-900/60"
          >
            <button
              type="button"
              class="inline-flex items-center gap-2 rounded-full
                     border border-neutral-200 dark:border-neutral-700
                     bg-white dark:bg-neutral-800
                     px-5 py-2.5 text-sm font-semibold
                     text-neutral-700 dark:text-neutral-300
                     shadow-sm
                     hover:border-pink-200 dark:hover:border-pink-700/60
                     hover:bg-pink-50/50 dark:hover:bg-pink-950/30
                     hover:text-pink-700 dark:hover:text-pink-400
                     disabled:opacity-40 transition-all duration-150"
              :disabled="topPinsLoadingMore"
              @click="loadMoreTopPins"
            >
              <span class="material-symbols-outlined text-[18px]" aria-hidden="true">expand_more</span>
              {{ t('creator.loadMoreTop') }}
            </button>
          </div>
        </section>

        <!-- ── Footer hint ─────────────────────────────────────── -->
        <footer class="pt-5 border-t border-neutral-200/80 dark:border-neutral-800/80">
          <p class="flex flex-wrap items-start gap-x-3 gap-y-2
                    text-xs sm:text-[13px]
                    text-neutral-400 dark:text-neutral-500
                    leading-relaxed max-w-[56rem]">
            <span class="material-symbols-outlined text-[18px] text-neutral-300 dark:text-neutral-600 shrink-0 mt-0.5" aria-hidden="true">mail</span>
            <span>{{ t('creator.digestHint') }}</span>
          </p>
        </footer>

        <!-- ── Audience panel (Teleport) ───────────────────────── -->
        <Teleport to="body">
          <div
            v-if="audienceOpen"
            class="fixed inset-0 z-[80] flex items-end sm:items-center justify-center sm:p-6"
            role="dialog"
            aria-modal="true"
            aria-labelledby="creator-audience-title"
          >
            <!-- Backdrop -->
            <button
              type="button"
              class="absolute inset-0 w-full h-full
                     bg-black/55 dark:bg-black/70
                     backdrop-blur-[2px]
                     border-0 cursor-default p-0"
              :aria-label="t('creator.audience.close')"
              @click="closeAudiencePanel"
            />

            <!-- Panel -->
            <div
              class="relative z-[1] w-full sm:max-w-lg
                     max-h-[min(90vh,720px)]
                     sm:rounded-2xl rounded-t-3xl
                     bg-white dark:bg-neutral-900
                     shadow-2xl shadow-black/30
                     border border-neutral-200/80 dark:border-neutral-700/60
                     overflow-hidden flex flex-col"
              @click.stop
            >
              <!-- Panel header -->
              <header
                class="px-5 py-4 border-b border-neutral-100 dark:border-neutral-800
                       flex items-start justify-between gap-3
                       bg-gradient-to-r from-pink-50/70 to-white
                       dark:from-pink-950/30 dark:to-neutral-900
                       shrink-0"
              >
                <div class="min-w-0">
                  <p
                    id="creator-audience-title"
                    class="text-[11px] font-bold uppercase tracking-wider
                           text-pink-700 dark:text-pink-400"
                  >
                    {{ t('creator.audience.title') }}
                  </p>
                  <h3 class="text-lg font-bold text-neutral-950 dark:text-neutral-100 truncate">
                    {{ audienceKpiLabel }}
                  </h3>
                  <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
                    {{ t('creator.audience.period', { days: AUDIENCE_PERIOD_DAYS }) }}
                  </p>
                </div>
                <button
                  type="button"
                  class="p-2 rounded-full
                         hover:bg-neutral-100 dark:hover:bg-neutral-800
                         text-neutral-500 dark:text-neutral-400
                         transition-colors shrink-0"
                  @click="closeAudiencePanel"
                >
                  <span class="material-symbols-outlined">close</span>
                </button>
              </header>

              <!-- Panel body -->
              <div class="flex-1 min-h-0 overflow-y-auto px-4 py-4 sm:px-5">

                <!-- Loading -->
                <div
                  v-if="audienceLoading"
                  class="py-14 text-center text-sm text-neutral-400 dark:text-neutral-500"
                >
                  {{ t('app.loading') }}
                </div>

                <!-- Error -->
                <div
                  v-else-if="audienceErr"
                  class="py-8 text-center text-sm text-rose-500 dark:text-rose-400 font-medium"
                >
                  {{ audienceErr }}
                </div>

                <!-- Content -->
                <template v-else-if="audiencePayload">
                  <!-- Summary badges -->
                  <div class="flex flex-wrap gap-2 mb-4">
                    <span
                      class="inline-flex items-center rounded-full
                             bg-neutral-100 dark:bg-neutral-800
                             px-3 py-1 text-[11px] font-bold
                             text-neutral-700 dark:text-neutral-300
                             tabular-nums"
                    >
                      {{ t('creator.audience.totalActions', { n: audiencePayload.total_actions }) }}
                    </span>
                    <span
                      class="inline-flex items-center rounded-full
                             bg-sky-50 dark:bg-sky-950/50
                             border border-sky-100 dark:border-sky-900/60
                             px-3 py-1 text-[11px] font-bold
                             text-sky-800 dark:text-sky-300
                             tabular-nums"
                    >
                      {{ t('creator.audience.distinctActors', { n: audiencePayload.distinct_actors }) }}
                    </span>
                  </div>

                  <!-- Empty -->
                  <p
                    v-if="!audiencePayload.top_actors?.length"
                    class="text-sm text-neutral-400 dark:text-neutral-500
                           text-center py-10 px-2 leading-relaxed"
                  >
                    {{ t('creator.audience.empty') }}
                  </p>

                  <!-- Actors list -->
                  <ul
                    v-else
                    class="divide-y divide-neutral-100 dark:divide-neutral-800
                           rounded-xl border border-neutral-100 dark:border-neutral-800
                           overflow-hidden"
                  >
                    <li
                      v-for="row in audiencePayload.top_actors"
                      :key="row.username"
                      class="flex items-center gap-3 px-3 py-3
                             bg-white dark:bg-neutral-900
                             hover:bg-pink-50/40 dark:hover:bg-pink-950/20
                             transition-colors"
                    >
                      <router-link
                        :to="`/profile/${encodeURIComponent(row.username)}`"
                        class="flex items-center gap-3 min-w-0 flex-1 no-underline text-inherit"
                      >
                        <AvatarDisc
                          :color="row.avatar_color || '#a3a3a3'"
                          frame-class="size-10 shrink-0 text-sm"
                          text-class="text-white"
                          :has-image="!!row.avatar_url"
                        >
                          <img v-if="row.avatar_url" :src="row.avatar_url" class="w-full h-full object-cover" alt="" />
                          <span v-else class="text-center leading-none px-0.5">
                            {{ displayInitials(row.display_name || row.username) }}
                          </span>
                        </AvatarDisc>
                        <span class="font-semibold text-neutral-900 dark:text-neutral-100 truncate">
                          {{ row.display_name }}
                        </span>
                      </router-link>
                      <span
                        class="tabular-nums text-sm font-black
                               text-neutral-700 dark:text-neutral-300
                               shrink-0 px-2.5 py-1 rounded-lg
                               bg-neutral-100 dark:bg-neutral-800"
                      >
                        {{ formatStat(row.count) }}
                      </span>
                    </li>
                  </ul>

                  <p class="mt-4 text-[11px] text-neutral-400 dark:text-neutral-600 text-center">
                    {{ t('creator.audience.footerHint') }}
                  </p>
                </template>
              </div>
            </div>
          </div>
        </Teleport>

      </template>
    </div>
  </main>
</template>