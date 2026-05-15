<script setup lang="ts">
/**
 * PerfOverlay — overlay flottant dev.
 *
 * Affiche en temps réel :
 *  - FPS (instantané + moyenne 60 frames)
 *  - heap JS (Chrome only)
 *  - long tasks / layout shifts dernière seconde
 *  - gesture latency moyenne
 *  - budgets DOM (overlays / images / vidéos / observers)
 *  - budgets motion + tier device
 *
 * Activable via :
 *   1. import.meta.env.DEV → auto si <PerfOverlay /> monté dans App.vue
 *   2. localStorage.setItem('pinova_perf', '1') + reload → visible en prod
 *
 * Position : bottom-right, draggable optionnel (kiss simple : on n'expose pas).
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import { getPerfStore, enablePerfMonitor, disablePerfMonitor } from '../../core/perfMonitor'
import { snapshotBudget } from '../../core/domBudget'
import { snapshotMotion, motionDeviceTier, motionSaver } from '../../core/motionBudget'
import { getMemoryPressure } from '../../core/memoryManager'

const perf = getPerfStore()

const showInProd = ref(false)
const collapsed = ref(false)
const budget = ref(snapshotBudget())
const motion = ref(snapshotMotion())
const memPressure = ref(getMemoryPressure())

let timer: ReturnType<typeof setInterval> | null = null

const enabled = computed(() => import.meta.env.DEV || showInProd.value)

onMounted(() => {
  if (typeof localStorage !== 'undefined') {
    showInProd.value = localStorage.getItem('pinova_perf') === '1'
  }
  if (enabled.value) {
    enablePerfMonitor()
    timer = setInterval(() => {
      budget.value = snapshotBudget()
      motion.value = snapshotMotion()
      memPressure.value = getMemoryPressure()
    }, 800)
  }
})

onBeforeUnmount(() => {
  if (timer) clearInterval(timer)
  if (showInProd.value) {
    /* En prod opt-in : on garde le monitor allumé tant que l'utilisateur n'a pas désactivé. */
  } else if (import.meta.env.DEV) {
    /* Dev : on laisse aussi. */
  } else {
    disablePerfMonitor()
  }
})

function fpsColor(v: number): string {
  if (v >= 55) return '#22c55e'
  if (v >= 45) return '#eab308'
  if (v >= 30) return '#f97316'
  return '#ef4444'
}

function pressureColor(p: string): string {
  switch (p) {
    case 'critical': return '#ef4444'
    case 'frozen':   return '#a855f7'
    case 'idle':     return '#6b7280'
    default:         return '#22c55e'
  }
}
</script>

<template>
  <div v-if="enabled" class="pinova-perf-overlay" :class="{ 'pinova-perf-overlay--collapsed': collapsed }">
    <button
      type="button"
      class="pinova-perf-overlay__toggle"
      :aria-label="collapsed ? 'Ouvrir le moniteur performance' : 'Réduire le moniteur performance'"
      @click="collapsed = !collapsed"
    >
      <span class="pinova-perf-overlay__fps-pill" :style="{ background: fpsColor(perf.fps.value) }">
        {{ perf.fps.value }}
      </span>
      <span v-if="!collapsed" class="pinova-perf-overlay__hint">perf</span>
    </button>

    <div v-if="!collapsed" class="pinova-perf-overlay__panel">
      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">FPS</span>
        <span :style="{ color: fpsColor(perf.fps.value) }">{{ perf.fps.value }} / avg {{ perf.fpsAvg.value }}</span>
      </div>
      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">heap</span>
        <span>
          {{ perf.heapUsedMB.value == null ? '–' : `${perf.heapUsedMB.value} / ${perf.heapLimitMB.value}MB` }}
        </span>
      </div>
      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">long tasks /s</span>
        <span>{{ perf.longTasksLastSec.value }}</span>
      </div>
      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">CLS /s</span>
        <span>{{ perf.layoutShiftsLastSec.value }}</span>
      </div>
      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">gesture lat</span>
        <span>{{ perf.gestureLatencyMs.value.toFixed(1) }}ms</span>
      </div>

      <div class="pinova-perf-overlay__sep" />

      <div
        v-for="(b, k) in budget"
        :key="k"
        class="pinova-perf-overlay__row"
      >
        <span class="pinova-perf-overlay__label">{{ k }}</span>
        <span :class="`pinova-perf-overlay__chip pinova-perf-overlay__chip--${b.status}`">{{ b.value }}</span>
      </div>

      <div class="pinova-perf-overlay__sep" />

      <div
        v-for="(m, k) in motion"
        :key="`m-${k}`"
        class="pinova-perf-overlay__row"
      >
        <span class="pinova-perf-overlay__label">motion {{ k }}</span>
        <span>{{ m.active }} / {{ m.soft }}-{{ m.hard }}</span>
      </div>
      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">device tier</span>
        <span>{{ motionDeviceTier }} {{ motionSaver ? '⏸' : '▶' }}</span>
      </div>

      <div class="pinova-perf-overlay__sep" />

      <div class="pinova-perf-overlay__row">
        <span class="pinova-perf-overlay__label">memory pressure</span>
        <span :style="{ color: pressureColor(memPressure) }">{{ memPressure }}</span>
      </div>
    </div>
  </div>
