<script setup lang="ts">
import { computed, onUnmounted, ref } from 'vue'
import type { SponsoredAd } from '../types'
import { useI18n } from '../i18n'
import SponsoredDetailView from './SponsoredDetailView.vue'

const props = defineProps<{
  item: SponsoredAd
  hasPrevious: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  (e: 'back'): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

const { t } = useI18n()
const surfaceDragX = ref(0)
const surfaceDragY = ref(0)
const surfacePointerActive = ref(false)
const gestureStart = ref<{ x: number; y: number } | null>(null)
const gestureIntent = ref<'none' | 'vertical' | 'horizontal'>('none')
const isExitClosing = ref(false)
let exitTimer: ReturnType<typeof setTimeout> | null = null

const surfaceStyle = computed(() => {
  if (isExitClosing.value) return undefined
  if (surfaceDragY.value > 0) {
    const y = surfaceDragY.value
    const scale = Math.max(0.92, 1 - y / 1600)
    return { transform: `translate3d(0, ${y}px, 0) scale(${scale})` }
  }
  return undefined
})

const trackStyle = computed(() => ({
  transform: `translate3d(calc(-100vw + ${surfaceDragX.value}px), 0, 0)`,
  transition: gestureIntent.value === 'horizontal' ? 'none' : 'transform 0.24s cubic-bezier(0.22, 1, 0.36, 1)',
}))

function startDismiss() {
  if (isExitClosing.value) return
  isExitClosing.value = true
  exitTimer = setTimeout(() => emit('back'), 320)
}

function onPointerDown(e: PointerEvent) {
  if (isExitClosing.value) return
  surfacePointerActive.value = true
  gestureStart.value = { x: e.clientX, y: e.clientY }
  gestureIntent.value = 'none'
  surfaceDragX.value = 0
  surfaceDragY.value = 0
  ;(e.currentTarget as HTMLElement)?.setPointerCapture?.(e.pointerId)
}

function onPointerMove(e: PointerEvent) {
  const start = gestureStart.value
  if (!start) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  const absX = Math.abs(dx)
  const absY = Math.abs(dy)
  if (gestureIntent.value === 'none') {
    if (absY > 10 && absY > absX * 1.15) gestureIntent.value = 'vertical'
    else if (absX > 10 && absX > absY * 1.15) gestureIntent.value = 'horizontal'
    else return
  }
  if (gestureIntent.value === 'vertical') {
    surfaceDragY.value = Math.max(0, dy)
    surfaceDragX.value = 0
  } else {
    const canGo = dx < 0 ? props.hasNext : props.hasPrevious
    surfaceDragX.value = canGo ? dx : dx * 0.18
    surfaceDragY.value = 0
  }
}

function onPointerUp(e: PointerEvent) {
  const start = gestureStart.value
  gestureStart.value = null
  surfacePointerActive.value = false
  if (!start) return
  const dx = e.clientX - start.x
  const dy = e.clientY - start.y
  const vw = window.innerWidth || 1

  if (gestureIntent.value === 'vertical' && dy > 110) {
    startDismiss()
    return
  }
  if (gestureIntent.value === 'horizontal') {
    if (dx < -vw * 0.22 && props.hasNext) {
      emit('next')
    } else if (dx > vw * 0.22 && props.hasPrevious) {
      emit('prev')
    }
  }
  gestureIntent.value = 'none'
  surfaceDragX.value = 0
  surfaceDragY.value = 0
}

onUnmounted(() => {
  if (exitTimer) clearTimeout(exitTimer)
})
</script>

<template>
  <section class="sponsored-mobile fixed inset-0 z-[95] bg-black text-white lg:hidden">
    <div class="absolute inset-0 bg-black/80" aria-hidden="true" />
    <div class="pin-mobile-surface relative z-[1] h-full w-full overflow-hidden" :style="surfaceStyle">
      <div
        class="flex h-full w-[300vw] touch-pan-y"
        :style="trackStyle"
        @pointerdown="onPointerDown"
        @pointermove="onPointerMove"
        @pointerup="onPointerUp"
        @pointercancel="onPointerUp"
      >
        <div class="h-full w-screen shrink-0 opacity-40" aria-hidden="true" />
        <div class="h-full w-screen shrink-0">
          <SponsoredDetailView :item="item" tone="dark" layout="mobile" />
        </div>
        <div class="h-full w-screen shrink-0 opacity-40" aria-hidden="true" />
      </div>

      <button
        type="button"
        class="absolute left-4 top-[max(0.75rem,env(safe-area-inset-top))] z-20 grid h-10 w-10 place-items-center rounded-full bg-black/50 text-white backdrop-blur-md"
        :aria-label="t('common.close')"
        @click="startDismiss"
      >
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
    </div>
  </section>
</template>
