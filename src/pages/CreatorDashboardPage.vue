<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import CreatorDashboardSkeleton from '../components/CreatorDashboardSkeleton.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import { displayInitials } from '../utils/displayInitials'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { useI18n } from '../i18n'

const { t, currentLang } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated, fetchCurrentUser, updateProfile } = useAuth()
const {
  fetchCreatorStats,
  fetchCreatorWeeklyStats,
  fetchCreatorEngagement,
  fetchCreatorRecentPins,
  fetchCreatorCommentInbox,
  downloadCreatorStatsCsv,
  moderatePinComment,
} = usePins()

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
  period_comparison?: {
    previous_period_days: number
    previous_period_engagement: PeriodEngagement
    previous_total_view_events_period: number
  } | null
} | null>(null)
const topPinsHasMore = ref(false)
const weeklyPinsHasMore = ref(false)
const topPinsLoadingMore = ref(false)
const weeklyPinsLoadingMore = ref(false)
const topPinsPage = ref(1)
const weeklyPinsPage = ref(1)
const TOP_PAGE_SIZE = 10
const WEEKLY_PAGE_SIZE = 10
const RECENT_PAGE_SIZE = 12
const INBOX_LIMIT = 15
const periodDays = ref<7 | 14 | 28>(7)
const AUDIENCE_PERIOD_DAYS = 30

type RecentPinRow = {
  id: number
  slug: string
  title: string
  thumbnail_url: string | null
  visibility: string
  comments_policy: string
  created_at: string
}
const recentPins = ref<RecentPinRow[]>([])
const hubLoading = ref(false)

type InboxCommentRow = {
  id: number
  pin_slug: string
  pin_title: string
  author_username: string
  author_display_name: string
  text_preview: string
  hidden_by_owner: boolean
  moderation_hidden: boolean
  created_at: string
}
const inboxComments = ref<InboxCommentRow[]>([])
const inboxLoading = ref(false)
const inboxHasMore = ref(false)
const inboxOffset = ref(0)
const inboxModeratingId = ref<number | null>(null)

const digestWeekly = ref(true)
const digestSaving = ref(false)
const exportLoading = ref(false)

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
  /** Icône Font Awesome (ex. `fa-thumbtack` — combinée avec `fa-solid` dans le template). */
  fa: string
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
    fa: 'fa-thumbtack',
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
    fa: 'fa-eye',
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
    fa: 'fa-bookmark',
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
    fa: 'fa-heart',
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
    fa: 'fa-comment',
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

function pctDeltaLabel(cur: number, prev: number): string {
  if (prev === 0 && cur === 0) return '—'
  if (prev === 0) return t('creator.compareNew')
  const raw = ((cur - prev) / prev) * 100
  const rounded = Math.round(raw * 10) / 10
  const sign = rounded > 0 ? '+' : ''
  return `${sign}${rounded}%`
}

const periodComparisonHint = computed(() => {
  const pc = weeklyMeta.value?.period_comparison
  if (!pc || weeklyMeta.value == null) return ''
  const cur = weeklyMeta.value.total_view_events_period
  const prev = pc.previous_total_view_events_period
  const days = weeklyMeta.value.period_days ?? periodDays.value
  return t('creator.compareViews', {
    days,
    delta: pctDeltaLabel(cur, prev),
  })
})

watch(
  () => currentUser.value?.subscription?.digestCreatorWeekly,
  (v) => {
    digestWeekly.value = v ?? true
  },
  { immediate: true },
)

watch(periodDays, async () => {
  if (!isAuthenticated.value || !isPro.value || loading.value) return
  await reloadWeeklyOnly()
})

async function reloadWeeklyOnly() {
  weeklyPinsLoadingMore.value = false
  weeklyPinsPage.value = 1
  try {
    const weekly = await fetchCreatorWeeklyStats(periodDays.value, {
      page: 1,
      page_size: WEEKLY_PAGE_SIZE,
    })
    weeklyPins.value = weekly?.top_pins || []
    weeklyMeta.value = {
      total_view_events_period: weekly?.total_view_events_period ?? 0,
      period_days: weekly?.period_days ?? periodDays.value,
      period_engagement: weekly?.period_engagement ?? null,
      period_comparison: weekly?.period_comparison ?? null,
    }
    weeklyPinsHasMore.value = !!weekly?.pagination?.has_next
  } catch {
    errorMsg.value = t('creator.errorLoad')
  }
}

async function loadHubExtras() {
  hubLoading.value = true
  inboxLoading.value = true
  inboxOffset.value = 0
  try {
    const [recent, inbox] = await Promise.all([
      fetchCreatorRecentPins({ page: 1, page_size: RECENT_PAGE_SIZE }),
      fetchCreatorCommentInbox({ limit: INBOX_LIMIT, offset: 0 }),
    ])
    recentPins.value = Array.isArray(recent?.pins) ? recent.pins : []
    inboxComments.value = Array.isArray(inbox?.comments) ? inbox.comments : []
    inboxHasMore.value = !!inbox?.has_more
    inboxOffset.value = inboxComments.value.length
  } catch {
    recentPins.value = []
    inboxComments.value = []
    inboxHasMore.value = false
  } finally {
    hubLoading.value = false
    inboxLoading.value = false
  }
}

