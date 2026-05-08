<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useAds } from '../../composables/useAds'

const props = defineProps<{
  slot: string
  format?: 'auto' | 'rectangle' | 'fluid'
}>()

const root = ref<HTMLElement | null>(null)
const { ADSENSE_CLIENT, canRenderAds, pushAd } = useAds()

onMounted(() => {
  if (!root.value || !canRenderAds.value) return
  const observer = new IntersectionObserver(
    (entries) => {
      const isVisible = entries.some((entry) => entry.isIntersecting)
      if (!isVisible) return
      pushAd()
      observer.disconnect()
    },
    { threshold: 0.2 },
  )
  observer.observe(root.value)
})
</script>

<template>
  <div ref="root" class="rounded-2xl border border-neutral-200/80 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-3">
    <div v-if="canRenderAds" class="min-h-[120px]">
      <ins
        class="adsbygoogle block w-full"
        :data-ad-client="ADSENSE_CLIENT"
        :data-ad-slot="slot"
        :data-ad-format="format ?? 'auto'"
        data-full-width-responsive="true"
      />
    </div>
    <div v-else class="min-h-[120px] rounded-xl bg-neutral-100 dark:bg-neutral-800 animate-pulse" />
  </div>
</template>
