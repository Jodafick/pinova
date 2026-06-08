<script setup lang="ts">
import { nextTick, onMounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import { queueAdsenseFill } from '../lib/adsense'

const props = withDefaults(
  defineProps<{
    clientId: string
    slotId: string
    format?: string
    variant?: 'feed' | 'detail'
    /** Identifiant stable (grille) — force un nouveau `<ins>` si l'emplacement change. */
    adKey?: string
  }>(),
  { format: 'auto', variant: 'feed', adKey: '' },
)

const { t } = useI18n()
const insRef = ref<HTMLElement | null>(null)

async function scheduleFill() {
  if (!props.clientId || !props.slotId) return
  await nextTick()
  const ins = insRef.value
  if (!ins) return
  queueAdsenseFill(ins, props.clientId)
}

onMounted(() => {
  void scheduleFill()
})

watch(
  () => [props.clientId, props.slotId, props.adKey] as const,
  (next, prev) => {
    if (prev && next[0] === prev[0] && next[1] === prev[1] && next[2] === prev[2]) return
    const ins = insRef.value
    if (ins) delete ins.dataset.pinovaAdQueued
    void scheduleFill()
  },
)
</script>

<template>
  <article
    class="network-ad-card overflow-hidden rounded-3xl border border-neutral-200/80 dark:border-neutral-700/60 bg-white dark:bg-neutral-900 shadow-sm"
    :class="variant === 'feed' ? 'min-h-[5.5rem]' : ''"
    aria-label="Publicité"
  >
    <div class="flex items-center justify-between gap-2 px-3 pt-2 pb-1">
      <span class="text-[9px] font-bold uppercase tracking-wide text-neutral-400">
        {{ t('feed.networkAd.badge') }}
      </span>
    </div>
    <div class="network-ad-slot min-h-[90px] px-2 pb-2">
      <ins
        :key="adKey || `${clientId}-${slotId}`"
        ref="insRef"
        class="adsbygoogle block"
        :data-ad-client="clientId"
        :data-ad-slot="slotId"
        :data-ad-format="format"
        data-full-width-responsive="true"
      />
    </div>
  </article>
</template>

<style scoped>
.network-ad-slot :deep(ins.adsbygoogle) {
  min-height: 90px;
}
</style>