async function loadMoreInbox() {
  if (!inboxHasMore.value || inboxLoading.value) return
  inboxLoading.value = true
  try {
    const inbox = await fetchCreatorCommentInbox({
      limit: INBOX_LIMIT,
      offset: inboxOffset.value,
    })
    const chunk = Array.isArray(inbox?.comments) ? inbox.comments : []
    inboxComments.value.push(...chunk)
    inboxHasMore.value = !!inbox?.has_more
    inboxOffset.value += chunk.length
  } finally {
    inboxLoading.value = false
  }
}

async function toggleDigestWeb() {
  if (digestSaving.value) return
  digestSaving.value = true
  const next = !digestWeekly.value
  try {
    await updateProfile({ notificationsDigestCreatorWeekly: next })
  } catch {
    digestWeekly.value = currentUser.value?.subscription?.digestCreatorWeekly ?? digestWeekly.value
  } finally {
    digestSaving.value = false
  }
}

async function exportCsvWeb() {
  if (exportLoading.value) return
  exportLoading.value = true
  try {
    const blob = await downloadCreatorStatsCsv()
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'pinova-creator-stats.csv'
    a.rel = 'noopener'
    document.body.appendChild(a)
    a.click()
    a.remove()
    URL.revokeObjectURL(url)
  } finally {
    exportLoading.value = false
  }
}

async function moderateFromInbox(row: InboxCommentRow, hidden: boolean) {
  if (row.moderation_hidden) return
  inboxModeratingId.value = row.id
  try {
    await moderatePinComment(row.pin_slug, row.id, hidden)
    const i = inboxComments.value.findIndex((c) => c.id === row.id)
    if (i >= 0) {
      inboxComments.value[i] = { ...inboxComments.value[i]!, hidden_by_owner: hidden }
    }
  } finally {
    inboxModeratingId.value = null
  }
}

function audienceActionParam(key: TotalKey): 'likes' | 'saves' | 'comments' | 'views' {
  return key as 'likes' | 'saves' | 'comments' | 'views'
}

