<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { useI18n } from '../i18n'

const { t } = useI18n()
const router = useRouter()
const { currentUser, isAuthenticated, fetchCurrentUser } = useAuth()
const { fetchCreatorStats, fetchCreatorWeeklyStats } = usePins()

const loading = ref(true)
const weeklyLoading = ref(true)
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

const load = async () => {
  if (!isAuthenticated.value || !isPro.value) {
    loading.value = false
    weeklyLoading.value = false
    return
  }
  loading.value = true
  weeklyLoading.value = true
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
    weeklyLoading.value = false
  }
}

onMounted(async () => {
  // silent: évite isInitializing → App masque <main> et démonte cette page (boucle de spinner).
  await fetchCurrentUser({ silent: true }).catch(() => undefined)
  if (!isAuthenticated.value) {
    router.replace('/login')
    return
  }
  if (!isPro.value) {
    router.replace('/premium')
    return
  }
  void load()
})
</script>

<template>
  <main class="max-w-4xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <p class="text-[11px] font-bold uppercase tracking-wider text-amber-700 mb-2">{{ t('creator.badge') }}</p>
    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">{{ t('creator.title') }}</h1>
    <p class="text-sm text-neutral-600 mb-8">{{ t('creator.subtitle') }}</p>

    <p v-if="errorMsg" class="text-sm text-pink-600 mb-6">{{ errorMsg }}</p>

    <section aria-labelledby="creator-totals-heading" class="mb-10">
      <h2 id="creator-totals-heading" class="text-lg font-semibold text-neutral-900 mb-4">
        {{ t('creator.sectionTotals') }}
      </h2>
      <div v-if="loading" class="text-sm text-neutral-500">{{ t('common.loading') }}</div>
      <div v-else class="grid grid-cols-2 sm:grid-cols-5 gap-3">
        <div class="rounded-xl bg-neutral-50 border border-neutral-100 py-3 text-center">
          <p class="text-xs font-medium text-neutral-600">{{ t('creator.kpiPins') }}</p>
          <p class="text-lg font-bold text-neutral-950">{{ creatorTotals?.pins ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 border border-neutral-100 py-3 text-center">
          <p class="text-xs font-medium text-neutral-600">{{ t('creator.kpiViews') }}</p>
          <p class="text-lg font-bold text-neutral-950">{{ creatorTotals?.views ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 border border-neutral-100 py-3 text-center">
          <p class="text-xs font-medium text-neutral-600">{{ t('creator.kpiSaves') }}</p>
          <p class="text-lg font-bold text-neutral-950">{{ creatorTotals?.saves ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 border border-neutral-100 py-3 text-center">
          <p class="text-xs font-medium text-neutral-600">{{ t('creator.kpiLikes') }}</p>
          <p class="text-lg font-bold text-neutral-950">{{ creatorTotals?.likes ?? 0 }}</p>
        </div>
        <div class="rounded-xl bg-neutral-50 border border-neutral-100 py-3 text-center sm:col-span-1 col-span-2">
          <p class="text-xs font-medium text-neutral-600">{{ t('creator.kpiComments') }}</p>
          <p class="text-lg font-bold text-neutral-950">{{ creatorTotals?.comments ?? 0 }}</p>
        </div>
      </div>
    </section>

    <section aria-labelledby="creator-week-heading" class="mb-10">
      <div class="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-2 mb-4">
        <h2 id="creator-week-heading" class="text-lg font-semibold text-neutral-900">
          {{ t('creator.sectionWeekly') }}
        </h2>
        <p v-if="weeklyMeta" class="text-xs text-neutral-600">
          {{ t('creator.weeklyEvents', { count: weeklyMeta.total_view_events_period, days: weeklyMeta.period_days }) }}
        </p>
      </div>
      <p class="text-sm text-neutral-600 mb-4">{{ t('creator.weeklyExplain') }}</p>
      <div v-if="weeklyLoading" class="text-sm text-neutral-500">{{ t('common.loading') }}</div>
      <ul v-else-if="weeklyPins.length" class="space-y-3">
        <li
          v-for="(p, idx) in weeklyPins"
          :key="p.id"
          class="flex gap-4 rounded-2xl border border-neutral-200 bg-white p-3 sm:p-4"
        >
          <span class="text-sm font-bold text-neutral-400 w-6 shrink-0 pt-1" aria-hidden="true">{{ idx + 1 }}</span>
          <router-link :to="`/pin/${p.slug}`" class="shrink-0 w-16 h-16 rounded-lg overflow-hidden bg-neutral-100">
            <img
              v-if="p.thumbnail_url"
              :src="p.thumbnail_url"
              :alt="p.title"
              class="w-full h-full object-cover"
              loading="lazy"
              decoding="async"
            />
            <span v-else class="flex w-full h-full items-center justify-center text-[10px] text-neutral-400 text-center px-1">
              Pin
            </span>
          </router-link>
          <div class="min-w-0 flex-1">
            <router-link :to="`/pin/${p.slug}`" class="font-semibold text-neutral-950 hover:text-pink-600 line-clamp-2">
              {{ p.title }}
            </router-link>
            <p class="text-xs text-neutral-700 mt-1">
              {{ t('creator.viewsThisWeek', { count: p.views_week }) }}
            </p>
          </div>
        </li>
      </ul>
      <p v-else class="text-sm text-neutral-600">{{ t('creator.weeklyEmpty') }}</p>
    </section>

    <section v-if="topAllTime.length" aria-labelledby="creator-top-heading" class="mb-10">
      <h2 id="creator-top-heading" class="text-lg font-semibold text-neutral-900 mb-4">{{ t('creator.sectionTopAll') }}</h2>
      <ul class="divide-y divide-neutral-100 rounded-2xl border border-neutral-200 bg-white overflow-hidden">
        <li v-for="p in topAllTime" :key="p.id" class="flex justify-between gap-4 px-4 py-3 text-sm">
          <router-link :to="`/pin/${p.slug}`" class="font-medium text-neutral-900 hover:text-pink-600 truncate">
            {{ p.title }}
          </router-link>
          <span class="text-neutral-700 shrink-0 text-xs">{{ p.views }} v. · ♥ {{ p.likes }}</span>
        </li>
      </ul>
    </section>

    <p class="text-xs text-neutral-500">{{ t('creator.digestHint') }}</p>
  </main>
</template>
