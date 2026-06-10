<script setup lang="ts">
/** HUD perf — visible uniquement en développement. */
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { getPerfStore } from '../../core/perfMonitor'
import { getQualityMode } from '../../core/performanceEngine'
import { domNodeCount, getBootMarks } from '../../core/bootMarks'

const fps = ref(0)
const quality = ref('medium')
const nodes = ref(0)
const marks = ref<Record<string, number>>({})

let timer: ReturnType<typeof setInterval> | null = null

const isDev = import.meta.env.DEV

const label = computed(() => {
  const m = marks.value
  const mount = m.app_mounted ?? 0
  const boot = m.boot_start ?? 0
  const tti = mount && boot ? Math.round(mount - boot) : 0
  return `FPS ${fps.value} · ${quality.value} · DOM ${nodes.value} · TTI ${tti}ms`
})

onMounted(() => {
  if (!import.meta.env.DEV) return
  const store = getPerfStore()
  timer = setInterval(() => {
    fps.value = store.fpsAvg.value
    quality.value = getQualityMode()
    nodes.value = domNodeCount()
    marks.value = getBootMarks()
  }, 1000)
})
onUnmounted(() => {
  if (timer) clearInterval(timer)
})
</script>

<template>
  <div
    v-if="isDev"
    class="fixed bottom-20 left-2 z-[9999] rounded-lg bg-black/75 px-2 py-1 text-[10px] font-mono text-green-300 pointer-events-none max-w-[90vw] truncate"
    aria-hidden="true"
  >
    {{ label }}
  </div>
</template>
