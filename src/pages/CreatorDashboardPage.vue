<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import CreatorDashboardSkeleton from '../components/CreatorDashboardSkeleton.vue'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { useI18n } from '../i18n'

const { t, currentLang } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated, fetchCurrentUser } = useAuth()
const { fetchCreatorStats, fetchCreatorWeeklyStats } = usePins()

const loading = ref(true)
const errorMsg = ref('')
const creatorTotals = ref<Record<string, number> | null>(null)
const topAllTime = ref<
  { id: number; slug: string; title: string; likes: number; saves: number; views: number }[]
>([])
const weeklyPins = ref<
  { id: number; slug: string; title: string; views_week: number; thumbnail_url: string | null }[]
>([])
const weeklyMeta = ref<{ total_view_events_period: number; period_days: number } | null>(null)

const isPro = computed(() => currentUser.value?.subscription?.plan === 'pro')

type TotalKey = 'pins' | 'views' | 'saves' | 'likes' | 'comments'

type KpiSpec = {
  key: TotalKey
  labelKey: string
  icon: string
  ring: string
  border: string
  iconWrap: string
  subtle: string
}

const kpiSpecs: readonly KpiSpec[] = [
  {
    key: 'pins',
    labelKey: 'creator.kpiPins',
    icon: 'push_pin',
    ring: 'ring-violet-500/15',
    border: 'border-violet-200/85',
    iconWrap: 'bg-violet-100 text-violet-700',
    subtle: 'from-violet-50/90 to-white',
  },
  {
    key: 'views',
    labelKey: 'creator.kpiViews',
    icon: 'visibility',
    ring: 'ring-sky-500/15',
    border: 'border-sky-200/85',
    iconWrap: 'bg-sky-100 text-sky-800',
    subtle: 'from-sky-50/90 to-white',
  },
  {
    key: 'saves',
    labelKey: 'creator.kpiSaves',
    icon: 'bookmark',
    ring: 'ring-teal-500/15',
    border: 'border-teal-200/85',
    iconWrap: 'bg-teal-100 text-teal-800',
    subtle: 'from-teal-50/90 to-white',
  },
  {
    key: 'likes',
    labelKey: 'creator.kpiLikes',
    icon: 'favorite',
    ring: 'ring-rose-500/15',
    border: 'border-rose-200/85',
    iconWrap: 'bg-rose-100 text-rose-700',
    subtle: 'from-rose-50/90 to-white',
  },
  {
    key: 'comments',
    labelKey: 'creator.kpiComments',
    icon: 'chat_bubble',
    ring: 'ring-amber-500/15',
    border: 'border-amber-200/85',
    iconWrap: 'bg-amber-100 text-amber-900',
    subtle: 'from-amber-50/90 to-white',
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

function rankAccent(idx: number) {
  if (idx === 0) {
    return 'bg-gradient-to-br from-amber-200/95 via-amber-100 to-yellow-50 text-amber-950 ring-2 ring-amber-400/85 shadow-sm'
  }
  if (idx === 1) {
    return 'bg-gradient-to-br from-neutral-200/98 to-neutral-50 text-neutral-800 ring-2 ring-neutral-400/65 shadow-sm'
  }
  if (idx === 2) {
    return 'bg-gradient-to-br from-orange-200/96 to-orange-50 text-orange-950 ring-2 ring-orange-400/65 shadow-sm'
  }
  return 'bg-white text-neutral-800 ring-2 ring-neutral-200/90 shadow-sm'
}

const load = async () => {
  if (!isAuthenticated.value || !isPro.value) {
    loading.value = false
    return
  }
  loading.value = true
  errorMsg.value = ''
  try {
    const [all, weekly] = await Promise.all([fetchCreatorStats(), fetchCreatorWeeklyStats(7)])
    creatorTotals.value = all?.totals || null
    topAllTime.value = all?.top_pins || []
    weeklyPins.value = weekly?.top_pins || []
    weeklyMeta.value = {
      total_view_events_period: weekly?.total_view_events_period ?? 0,
      period_days: weekly?.period_days ?? 7,
    }
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
    class="min-h-[calc(100vh-6rem)] sm:min-h-[calc(100vh-8rem)] bg-gradient-to-b from-violet-50/45 via-white to-neutral-50/90"
  >
    <div class="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-10 py-6 sm:py-10 lg:py-12">
      <!-- Chargement : squelette tableau de bord -->
      <div v-if="loading" aria-busy="true">
        <span class="sr-only">{{ t('app.loading') }}</span>
        <CreatorDashboardSkeleton />
      </div>

      <template v-else>
        <nav
          class="flex flex-wrap gap-4 items-center justify-between mb-8 sm:mb-10 gap-y-4"
          aria-label="breadcrumb"
        >
          <router-link
            to="/"
            class="inline-flex items-center gap-2 text-sm font-semibold text-neutral-700 hover:text-pink-600 transition-colors rounded-xl px-3 py-2 -ml-1 hover:bg-white/70 border border-transparent hover:border-neutral-200/80"
          >
            <span class="material-symbols-outlined text-[20px]" aria-hidden="true">home</span>
            {{ t('nav.home') }}
          </router-link>
          <router-link
            to="/create"
            class="inline-flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-bold bg-neutral-950 text-white shadow-lg shadow-neutral-950/25 hover:bg-neutral-900 transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-neutral-950"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">add</span>
            {{ t('nav.create') }}
          </router-link>
        </nav>

        <div class="relative overflow-hidden rounded-[1.65rem] sm:rounded-[2rem] bg-gradient-to-br from-fuchsia-600 via-purple-700 to-indigo-900 text-white shadow-2xl shadow-purple-950/35 ring-1 ring-black/10 mb-10 sm:mb-12 isolate">
          <div
            class="pointer-events-none absolute -right-24 -top-28 h-72 w-72 rounded-full bg-white/14 blur-3xl"
            aria-hidden="true"
          />
          <div
            class="pointer-events-none absolute -bottom-32 -left-16 h-64 w-64 rounded-full bg-fuchsia-400/18 blur-3xl"
            aria-hidden="true"
          />
          <div
            class="pointer-events-none absolute inset-0 bg-[linear-gradient(to_bottom_right,_transparent_48%,rgba(255,255,255,0.06)_72%,transparent)]"
            aria-hidden="true"
          />
          <div class="relative p-6 sm:p-9 md:p-10 flex flex-col lg:flex-row lg:items-end gap-10 lg:gap-12 lg:justify-between">
            <div class="flex gap-4 sm:gap-6 min-w-0 flex-1">
              <div
                class="hidden sm:flex size-14 md:size-[4.5rem] shrink-0 rounded-[1rem] md:rounded-2xl bg-white/12 backdrop-blur-md items-center justify-center ring-2 ring-white/25 shadow-inner"
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[32px] md:text-[38px] text-white/95">insights</span>
              </div>
              <header class="min-w-0 flex-1">
                <p class="text-[11px] sm:text-xs font-bold uppercase tracking-[0.22em] text-white/72 mb-2 sm:mb-3">
                  {{ t('creator.badge') }}
                </p>
                <h1 class="text-2xl sm:text-3xl md:text-4xl font-extrabold tracking-tight text-white mb-3 sm:mb-4 drop-shadow-sm">
                  {{ t('creator.title') }}
                </h1>
                <p class="text-sm sm:text-[15px] leading-relaxed text-white/82 max-w-2xl">
                  {{ t('creator.subtitle') }}
                </p>
              </header>
            </div>
            <div class="flex flex-col sm:flex-row gap-3 shrink-0 w-full sm:w-auto lg:max-w-xs">
              <router-link
                to="/settings"
                class="inline-flex items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold bg-white/12 hover:bg-white/18 backdrop-blur-md border border-white/25 text-white transition-colors text-center"
              >
                <span class="material-symbols-outlined text-[18px]" aria-hidden="true">tune</span>
                {{ t('nav.settings') }}
              </router-link>
            </div>
          </div>
        </div>

        <div
          v-if="errorMsg"
          class="mb-10 rounded-2xl border border-rose-200/90 bg-rose-50/90 px-5 py-6 sm:px-7 sm:py-7 text-center shadow-sm"
          role="alert"
        >
          <span class="material-symbols-outlined text-rose-500 text-[40px] mb-3 inline-block" aria-hidden="true"
            >error</span
          >
          <p class="text-sm sm:text-base text-rose-900 font-medium">{{ errorMsg }}</p>
          <button
            type="button"
            class="mt-5 inline-flex items-center justify-center gap-2 rounded-full px-6 py-2.5 text-sm font-bold bg-rose-600 text-white hover:bg-rose-500 transition-colors"
            @click="load"
          >
            <span class="material-symbols-outlined text-[18px]" aria-hidden="true">refresh</span>
            {{ t('creator.retry') }}
          </button>
        </div>

        <section aria-labelledby="creator-totals-heading" class="mb-10 sm:mb-12">
          <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-5 sm:mb-6">
            <h2 id="creator-totals-heading" class="text-xl sm:text-2xl font-bold tracking-tight text-neutral-950">
              {{ t('creator.sectionTotals') }}
            </h2>
            <span class="text-xs font-semibold uppercase tracking-wider text-neutral-500">{{ t('creator.badge') }}</span>
          </div>
          <div class="grid grid-cols-2 sm:grid-cols-5 gap-3 sm:gap-4">
            <div
              v-for="item in kpis"
              :key="item.key"
              class="group rounded-2xl border p-4 sm:p-5 flex gap-3 sm:flex-col sm:items-stretch lg:flex-row lg:items-center lg:gap-4 ring-4 transition-[box-shadow] hover:shadow-md bg-gradient-to-br"
              :class="[item.border, item.ring, item.subtle]"
            >
              <span
                class="material-symbols-outlined shrink-0 size-11 sm:size-[3.125rem] rounded-xl flex items-center justify-center text-[22px]"
                :class="item.iconWrap"
                aria-hidden="true"
                >{{ item.icon }}</span
              >
              <div class="min-w-0 flex-1 sm:text-center lg:text-left">
                <p class="text-[11px] sm:text-xs font-semibold uppercase tracking-wide text-neutral-600 mb-0.5 lg:mb-1">
                  {{ item.label }}
                </p>
                <p class="tabular-nums text-xl sm:text-2xl lg:text-[1.75rem] font-extrabold text-neutral-950 tracking-tight">
                  {{ item.formatted }}
                </p>
              </div>
            </div>
          </div>
        </section>

        <section class="mb-10 sm:mb-12 rounded-[1.5rem] sm:rounded-[1.85rem] border border-neutral-200/80 bg-white/92 backdrop-blur-sm shadow-xl shadow-neutral-950/[0.04] ring-1 ring-black/[0.03] overflow-hidden">
          <div class="border-b border-neutral-100 px-5 py-5 sm:px-7 sm:py-7 bg-gradient-to-br from-neutral-50/98 to-white">
            <div class="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4">
              <div class="min-w-0 flex-1">
                <h2 id="creator-week-heading" class="text-lg sm:text-xl font-bold text-neutral-950 mb-3">
                  {{ t('creator.sectionWeekly') }}
                </h2>
                <p class="text-sm text-neutral-600 leading-relaxed max-w-prose">{{ t('creator.weeklyExplain') }}</p>
              </div>
              <p v-if="weeklyMeta" class="text-xs font-medium text-neutral-600 shrink-0 py-2 px-3 rounded-xl bg-neutral-900/[0.04] border border-neutral-200/60 self-start">
                {{
                  t('creator.weeklyEvents', {
                    count: weeklyMeta.total_view_events_period,
                    days: weeklyMeta.period_days,
                  })
                }}
              </p>
            </div>
          </div>
          <div class="p-4 sm:p-6 md:p-7">
            <ul v-if="weeklyPins.length" class="flex flex-col gap-3 md:gap-4">
              <li
                v-for="(p, idx) in weeklyPins"
                :key="p.id"
                class="flex gap-4 rounded-2xl border border-neutral-100 bg-neutral-50/60 hover:bg-white hover:border-pink-200/80 hover:shadow-md transition-[background-color,box-shadow,border-color] overflow-hidden group"
              >
                <span
                  class="mt-5 ms-5 flex size-10 shrink-0 items-center justify-center rounded-full text-lg font-black tabular-nums shadow-sm ring-2"
                  :class="rankAccent(idx)"
                  aria-hidden="true"
                  >{{ idx + 1 }}</span
                >
                <router-link
                  :to="`/pin/${p.slug}`"
                  class="shrink-0 w-[4.75rem] h-[4.75rem] sm:w-[5.25rem] sm:h-[5.25rem] my-5 rounded-xl overflow-hidden bg-neutral-200 ring-1 ring-neutral-200/85"
                  :aria-label="p.title"
                >
                  <img
                    v-if="p.thumbnail_url"
                    :src="p.thumbnail_url"
                    :alt="p.title"
                    class="size-full object-cover group-hover:scale-[1.03] transition-transform duration-300"
                    loading="lazy"
                    decoding="async"
                  />
                  <span v-else class="flex size-full items-center justify-center material-symbols-outlined text-neutral-400 text-[2rem]"
                    >push_pin</span
                  >
                </router-link>
                <div class="min-w-0 flex-1 pe-5 py-5 flex flex-col justify-center gap-2">
                  <router-link :to="`/pin/${p.slug}`" class="font-bold text-neutral-950 hover:text-pink-600 line-clamp-2 text-[15px] sm:text-base leading-snug transition-colors">{{
                    p.title
                  }}</router-link>
                  <p class="inline-flex flex-wrap items-center gap-2 text-xs sm:text-[13px] text-neutral-600">
                    <span class="inline-flex items-center gap-1 rounded-full bg-white/95 px-2.5 py-1 ring-1 ring-neutral-200/80 shadow-sm tabular-nums">
                      <span class="material-symbols-outlined text-[16px] text-sky-600" aria-hidden="true">visibility</span>
                      {{ t('creator.viewsThisWeek', { count: p.views_week }) }}
                    </span>
                  </p>
                </div>
              </li>
            </ul>
            <div
              v-else
              class="flex flex-col items-center justify-center text-center px-6 py-16 sm:py-20 rounded-xl border border-dashed border-neutral-200 bg-neutral-50/65"
            >
              <span class="material-symbols-outlined text-[48px] text-neutral-300 mb-4" aria-hidden="true">bar_chart</span>
              <p class="text-neutral-700 text-sm max-w-md leading-relaxed">{{ t('creator.weeklyEmpty') }}</p>
            </div>
          </div>
        </section>

        <section
          v-if="topAllTime.length"
          aria-labelledby="creator-top-heading"
          class="mb-10 sm:mb-12 rounded-[1.5rem] sm:rounded-[1.85rem] border border-neutral-200/80 bg-white/95 shadow-lg shadow-neutral-950/[0.03] overflow-hidden"
        >
          <div class="px-5 py-5 sm:px-7 sm:py-6 border-b border-neutral-100 bg-gradient-to-r from-neutral-50 to-white">
            <h2 id="creator-top-heading" class="text-lg sm:text-xl font-bold text-neutral-950">
              {{ t('creator.sectionTopAll') }}
            </h2>
          </div>
          <ul class="divide-y divide-neutral-100">
            <li
              v-for="(p, idx) in topAllTime"
              :key="p.id"
              class="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 px-5 py-4 sm:px-7 sm:py-4 hover:bg-pink-50/40 transition-colors"
            >
              <div class="flex items-center gap-4 min-w-0 flex-1">
                <span
                  class="flex size-9 shrink-0 items-center justify-center rounded-full text-sm font-black tabular-nums ring-2 shadow-sm"
                  :class="rankAccent(idx)"
                  aria-hidden="true"
                  >{{ idx + 1 }}</span
                >
                <router-link
                  :to="`/pin/${p.slug}`"
                  class="font-semibold text-neutral-950 hover:text-pink-600 truncate min-w-0 text-[15px] sm:text-base"
                  >{{ p.title }}</router-link
                >
              </div>
              <div class="flex items-center gap-4 sm:gap-5 ps-[3.25rem] sm:ps-0 shrink-0 text-xs sm:text-sm text-neutral-600 tabular-nums">
                <span class="inline-flex items-center gap-1 text-neutral-600">
                  <span class="material-symbols-outlined text-[18px] text-sky-600" aria-hidden="true">visibility</span>
                  {{ formatStat(p.views) }}
                </span>
                <span class="inline-flex items-center gap-1 text-neutral-600">
                  <span class="material-symbols-outlined text-[18px] text-rose-500" aria-hidden="true">favorite</span>
                  {{ formatStat(p.likes) }}
                </span>
              </div>
            </li>
          </ul>
        </section>

        <footer class="pt-5 border-t border-neutral-200/80">
          <p class="flex flex-wrap items-start gap-x-3 gap-y-2 text-xs sm:text-[13px] text-neutral-500 leading-relaxed max-w-[56rem]">
            <span class="material-symbols-outlined text-[18px] text-neutral-400 shrink-0 mt-0.5" aria-hidden="true">mail</span>
            <span>{{ t('creator.digestHint') }}</span>
          </p>
        </footer>
      </template>
    </div>
  </main>
</template>
