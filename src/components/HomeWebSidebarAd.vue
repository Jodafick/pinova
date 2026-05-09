<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import api from '../api'
import { useI18n } from '../i18n'

type Creative = {
  headline?: string
  cta_text?: string
  media_image?: string | null
}

type DeliveryAd = {
  id: string
  headline?: string
  destination_url?: string
  creative?: Creative
}

const { t } = useI18n()

const ad = ref<DeliveryAd | null>(null)
const loading = ref(true)

const title = computed(() => ad.value?.creative?.headline || ad.value?.headline || '')
const cta = computed(() => ad.value?.creative?.cta_text?.trim() || t('home.sidebar.ctaDefault'))
const imageUrl = computed(() => {
  const u = ad.value?.creative?.media_image
  return typeof u === 'string' && u.length > 0 ? u : null
})
const href = computed(() => {
  const u = ad.value?.destination_url?.trim()
  return u && /^https?:\/\//i.test(u) ? u : null
})

onMounted(async () => {
  loading.value = true
  try {
    const { data } = await api.post<{ ads: DeliveryAd[] }>('ads/delivery/candidates/', {
      placement: 'sidebar_web',
      client: { device: 'desktop', os: 'web' },
      session_depth: 1,
      limit: 1,
    })
    ad.value = Array.isArray(data.ads) && data.ads.length > 0 ? data.ads[0]! : null
  } catch {
    ad.value = null
  } finally {
    loading.value = false
  }
})
</script>

<template>
  <div
    v-if="loading"
    class="rounded-2xl border border-neutral-200/80 bg-neutral-50/90 p-4 text-xs text-neutral-500 shadow-sm dark:border-neutral-700 dark:bg-neutral-900/80 dark:text-neutral-400"
  >
    {{ t('home.sidebar.loading') }}
  </div>
  <div
    v-else-if="ad && href"
    class="rounded-2xl border border-neutral-200/80 bg-white/95 p-4 shadow-sm backdrop-blur-md dark:border-neutral-700 dark:bg-neutral-900/90"
  >
    <p class="text-[10px] font-semibold uppercase tracking-[0.2em] text-neutral-500 dark:text-neutral-400">
      {{ t('home.sidebar.sponsored') }}
    </p>
    <div class="mt-3 aspect-[4/3] w-full overflow-hidden rounded-xl bg-gradient-to-br from-pink-100 to-fuchsia-100 dark:from-pink-950/50 dark:to-neutral-900">
      <img v-if="imageUrl" :src="imageUrl" alt="" class="h-full w-full object-cover" loading="lazy" />
    </div>
    <p v-if="title" class="mt-3 text-sm font-medium text-neutral-900 dark:text-neutral-100">
      {{ title }}
    </p>
    <a
      :href="href"
      target="_blank"
      rel="noopener noreferrer"
      class="mt-3 flex w-full items-center justify-center rounded-full border border-neutral-300 py-2 text-xs font-medium text-neutral-800 transition hover:bg-neutral-50 dark:border-neutral-600 dark:text-neutral-100 dark:hover:bg-neutral-800/80"
    >
      {{ cta }}
    </a>
  </div>
</template>
