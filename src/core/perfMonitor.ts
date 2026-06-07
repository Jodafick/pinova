/**
 * Performance Monitor — outils de profiling embarqués (dev / opt-in prod).
 *
 * - FPS ring buffer (60 derniers échantillons)
 * - JS heap (si supporté)
 * - Render timings (PerformanceObserver: long tasks, layout shifts)
 * - Gesture latency (mesure inter-event)
 *
 * S'active via `initPerfMonitor()`. En prod, ne fait rien sauf si on appelle
 * explicitement `enablePerfMonitor()` (debug overlay).
 *
 * Donne accès à un store réactif lisible depuis un composant DevOverlay.
 */

import { ref, computed, type ComputedRef, type Ref } from 'vue'

interface PerfStore {
  fps: Ref<number>
  fpsAvg: ComputedRef<number>
  longTasksLastSec: Ref<number>
  layoutShiftsLastSec: Ref<number>
  heapUsedMB: Ref<number | null>
  heapLimitMB: Ref<number | null>
  gestureLatencyMs: Ref<number>
}

const fpsSamples: number[] = []
const FPS_WINDOW = 60

const store: PerfStore = {
  fps: ref(0),
  fpsAvg: computed(() =>
    fpsSamples.length === 0 ? 0 : Math.round(fpsSamples.reduce((a, b) => a + b, 0) / fpsSamples.length),
  ),
  longTasksLastSec: ref(0),
  layoutShiftsLastSec: ref(0),
  heapUsedMB: ref<number | null>(null),
  heapLimitMB: ref<number | null>(null),
  gestureLatencyMs: ref(0),
}

let rafId = 0
let lastTs = 0
let frames = 0
let running = false

/* PerformanceObservers — un seul par metric, déconnectables. */
let longTaskObs: PerformanceObserver | null = null
let layoutShiftObs: PerformanceObserver | null = null
let longTasks: number[] = []
let layoutShifts: number[] = []

type LongTaskReporter = (durationMs: number, name?: string) => void
let longTaskReporter: LongTaskReporter | null = null

/** Branché par Sentry (long tasks >50ms → breadcrumb). */
export function registerLongTaskReporter(reporter: LongTaskReporter | null): void {
  longTaskReporter = reporter
}

interface PerformanceMemory { usedJSHeapSize: number; jsHeapSizeLimit: number }
function readHeap(): PerformanceMemory | null {
  if (typeof performance === 'undefined') return null
  return (performance as Performance & { memory?: PerformanceMemory }).memory ?? null
}

function startFpsLoop() {
  if (running) return
  running = true
  function tick(ts: number) {
    if (lastTs) {
      const dt = ts - lastTs
      const fps = 1000 / Math.max(1, dt)
      store.fps.value = Math.round(fps)
      fpsSamples.push(fps)
      if (fpsSamples.length > FPS_WINDOW) fpsSamples.shift()
    }
    lastTs = ts
    frames += 1
    rafId = requestAnimationFrame(tick)
  }
  rafId = requestAnimationFrame(tick)
}

function stopFpsLoop() {
  running = false
  if (rafId) cancelAnimationFrame(rafId)
  rafId = 0
  lastTs = 0
  frames = 0
  fpsSamples.length = 0
}

function pruneLastSec(arr: number[]): number {
  const now = performance.now()
  while (arr.length && now - arr[0] > 1000) arr.shift()
  return arr.length
}

function startObservers() {
  if (typeof PerformanceObserver === 'undefined') return
  try {
    longTaskObs = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        longTasks.push(entry.startTime + entry.duration)
        const durationMs = entry.duration
        if (durationMs > 50 && longTaskReporter) {
          longTaskReporter(durationMs, entry.name || undefined)
        }
      }
      store.longTasksLastSec.value = pruneLastSec(longTasks)
    })
    longTaskObs.observe({ entryTypes: ['longtask'] })
  } catch {
    /* Safari n'expose longtask que partiellement. */
  }
  try {
    layoutShiftObs = new PerformanceObserver((list) => {
      const now = performance.now()
      for (const entry of list.getEntries()) {
        const hadRecent = !(entry as PerformanceEntry & { hadRecentInput?: boolean }).hadRecentInput
        if (hadRecent) layoutShifts.push(now)
      }
      store.layoutShiftsLastSec.value = pruneLastSec(layoutShifts)
    })
    layoutShiftObs.observe({ type: 'layout-shift', buffered: true })
  } catch {
    /* ignore */
  }
}

function stopObservers() {
  longTaskObs?.disconnect()
  layoutShiftObs?.disconnect()
  longTaskObs = null
  layoutShiftObs = null
  longTasks = []
  layoutShifts = []
}

let heapTimer: ReturnType<typeof setInterval> | null = null
function startHeapTimer() {
  if (heapTimer) return
  heapTimer = setInterval(() => {
    const m = readHeap()
    if (!m) {
      store.heapUsedMB.value = null
      store.heapLimitMB.value = null
      return
    }
    store.heapUsedMB.value = +(m.usedJSHeapSize / 1024 / 1024).toFixed(1)
    store.heapLimitMB.value = +(m.jsHeapSizeLimit / 1024 / 1024).toFixed(0)
  }, 1500)
}
function stopHeapTimer() {
  if (heapTimer) clearInterval(heapTimer)
  heapTimer = null
}

/* ────────── Gesture latency ────────── */

let lastPointerTs = 0
function onPointerEvent() {
  const now = performance.now()
  if (lastPointerTs) {
    const dt = now - lastPointerTs
    /* On reporte la latence inter-events (cap 100ms pour pas tronquer la moyenne). */
    if (dt > 0 && dt < 100) {
      store.gestureLatencyMs.value = +(store.gestureLatencyMs.value * 0.7 + dt * 0.3).toFixed(1)
    }
  }
  lastPointerTs = now
}

function startGestureLatency() {
  if (typeof window === 'undefined') return
  window.addEventListener('pointermove', onPointerEvent, { passive: true, capture: true })
}
function stopGestureLatency() {
  if (typeof window === 'undefined') return
  window.removeEventListener('pointermove', onPointerEvent, { capture: true } as EventListenerOptions)
}

/* ────────── Public ────────── */

let initialized = false

export function initPerfMonitor(): void {
  if (initialized) return
  initialized = true
  /* En prod : monitoring n'est pas démarré sauf opt-in. */
  if (import.meta.env.DEV) {
    enablePerfMonitor()
  }
}

export function enablePerfMonitor(): void {
  startFpsLoop()
  startObservers()
  startHeapTimer()
  startGestureLatency()
}

export function disablePerfMonitor(): void {
  stopFpsLoop()
  stopObservers()
  stopHeapTimer()
  stopGestureLatency()
}

export function getPerfStore(): PerfStore {
  return store
}

/** Snapshot non-réactif (utile pour logger/sentry). */
export function snapshotPerf() {
  return {
    fps: store.fps.value,
    fpsAvg: store.fpsAvg.value,
    longTasksLastSec: store.longTasksLastSec.value,
    layoutShiftsLastSec: store.layoutShiftsLastSec.value,
    heapUsedMB: store.heapUsedMB.value,
    heapLimitMB: store.heapLimitMB.value,
    gestureLatencyMs: store.gestureLatencyMs.value,
  }
}
