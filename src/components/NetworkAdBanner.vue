<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'

const props = withDefaults(
  defineProps<{
    clientId: string
    slotId: string
    format?: string
    variant?: 'feed' | 'detail'
  }>(),
  { format: 'auto', variant: 'feed' },
)

const { t } = useI18n()
const containerRef = ref<HTMLElement | null>(null)
let scriptLoaded = false

function loadScript(clientId: string): Promise<void> {
  if (scriptLoaded || document.querySelector('script[src*="adsbygoogle.js"]')) {
    scriptLoaded = true
    return Promise.resolve()
  }
  return new Promise((resolve, reject) => {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${encodeURIComponent(clientId)}`
    script.crossOrigin = 'anonymous'
    script.onload = () => {
      scriptLoaded = true
      resolve()
    }
    script.onerror = reject
    document.head.appendChild(script)
  })
}

async function renderAd() {
  if (!props.clientId || !props.slotId || !containerRef.value) return
  try {
    await loadScript(props.clientId)
    const ins = document.createElement('ins')
    ins.className = 'adsbygoogle'
    ins.style.display = 'block'
    ins.setAttribute('data-ad-client', props.clientId)
    ins.setAttribute('data-ad-slot', props.slotId)
    ins.setAttribute('data-ad-format', props.format)
    ins.setAttribute('data-full-width-responsive', 'true')
    containerRef.value.replaceChildren(ins)
    const w = window as Window & { adsbygoogle?: unknown[] }
    w.adsbygoogle = w.adsbygoogle || []
    w.adsbygoogle.push({})
  } catch {
    /* réseau bloqué ou script indisponible */
  }
}

onMounted(() => void renderAd())
watch(() => [props.clientId, props.slotId], () => void renderAd())
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
    <div ref="containerRef" class="network-ad-slot min-h-[90px] px-2 pb-2" />
  </article>
</template>

<style scoped>
.network-ad-slot :deep(ins.adsbygoogle) {
  min-height: 90px;
}
</style>
