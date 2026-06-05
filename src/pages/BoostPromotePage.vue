<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'

type Pack = {
  slug: string
  label: string
  duration_hours: number
  amount: number
  currency_iso: string
}

type BoostRow = {
  id: number
  pin_slug: string
  pin_title: string
  package_label: string
  status: string
  starts_at: string | null
  ends_at: string | null
}

const route = useRoute()
const router = useRouter()
const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { showAlert } = useAppModal()

const pinSlug = computed(() => String(route.query.pin || route.params.pinSlug || '').trim())
const packs = ref<Pack[]>([])
const history = ref<BoostRow[]>([])
const busy = ref(false)
const loading = ref(true)

const benefits = computed(() => [
  t('promote.boost.benefit1'),
  t('promote.boost.benefit2'),
  t('promote.boost.benefit3'),
  t('promote.boost.benefit4'),
])

onMounted(async () => {
  if (!isAuthenticated.value) {
    void router.replace({ name: 'login', query: { redirect: encodeURIComponent(route.fullPath) } })
    return
  }
  loading.value = true
  try {
    const [packRes, histRes] = await Promise.all([
      api.get<{ results: Pack[] }>('monetization/boost-packages/'),
      api.get<{ results: BoostRow[] }>('monetization/my-boosts/'),
    ])
    packs.value = packRes.data.results ?? []
    history.value = histRes.data.results ?? []
  } finally {
    loading.value = false
  }
})

watch(pinSlug, () => undefined)

function formatDuration(h: number) {
  if (h >= 168) return t('promote.boost.durationDays', { n: Math.round(h / 24) })
  if (h >= 24) return t('promote.boost.durationDay', { n: Math.round(h / 24) })
  return t('promote.boost.durationHours', { n: h })
}

async function startBoost(slug: string) {
  if (!pinSlug.value) {
    await showAlert(t('promote.boost.pickPinFirst'), { variant: 'warning' })
    return
  }
  busy.value = true
  try {
    const res = await api.post(`monetization/pins/${encodeURIComponent(pinSlug.value)}/boost/`, {
      package: slug,
    })
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      window.location.href = data.checkout_url
      return
    }
    if (data.status === 'active') {
      await showAlert(t('pin.boost.success'), { variant: 'success' })
      const histRes = await api.get<{ results: BoostRow[] }>('monetization/my-boosts/')
      history.value = histRes.data.results ?? []
      return
    }
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-8 space-y-8">
    <header class="space-y-2">
      <p class="text-xs font-bold uppercase tracking-widest text-pink-600 dark:text-pink-400">
        {{ t('promote.boost.kicker') }}
      </p>
      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-50">
        {{ t('promote.boost.title') }}
      </h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 max-w-xl">
        {{ t('promote.boost.subtitle') }}
      </p>
      <div v-if="pinSlug" class="inline-flex items-center gap-2 rounded-full bg-pink-50 dark:bg-pink-950/40 px-3 py-1 text-xs font-medium text-pink-800 dark:text-pink-200">
        <span class="material-symbols-outlined text-base">push_pin</span>
        {{ pinSlug }}
      </div>
      <div v-else class="flex flex-wrap gap-2 pt-1">
        <button
          type="button"
          class="text-sm font-semibold text-pink-700 dark:text-pink-300 underline"
          @click="router.push({ path: `/profile/${encodeURIComponent(currentUser?.username || '')}` })"
        >
          {{ t('promote.boost.chooseFromProfile') }}
        </button>
      </div>
    </header>

    <section class="grid sm:grid-cols-2 gap-3">
      <div
        v-for="(b, i) in benefits"
        :key="i"
        class="flex gap-3 rounded-2xl border app-divider-subtle p-4 bg-white/60 dark:bg-neutral-900/40"
      >
        <span class="material-symbols-outlined text-pink-600 dark:text-pink-400">verified</span>
        <p class="text-sm text-neutral-700 dark:text-neutral-300">{{ b }}</p>
      </div>
    </section>

    <section v-if="loading" class="text-center py-8 text-neutral-500">{{ t('common.loading') }}</section>

    <section v-else class="space-y-3">
      <h2 class="text-lg font-semibold">{{ t('promote.boost.packagesTitle') }}</h2>
      <div class="grid gap-3">
        <button
          v-for="p in packs"
          :key="p.slug"
          type="button"
          class="group flex items-center justify-between rounded-2xl border-2 border-pink-200/60 dark:border-pink-500/30 bg-gradient-to-r from-white to-pink-50/50 dark:from-neutral-900 dark:to-pink-950/20 px-5 py-4 text-left transition hover:border-pink-500 hover:shadow-md disabled:opacity-50"
          :disabled="busy || !pinSlug"
          @click="startBoost(p.slug)"
        >
          <div>
            <p class="font-semibold text-neutral-900 dark:text-neutral-100">{{ p.label }}</p>
            <p class="text-xs text-neutral-500 mt-0.5">{{ formatDuration(p.duration_hours) }}</p>
          </div>
          <div class="text-right">
            <p class="text-lg font-bold text-pink-700 dark:text-pink-300">{{ p.amount }} {{ p.currency_iso }}</p>
            <p class="text-[10px] uppercase tracking-wide text-neutral-400 group-hover:text-pink-600">
              {{ t('promote.boost.cta') }}
            </p>
          </div>
        </button>
      </div>
    </section>

    <section class="space-y-3">
      <div class="flex items-center justify-between">
        <h2 class="text-lg font-semibold">{{ t('promote.boost.historyTitle') }}</h2>
        <button
          type="button"
          class="text-sm font-semibold text-pink-700 dark:text-pink-300"
          @click="router.push({ name: 'pin-promo-campaigns' })"
        >
          {{ t('promote.campaigns.link') }}
        </button>
      </div>
      <div v-if="!history.length" class="rounded-2xl border app-divider-subtle p-6 text-center text-sm text-neutral-500">
        {{ t('promote.boost.historyEmpty') }}
      </div>
      <div v-else class="space-y-2">
        <div
          v-for="row in history"
          :key="row.id"
          class="flex items-center justify-between rounded-xl border app-divider-subtle px-4 py-3 text-sm"
        >
          <div>
            <p class="font-medium">{{ row.pin_title || row.pin_slug }}</p>
            <p class="text-xs text-neutral-500">{{ row.package_label }} · {{ row.status }}</p>
          </div>
          <button
            type="button"
            class="text-xs font-semibold text-pink-700"
            @click="router.push({ name: 'boost-promote', query: { pin: row.pin_slug } })"
          >
            {{ t('promote.boost.again') }}
          </button>
        </div>
      </div>
    </section>
  </div>
</template>