function setPeriodDaysChoice(d: 7 | 14 | 28) {
  periodDays.value = d
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
      fetchCreatorWeeklyStats(periodDays.value, { page: 1, page_size: WEEKLY_PAGE_SIZE }),
    ])
    creatorTotals.value = all?.totals || null
    topAllTime.value = all?.top_pins || []
    weeklyPins.value = weekly?.top_pins || []
    weeklyMeta.value = {
      total_view_events_period: weekly?.total_view_events_period ?? 0,
      period_days: weekly?.period_days ?? periodDays.value,
      period_engagement: weekly?.period_engagement ?? null,
      period_comparison: weekly?.period_comparison ?? null,
    }
    topPinsHasMore.value = !!all?.top_pins_pagination?.has_next
    weeklyPinsHasMore.value = !!weekly?.pagination?.has_next
    void loadHubExtras()
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
    const weekly = await fetchCreatorWeeklyStats(periodDays.value, {
      page: nextPage,
      page_size: WEEKLY_PAGE_SIZE,
    })
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
    class="creator-dashboard-page relative w-full min-w-0 min-h-[calc(100vh-6rem)] sm:min-h-[calc(100vh-8rem)] overflow-x-hidden
           bg-neutral-50 text-neutral-900 dark:bg-neutral-950 dark:text-neutral-100"
  >
    <div
      class="pointer-events-none absolute inset-x-0 top-0 h-[min(52rem,85vh)] bg-[radial-gradient(ellipse_95%_72%_at_50%_-8%,rgba(192,38,211,0.14),transparent_58%),radial-gradient(ellipse_70%_55%_at_100%_0%,rgba(99,102,241,0.12),transparent_50%),radial-gradient(ellipse_55%_50%_at_0%_20%,rgba(244,114,182,0.1),transparent_48%)] dark:bg-[radial-gradient(ellipse_95%_72%_at_50%_-8%,rgba(192,38,211,0.16),transparent_58%),radial-gradient(ellipse_70%_55%_at_100%_0%,rgba(99,102,241,0.14),transparent_52%),radial-gradient(ellipse_55%_50%_at_0%_20%,rgba(244,114,182,0.08),transparent_50%)]"
      aria-hidden="true"
    />
    <div class="relative w-full min-w-0 max-w-[1180px] mx-auto px-4 sm:px-6 lg:px-10 py-8 sm:py-11 lg:py-14">

      <!-- Loading skeleton -->
      <div v-if="loading" aria-busy="true">
        <span class="sr-only">{{ t('app.loading') }}</span>
        <CreatorDashboardSkeleton />
      </div>

      <template v-else>

        <!-- ── Navigation ───────────────────────────────────────── -->
        <nav
          class="flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between mb-10 sm:mb-12"
          aria-label="breadcrumb"
        >
          <router-link
            to="/"
            class="group inline-flex items-center justify-center gap-3 rounded-full border border-neutral-200/90 bg-white/75 px-3 py-2 pr-4 text-sm font-semibold text-neutral-700 shadow-sm backdrop-blur-xl transition hover:border-neutral-300 hover:bg-white hover:shadow-md dark:border-white/[0.08] dark:bg-neutral-900/55 dark:text-neutral-200 dark:hover:bg-neutral-900/85 dark:hover:border-white/[0.12]"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-black/[0.04] transition group-hover:bg-neutral-200/90 dark:bg-neutral-800 dark:ring-white/[0.06] dark:group-hover:bg-neutral-700"
            >
              <i class="fa-solid fa-house block text-[15px] leading-none text-neutral-700 dark:text-neutral-200" aria-hidden="true"></i>
            </span>
            {{ t('nav.home') }}
          </router-link>

          <router-link
            to="/create"
            class="inline-flex items-center justify-center gap-3 rounded-full border border-pink-500/25 bg-gradient-to-r from-pink-600 to-fuchsia-600 px-4 py-2.5 text-sm font-bold text-white shadow-lg shadow-pink-600/28 transition [transition-property:transform,box-shadow,filter] hover:brightness-[1.05] hover:shadow-pink-600/40 active:scale-[0.98] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-500 dark:shadow-pink-900/40"
          >
            <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/20 ring-1 ring-white/30">
              <i class="fa-solid fa-plus block text-[14px] leading-none" aria-hidden="true"></i>
            </span>
            {{ t('nav.create') }}
          </router-link>
        </nav>

        <!-- ── Hero ─────────────────────────────────────────────── -->
        <div
          class="relative mb-11 sm:mb-14 overflow-hidden rounded-[1.85rem] sm:rounded-[2.25rem] isolate
                 bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-950
                 text-white shadow-[0_28px_80px_-24px_rgba(76,29,149,0.55)]
                 ring-1 ring-white/15 dark:ring-white/10"
        >
          <div class="pointer-events-none absolute -right-20 -top-32 size-[22rem] rounded-full bg-white/14 blur-3xl" aria-hidden="true" />
          <div class="pointer-events-none absolute -bottom-36 -left-20 size-[18rem] rounded-full bg-fuchsia-400/22 blur-3xl" aria-hidden="true" />
          <div
            class="pointer-events-none absolute inset-0 bg-[linear-gradient(165deg,transparent_35%,rgba(255,255,255,0.07)_52%,transparent_68%)]"
            aria-hidden="true"
          />

          <div
            class="relative flex flex-col items-center gap-8 px-6 py-10 text-center sm:px-10 sm:py-11 md:px-12 md:py-12 lg:flex-row lg:items-end lg:justify-between lg:gap-12 lg:text-left"
          >
            <div class="flex w-full max-w-3xl flex-col items-center gap-6 lg:max-w-none lg:flex-row lg:items-end lg:gap-8">
              <div
                class="flex size-[4.25rem] shrink-0 items-center justify-center rounded-[1.35rem] bg-white/16 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)] ring-2 ring-white/25 backdrop-blur-md sm:size-[4.75rem] md:size-[5rem]"
                aria-hidden="true"
              >
                <i class="fa-solid fa-chart-line block text-[1.85rem] leading-none text-white sm:text-[2rem]" aria-hidden="true"></i>
              </div>
              <header class="min-w-0 flex-1 space-y-3">
                <p class="text-[11px] font-bold uppercase tracking-[0.28em] text-white/75">
                  {{ t('creator.badge') }}
                </p>
                <h1
                  class="font-auth-title font-auth-title--black text-3xl tracking-tight text-white sm:text-[2.15rem] md:text-4xl md:leading-[1.12]"
                >
                  {{ t('creator.title') }}
                </h1>
                <p class="mx-auto max-w-xl text-[15px] leading-relaxed text-white/82 lg:mx-0 lg:max-w-2xl">
                  {{ t('creator.subtitle') }}
                </p>
              </header>
            </div>

            <router-link
              to="/settings"
              class="inline-flex w-full shrink-0 items-center justify-center gap-3 rounded-full border border-white/30 bg-white/14 px-5 py-3 text-sm font-semibold text-white shadow-lg shadow-black/10 backdrop-blur-md transition hover:bg-white/22 lg:w-auto"
            >
              <span class="flex size-10 items-center justify-center rounded-full bg-black/10 ring-1 ring-white/20">
                <i class="fa-solid fa-sliders block text-[15px] leading-none" aria-hidden="true"></i>
              </span>
              {{ t('nav.settings') }}
            </router-link>
          </div>
        </div>

        <!-- ── Error state ──────────────────────────────────────── -->
        <div
          v-if="errorMsg"
          class="mb-10 rounded-[1.35rem] border border-rose-200/90 bg-rose-50/95 px-6 py-10 text-center shadow-lg shadow-rose-900/5 dark:border-rose-800/50 dark:bg-rose-950/35 dark:shadow-black/20"
          role="alert"
        >
          <span
            class="mx-auto mb-4 flex size-14 items-center justify-center rounded-2xl bg-rose-500/15 ring-1 ring-rose-400/30 dark:bg-rose-500/20 dark:ring-rose-500/25"
          >
            <i class="fa-solid fa-circle-exclamation block text-[1.65rem] leading-none text-rose-600 dark:text-rose-400" aria-hidden="true"></i>
          </span>
          <p class="text-sm font-medium text-rose-950 dark:text-rose-200 sm:text-base">{{ errorMsg }}</p>
          <button
            type="button"
            class="mt-6 inline-flex items-center justify-center gap-2 rounded-full px-7 py-3 text-sm font-bold text-white shadow-lg shadow-rose-600/25 transition hover:brightness-105 active:scale-[0.98]
                   bg-gradient-to-r from-rose-600 to-rose-500 dark:shadow-rose-900/40"
            @click="load"
          >
            <i class="fa-solid fa-arrow-rotate-right block text-[15px] leading-none" aria-hidden="true"></i>
            {{ t('creator.retry') }}
          </button>
        </div>

        <!-- ── KPI Totals ───────────────────────────────────────── -->
        <section id="totaux" aria-labelledby="creator-totals-heading" class="mb-11 sm:mb-14 scroll-mt-28">
          <div class="mb-6 flex flex-col gap-2 sm:mb-8 sm:flex-row sm:items-end sm:justify-between sm:gap-4">
            <div>
              <h2
                id="creator-totals-heading"
                class="text-2xl font-bold tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-[1.65rem]"
              >
                {{ t('creator.sectionTotals') }}
              </h2>
            </div>
            <span
              class="inline-flex items-center justify-center self-start rounded-full border border-neutral-200/90 bg-white/80 px-3 py-1 text-[10px] font-bold uppercase tracking-[0.2em] text-neutral-500 backdrop-blur-md dark:border-white/[0.08] dark:bg-neutral-900/60 dark:text-neutral-400 sm:self-auto"
            >
              {{ t('creator.badge') }}
            </span>
          </div>

          <div class="grid grid-cols-1 gap-4 sm:grid-cols-2 sm:gap-5 lg:grid-cols-3 xl:grid-cols-5">
            <template v-for="item in kpis" :key="item.key">

              <!-- Pins → link to profile -->
              <router-link
                v-if="item.key === 'pins' && currentUser?.username"
                :to="{ path: `/profile/${encodeURIComponent(currentUser.username)}` }"
                class="creator-kpi-card group relative flex min-h-[11rem] flex-col items-center gap-5 rounded-[1.35rem] border bg-gradient-to-b px-5 pb-6 pt-7 text-center no-underline text-inherit shadow-[0_14px_42px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_rgba(15,23,42,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 dark:shadow-black/40 dark:ring-white/[0.05] dark:hover:shadow-black/55"
                :class="[item.border, item.darkBorder, item.ring, item.subtle, item.darkSubtle]"
              >
                <div
                  class="creator-kpi-icon-well relative flex size-[3.75rem] shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:ring-white/[0.14]"
                  :class="[item.iconWrap, item.darkIconWrap]"
                >
                  <i class="fa-solid block text-[1.2rem] leading-none" :class="item.fa" aria-hidden="true"></i>
                </div>
                <div class="flex w-full min-w-0 flex-col items-center gap-1">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                    {{ item.label }}
                  </p>
                  <p
                    class="tabular-nums text-[1.65rem] font-black tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-[1.75rem]"
                  >
                    {{ item.formatted }}
                  </p>
                </div>
              </router-link>

              <!-- Pins → no username (disabled) -->
              <button
                v-else-if="item.key === 'pins'"
                type="button"
                class="creator-kpi-card relative flex min-h-[11rem] cursor-not-allowed flex-col items-center gap-5 rounded-[1.35rem] border bg-gradient-to-b px-5 pb-6 pt-7 text-center text-inherit opacity-55 ring-1 ring-black/[0.03] dark:ring-white/[0.05]"
                :class="[item.border, item.darkBorder, item.ring, item.subtle, item.darkSubtle]"
                disabled
              >
                <div
                  class="creator-kpi-icon-well relative flex size-[3.75rem] shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:ring-white/[0.14]"
                  :class="[item.iconWrap, item.darkIconWrap]"
                >
                  <i class="fa-solid block text-[1.2rem] leading-none" :class="item.fa" aria-hidden="true"></i>
                </div>
                <div class="flex w-full min-w-0 flex-col items-center gap-1">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                    {{ item.label }}
                  </p>
                  <p
                    class="tabular-nums text-[1.65rem] font-black tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-[1.75rem]"
                  >
                    {{ item.formatted }}
                  </p>
                </div>
              </button>

              <!-- Engagement metrics → open audience panel -->
              <button
                v-else
                type="button"
                class="creator-kpi-card group relative flex min-h-[11rem] cursor-pointer flex-col items-center gap-5 rounded-[1.35rem] border bg-gradient-to-b px-5 pb-6 pt-7 text-center text-inherit shadow-[0_14px_42px_-28px_rgba(15,23,42,0.35)] ring-1 ring-black/[0.03] transition duration-300 hover:-translate-y-1 hover:shadow-[0_22px_50px_-24px_rgba(15,23,42,0.42)] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-pink-600 dark:shadow-black/40 dark:ring-white/[0.05] dark:hover:shadow-black/55"
                :class="[item.border, item.darkBorder, item.ring, item.subtle, item.darkSubtle]"
                @click="openAudiencePanel(item.key)"
              >
                <div
                  class="creator-kpi-icon-well relative flex size-[3.75rem] shrink-0 items-center justify-center rounded-full shadow-[inset_0_1px_0_rgba(255,255,255,0.65)] ring-1 ring-black/[0.07] dark:shadow-[inset_0_1px_0_rgba(255,255,255,0.12)] dark:ring-white/[0.14]"
                  :class="[item.iconWrap, item.darkIconWrap]"
                >
                  <i class="fa-solid block text-[1.2rem] leading-none" :class="item.fa" aria-hidden="true"></i>
                </div>
                <div class="flex w-full min-w-0 flex-col items-center gap-1">
                  <p class="text-[11px] font-bold uppercase tracking-[0.14em] text-neutral-500 dark:text-neutral-400">
                    {{ item.label }}
                  </p>
                  <p
                    class="tabular-nums text-[1.65rem] font-black tracking-tight text-neutral-950 dark:text-neutral-50 sm:text-[1.75rem]"
                  >
                    {{ item.formatted }}
                  </p>
                  <p class="mt-1 max-w-[14rem] text-center text-[10px] font-bold uppercase tracking-wide" :class="item.accent">
                    {{ t('creator.audience.cta') }}
                  </p>
                </div>
              </button>

            </template>
          </div>
        </section>

        <!-- ── Cockpit : récents + modération ───────────────────── -->
        <section
          id="cockpit"
          class="creator-glass-panel mb-11 sm:mb-14 scroll-mt-28 overflow-hidden rounded-[1.65rem] border border-neutral-200/75 bg-white/75 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-neutral-900/55 dark:shadow-black/50"
          aria-labelledby="creator-hub-heading"
        >
          <div
            class="flex flex-col gap-5 border-b border-neutral-200/70 px-5 py-6 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-8 sm:py-7 dark:border-white/[0.06]"
          >
            <div class="min-w-0 space-y-1.5 text-center sm:text-left">
              <h2 id="creator-hub-heading" class="text-xl font-bold text-neutral-950 dark:text-neutral-50">
                {{ t('creator.hubTitle') }}
              </h2>
              <p class="text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                {{ t('creator.hubSubtitle') }}
              </p>
            </div>
            <div class="grid grid-cols-1 gap-2.5 sm:flex sm:flex-wrap sm:justify-end">
              <router-link
                to="/contest/live"
                class="inline-flex items-center justify-center gap-3 rounded-full border border-fuchsia-200/90 bg-gradient-to-r from-fuchsia-500/[0.12] to-pink-500/[0.1] px-4 py-2.5 text-sm font-semibold text-fuchsia-950 shadow-sm backdrop-blur-sm transition hover:border-fuchsia-300 hover:from-fuchsia-500/18 dark:border-fuchsia-500/25 dark:from-fuchsia-500/15 dark:to-pink-500/10 dark:text-fuchsia-100"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/70 ring-1 ring-fuchsia-200/80 dark:bg-neutral-900/60 dark:ring-fuchsia-500/40">
                  <i class="fa-solid fa-trophy block text-[15px] leading-none text-fuchsia-600 dark:text-fuchsia-300" aria-hidden="true"></i>
                </span>
                {{ t('creator.contestLink') }}
              </router-link>
              <router-link
                :to="{ name: 'settings-section', params: { sectionId: 'settings-tips' } }"
                class="inline-flex items-center justify-center gap-3 rounded-full border border-neutral-200/90 bg-white/85 px-4 py-2.5 text-sm font-semibold text-neutral-800 shadow-sm backdrop-blur-sm transition hover:bg-white dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-100 dark:hover:bg-neutral-800"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-neutral-100 ring-1 ring-black/[0.05] dark:bg-neutral-700 dark:ring-white/10">
                  <i class="fa-solid fa-money-bill-wave block text-[15px] leading-none text-neutral-600 dark:text-neutral-200" aria-hidden="true"></i>
                </span>
                {{ t('creator.settingsTips') }}
              </router-link>
              <button
                type="button"
                class="inline-flex items-center justify-center gap-3 rounded-full border border-neutral-900/90 bg-neutral-950 px-4 py-2.5 text-sm font-semibold text-white shadow-lg shadow-neutral-900/25 transition hover:bg-neutral-900 disabled:opacity-50 dark:border-white/15 dark:bg-white dark:text-neutral-950 dark:shadow-none dark:hover:bg-neutral-100"
                :disabled="exportLoading"
                @click="exportCsvWeb"
              >
                <span class="flex size-9 shrink-0 items-center justify-center rounded-full bg-white/15 ring-1 ring-white/25 dark:bg-neutral-950/10 dark:ring-neutral-950/20">
                  <i class="fa-solid fa-download block text-[15px] leading-none" aria-hidden="true"></i>
                </span>
                {{ exportLoading ? t('creator.exporting') : t('creator.exportCsv') }}
              </button>
            </div>
          </div>

          <div class="space-y-10 bg-gradient-to-b from-transparent via-neutral-50/[0.35] to-transparent px-4 py-7 sm:px-8 sm:py-9 dark:via-neutral-950/40">
            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                {{ t('creator.recentPinsTitle') }}
              </h3>
              <div v-if="hubLoading" class="text-sm text-neutral-400 py-6">{{ t('app.loading') }}</div>
              <div
                v-else-if="!recentPins.length"
                class="text-sm text-neutral-500 dark:text-neutral-400 py-4 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl px-4"
              >
                {{ t('creator.recentPinsEmpty') }}
              </div>
              <ul v-else class="flex gap-3 overflow-x-auto pb-2 snap-x snap-mandatory scrollbar-thin">
                <li
                  v-for="rp in recentPins"
                  :key="rp.id"
                  class="snap-start shrink-0 w-[10.5rem] rounded-2xl border border-neutral-200 dark:border-neutral-700
                         bg-neutral-50/80 dark:bg-neutral-800/40 overflow-hidden flex flex-col"
                >
                  <router-link :to="`/pin/${rp.slug}`" class="block relative aspect-square bg-neutral-200 dark:bg-neutral-700">
                    <img
                      v-if="rp.thumbnail_url"
                      :src="rp.thumbnail_url"
                      :alt="rp.title"
                      class="size-full object-cover"
                      loading="lazy"
                    />
                    <i
                      class="fa-solid fa-thumbtack flex size-full items-center justify-center text-neutral-400 text-3xl leading-none"
                      aria-hidden="true"
                    ></i>
                  </router-link>
                  <div class="p-2.5 flex flex-col gap-1 min-h-[4.25rem]">
                    <router-link
                      :to="`/pin/${rp.slug}`"
                      class="text-xs font-bold text-neutral-900 dark:text-neutral-100 line-clamp-2 hover:text-pink-800 dark:hover:text-pink-800"
                    >
                      {{ rp.title }}
                    </router-link>
                    <router-link
                      :to="`/pin/${rp.slug}/edit`"
                      class="text-[11px] font-semibold text-pink-700 dark:text-pink-600"
                    >
                      {{ t('creator.editPin') }} →
                    </router-link>
                  </div>
                </li>
              </ul>
            </div>

            <div>
              <h3 class="text-xs font-bold uppercase tracking-wider text-neutral-500 dark:text-neutral-400 mb-3">
                {{ t('creator.inboxTitle') }}
              </h3>
              <div v-if="inboxLoading && !inboxComments.length" class="text-sm text-neutral-400 py-6">
                {{ t('app.loading') }}
              </div>
              <p
                v-else-if="!inboxComments.length"
                class="text-sm text-neutral-500 dark:text-neutral-400 py-4 border border-dashed border-neutral-200 dark:border-neutral-700 rounded-xl px-4"
              >
                {{ t('creator.inboxEmpty') }}
              </p>
              <ul v-else class="divide-y divide-neutral-100 dark:divide-neutral-800 rounded-xl border border-neutral-100 dark:border-neutral-800 overflow-hidden">
                <li
                  v-for="row in inboxComments"
                  :key="row.id"
                  class="px-4 py-4 bg-white dark:bg-neutral-900/60 hover:bg-neutral-50 dark:hover:bg-neutral-800/40"
                >
                  <div class="flex flex-wrap items-start justify-between gap-2 mb-2">
                    <div class="min-w-0">
                      <router-link
                        :to="`/pin/${row.pin_slug}`"
                        class="text-sm font-bold text-neutral-900 dark:text-neutral-100 hover:text-pink-800 dark:hover:text-pink-800 line-clamp-1"
                      >
                        {{ row.pin_title }}
                      </router-link>
                      <p class="text-xs text-neutral-500 mt-0.5">
                        {{ row.author_display_name }}
                        <span class="text-neutral-400">@{{ row.author_username }}</span>
                      </p>
                    </div>
                    <div class="flex gap-2 shrink-0">
                      <template v-if="row.moderation_hidden">
                        <span
                          class="text-[11px] font-semibold px-2 py-1 rounded-lg bg-amber-100 dark:bg-amber-950/50 text-amber-900 dark:text-amber-200"
                        >
                          {{ t('creator.inboxPlatformHidden') }}
                        </span>
                      </template>
                      <template v-else>
                        <button
                          type="button"
                          class="text-[11px] font-bold px-3 py-1.5 rounded-lg border border-neutral-200 dark:border-neutral-600
                                 text-neutral-700 dark:text-neutral-200 disabled:opacity-40"
                          :disabled="inboxModeratingId === row.id"
                          @click="moderateFromInbox(row, !row.hidden_by_owner)"
                        >
                          {{
                            row.hidden_by_owner ? t('creator.inboxShow') : t('creator.inboxHide')
                          }}
                        </button>
                      </template>
                    </div>
                  </div>
                  <p class="text-sm text-neutral-600 dark:text-neutral-300 whitespace-pre-wrap break-words">
                    {{ row.text_preview }}
                  </p>
                </li>
              </ul>
              <div v-if="inboxHasMore" class="mt-4 flex justify-center">
                <button
                  type="button"
                  class="inline-flex items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700
                         px-5 py-2 text-sm font-semibold text-neutral-700 dark:text-neutral-300
                         disabled:opacity-40"
                  :disabled="inboxLoading"
                  @click="loadMoreInbox"
                >
                  {{ t('creator.inboxLoadMore') }}
                </button>
              </div>
            </div>
          </div>
        </section>

        <!-- ── Weekly pins ─────────────────────────────────────── -->
        <section
          id="fenetre"
          class="creator-glass-panel mb-11 sm:mb-14 scroll-mt-28 overflow-hidden rounded-[1.65rem] border border-neutral-200/75 bg-white/78 shadow-[0_28px_80px_-40px_rgba(15,23,42,0.38)] backdrop-blur-xl ring-1 ring-black/[0.02] dark:border-white/[0.07] dark:bg-neutral-900/55 dark:shadow-black/55 dark:ring-white/[0.04]"
        >
          <!-- Header -->
          <div
            class="border-b border-neutral-200/75 px-5 py-6 sm:px-8 sm:py-8 dark:border-white/[0.06] bg-gradient-to-br from-white via-neutral-50/85 to-white dark:from-neutral-900 dark:via-neutral-900/95 dark:to-neutral-950"
          >
            <div class="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between lg:gap-8">
              <div class="min-w-0 flex-1 space-y-3">
                <div class="flex items-center gap-3">
                  <span
                    class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-gradient-to-br from-pink-500/18 to-fuchsia-600/14 ring-1 ring-pink-500/25 dark:from-pink-500/25 dark:to-fuchsia-600/18 dark:ring-pink-400/20"
                  >
                    <i class="fa-solid fa-chart-line block text-[1.05rem] leading-none text-pink-700 dark:text-pink-300" aria-hidden="true"></i>
                  </span>
                  <h2
                    id="creator-week-heading"
                    class="text-xl font-bold text-neutral-950 dark:text-neutral-50 sm:text-[1.35rem]"
                  >
                    {{ t('creator.sectionWeekly') }}
                  </h2>
                </div>
                <p class="max-w-prose text-sm leading-relaxed text-neutral-500 dark:text-neutral-400">
                  {{ t('creator.weeklyExplain') }}
                </p>
                <div class="flex flex-wrap gap-2 mt-4">
                  <button
                    v-for="d in ([7, 14, 28] as const)"
                    :key="d"
                    type="button"
                    class="rounded-full px-4 py-2 text-xs font-bold transition-[transform,box-shadow,colors] border"
                    :class="
                      periodDays === d
                        ? 'border-pink-600 bg-gradient-to-r from-pink-600 to-fuchsia-600 text-white shadow-md shadow-pink-600/30 scale-[1.02]'
                        : 'border-neutral-200/90 bg-white/90 text-neutral-600 shadow-sm backdrop-blur-sm hover:border-pink-300 hover:bg-white dark:border-neutral-600 dark:bg-neutral-800/80 dark:text-neutral-300 dark:hover:border-pink-500/50'
                    "
                    @click="setPeriodDaysChoice(d)"
                  >
                    {{ t('creator.periodDaysChip', { n: d }) }}
                  </button>
                </div>
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

          <div
            v-if="periodComparisonHint"
            class="px-5 py-3 sm:px-7 border-b border-neutral-100 dark:border-neutral-800
                   bg-sky-50/80 dark:bg-sky-950/25 text-sm text-sky-900 dark:text-sky-100"
          >
            {{ periodComparisonHint }}
          </div>

          <!-- List body -->
          <div class="bg-gradient-to-b from-neutral-50/40 to-transparent px-4 py-6 sm:px-8 sm:py-8 dark:from-neutral-950/30">
            <ul v-if="weeklyPins.length" class="flex flex-col gap-4 md:gap-5">
              <li
                v-for="(p, idx) in weeklyPins"
                :key="p.id"
                class="group flex gap-4 overflow-hidden rounded-[1.35rem] border border-neutral-200/75 bg-white/85 shadow-[0_12px_36px_-28px_rgba(15,23,42,0.28)] transition-all duration-200 hover:border-pink-200/90 hover:shadow-[0_18px_44px_-26px_rgba(219,39,119,0.22)] dark:border-white/[0.06] dark:bg-neutral-900/40 dark:hover:border-pink-500/35"
              >
                <!-- Rank badge -->
                <span
                  class="ms-4 flex size-11 shrink-0 self-center rounded-full text-base font-black tabular-nums shadow-inner ring-2 sm:ms-5"
                  :class="rankAccent(idx)"
                  aria-hidden="true"
                >{{ idx + 1 }}</span>

                <!-- Thumbnail -->
                <router-link
                  :to="`/pin/${p.slug}`"
                  class="my-4 shrink-0 w-[4.75rem] h-[4.75rem] sm:my-5 sm:h-[5.25rem] sm:w-[5.25rem]
                         rounded-xl overflow-hidden
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
                  <i
                    v-else
                    class="fa-solid fa-thumbtack flex size-full items-center justify-center text-neutral-400 dark:text-neutral-600 text-[2rem] leading-none"
                    aria-hidden="true"
                  ></i>
                </router-link>

                <!-- Content -->
                <div class="min-w-0 flex-1 pe-5 py-5 flex flex-col justify-center gap-2.5">
                  <router-link
                    :to="`/pin/${p.slug}`"
                    class="font-bold text-neutral-950 dark:text-neutral-100
                           hover:text-pink-800 dark:hover:text-pink-800
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
                      <i class="fa-solid fa-eye text-[15px] text-sky-500 leading-none" aria-hidden="true"></i>
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
                      <i class="fa-solid fa-heart text-[15px] text-rose-500 dark:text-rose-400 leading-none" aria-hidden="true"></i>
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
                      <i class="fa-solid fa-bookmark text-[15px] text-teal-500 dark:text-teal-400 leading-none" aria-hidden="true"></i>
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
                      <i class="fa-solid fa-comment text-[15px] text-amber-500 dark:text-amber-400 leading-none" aria-hidden="true"></i>
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
                       hover:text-pink-800 dark:hover:text-pink-800
                       disabled:opacity-40 transition-all duration-150"
                :disabled="weeklyPinsLoadingMore"
                @click="loadMoreWeeklyPins"
              >
                <i class="fa-solid fa-chevron-down text-[16px] leading-none" aria-hidden="true"></i>
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
              <i class="fa-solid fa-chart-column text-[48px] text-neutral-300 dark:text-neutral-600 mb-4 leading-none" aria-hidden="true"></i>
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
          class="creator-glass-panel mb-11 sm:mb-14 scroll-mt-28 overflow-hidden rounded-[1.65rem] border border-neutral-200/75 bg-white/78 shadow-[0_24px_70px_-38px_rgba(15,23,42,0.35)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-neutral-900/55 dark:shadow-black/50"
        >
          <!-- Header -->
          <div
            class="flex items-center gap-3 border-b border-neutral-200/75 px-5 py-5 sm:px-8 sm:py-6 dark:border-white/[0.06] bg-gradient-to-r from-neutral-50/95 via-white to-neutral-50/90 dark:from-neutral-900 dark:via-neutral-900 dark:to-neutral-950"
          >
            <span
              class="flex size-10 shrink-0 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400/25 to-orange-500/20 ring-1 ring-amber-500/25 dark:from-amber-400/20 dark:to-orange-500/15"
            >
              <i class="fa-solid fa-medal block text-[15px] leading-none text-amber-800 dark:text-amber-200" aria-hidden="true"></i>
            </span>
            <h2
              id="creator-top-heading"
              class="text-xl font-bold text-neutral-950 dark:text-neutral-50"
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
                  class="flex size-10 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums shadow-inner ring-2"
                  :class="rankAccent(idx)"
                  aria-hidden="true"
                >{{ idx + 1 }}</span>
                <router-link
                  :to="`/pin/${p.slug}`"
                  class="font-semibold
                         text-neutral-900 dark:text-neutral-100
                         hover:text-pink-800 dark:hover:text-pink-800
                         truncate min-w-0 text-[15px] sm:text-base
                         transition-colors"
                >{{ p.title }}</router-link>
              </div>

              <!-- Right: stats -->
              <div class="flex items-center gap-4 sm:gap-5 ps-[3.25rem] sm:ps-0 shrink-0
                          text-xs sm:text-sm text-neutral-500 dark:text-neutral-400 tabular-nums">
                <span class="inline-flex items-center gap-1.5">
                  <i class="fa-solid fa-eye text-[15px] text-sky-500 leading-none" aria-hidden="true"></i>
                  {{ formatStat(p.views) }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <i class="fa-solid fa-heart text-[15px] text-rose-500 leading-none" aria-hidden="true"></i>
                  {{ formatStat(p.likes) }}
                </span>
                <span class="inline-flex items-center gap-1.5">
                  <i class="fa-solid fa-bookmark text-[15px] text-teal-500 leading-none" aria-hidden="true"></i>
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
                     hover:text-pink-800 dark:hover:text-pink-800
                     disabled:opacity-40 transition-all duration-150"
              :disabled="topPinsLoadingMore"
              @click="loadMoreTopPins"
            >
              <i class="fa-solid fa-chevron-down text-[16px] leading-none" aria-hidden="true"></i>
              {{ t('creator.loadMoreTop') }}
            </button>
          </div>
        </section>

        <!-- ── Footer hint ─────────────────────────────────────── -->
        <footer class="border-t border-neutral-200/75 pt-8 dark:border-white/[0.06]">
          <div
            class="flex flex-col gap-5 rounded-[1.35rem] border border-neutral-200/75 bg-white/70 px-5 py-5 shadow-[0_16px_48px_-36px_rgba(15,23,42,0.28)] backdrop-blur-xl dark:border-white/[0.07] dark:bg-neutral-900/50 sm:flex-row sm:items-center sm:justify-between sm:gap-6 sm:px-7 sm:py-6"
          >
            <div class="flex items-start gap-4 min-w-0">
              <span
                class="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-neutral-100 ring-1 ring-black/[0.04] dark:bg-neutral-800 dark:ring-white/[0.06]"
              >
                <i
                  class="fa-solid fa-envelope block text-[16px] leading-none text-neutral-500 dark:text-neutral-300"
                  aria-hidden="true"
                ></i>
              </span>
              <div>
                <p class="text-sm font-semibold text-neutral-800 dark:text-neutral-100">
                  {{ t('creator.digestToggle') }}
                </p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
                  {{ t('creator.digestFootnote') }}
                </p>
              </div>
            </div>
            <button
              type="button"
              role="switch"
              :aria-checked="digestWeekly"
              class="relative shrink-0 h-11 w-[3.35rem] rounded-full transition-colors border
                     border-neutral-200 dark:border-neutral-600
                     disabled:opacity-50 self-start sm:self-center"
              :class="digestWeekly ? 'bg-pink-600' : 'bg-neutral-200 dark:bg-neutral-700'"
              :disabled="digestSaving"
              @click="toggleDigestWeb"
            >
              <span
                class="absolute top-1 left-1 size-9 rounded-full bg-white shadow-md transition-transform duration-200"
                :style="{ transform: digestWeekly ? 'translateX(1.35rem)' : 'translateX(0)' }"
              />
            </button>
          </div>
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
                           text-pink-700 dark:text-pink-600"
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
                  <i class="fa-solid fa-xmark text-lg leading-none" aria-hidden="true"></i>
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

<style scoped>
/* Font Awesome : centrage optique des glyphes dans les pastilles KPI */
.creator-kpi-icon-well > i.fa-solid {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 1.35rem;
  height: 1.35rem;
  line-height: 1;
}
</style>