</template>

<style scoped>
.pinova-perf-overlay {
  position: fixed;
  bottom: max(env(safe-area-inset-bottom, 0px), 12px);
  right: max(env(safe-area-inset-right, 0px), 12px);
  z-index: 99999;
  font: 600 11px/1.2 'SF Mono', ui-monospace, monospace;
  color: #f4f4f5;
  background: rgba(15, 15, 18, 0.86);
  backdrop-filter: blur(10px);
  -webkit-backdrop-filter: blur(10px);
  border-radius: 12px;
  padding: 6px;
  pointer-events: auto;
  box-shadow: 0 12px 32px -16px rgba(0, 0, 0, 0.5);
  /* Contain : on évite que cet overlay déclenche des relayouts globaux. */
  contain: layout style;
}

.pinova-perf-overlay__toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 4px 8px;
  border: 0;
  background: transparent;
  color: inherit;
  cursor: pointer;
  width: 100%;
}

.pinova-perf-overlay__fps-pill {
  display: inline-flex;
  min-width: 30px;
  align-items: center;
  justify-content: center;
  padding: 2px 6px;
  border-radius: 999px;
  color: #050505;
  font-weight: 800;
  font-size: 11px;
}

.pinova-perf-overlay__hint {
  font-size: 10px;
  opacity: 0.6;
  letter-spacing: 0.04em;
  text-transform: uppercase;
}

.pinova-perf-overlay__panel {
  margin-top: 6px;
  padding: 6px 8px;
  display: grid;
  gap: 3px;
  min-width: 200px;
}

.pinova-perf-overlay__row {
  display: flex;
  justify-content: space-between;
  gap: 8px;
}

.pinova-perf-overlay__label {
  opacity: 0.6;
  letter-spacing: 0.02em;
}

.pinova-perf-overlay__chip {
  font-size: 10px;
  padding: 1px 6px;
  border-radius: 6px;
  background: rgba(255, 255, 255, 0.08);
}
.pinova-perf-overlay__chip--soft { background: rgba(245, 158, 11, 0.28); color: #fbbf24; }
.pinova-perf-overlay__chip--hard { background: rgba(239, 68, 68, 0.32); color: #fca5a5; }

.pinova-perf-overlay__sep {
  height: 1px;
  background: rgba(255, 255, 255, 0.08);
  margin: 4px 0;
}

.pinova-perf-overlay--collapsed .pinova-perf-overlay__panel {
  display: none;
}

@media (prefers-reduced-motion: reduce) {
  .pinova-perf-overlay { backdrop-filter: none; -webkit-backdrop-filter: none; }
}
</style>
