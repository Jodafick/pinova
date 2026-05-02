<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const props = defineProps<{
  modelValue: boolean
  pins: Pin[]
  initialIndex?: number
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const router = useRouter()
const { toggleLike } = usePins()
const { isAuthenticated } = useAuth()
const { t } = useI18n()

const index = ref(0)
const heartBurst = ref(false)

let advanceTimer: ReturnType<typeof setTimeout> | null = null

function clearAdvance() {
  if (advanceTimer) {
    clearTimeout(advanceTimer)
    advanceTimer = null
  }
}

function scheduleAdvance() {
  clearAdvance()
  if (!props.modelValue || props.pins.length === 0) return
  advanceTimer = setTimeout(goNext, 8000)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open && props.pins.length > 0) {
      const maxIdx = props.pins.length - 1
      index.value = Math.min(Math.max(0, props.initialIndex ?? 0), maxIdx)
      scheduleAdvance()
    } else {
      clearAdvance()
    }
  },
)

watch(
  () => props.initialIndex,
  (v) => {
    if (!props.modelValue || props.pins.length === 0) return
    index.value = Math.min(Math.max(0, v ?? 0), props.pins.length - 1)
  },
)

watch(index, () => {
  if (props.modelValue) scheduleAdvance()
})

const current = computed(() => props.pins[index.value])

function close() {
  clearAdvance()
  emit('update:modelValue', false)
}

function goNext() {
  clearAdvance()
  if (index.value < props.pins.length - 1) {
    index.value++
    return
  }
  close()
}

function goPrev() {
  clearAdvance()
  if (index.value > 0) {
    index.value--
  }
}

async function doLike() {
  const pin = current.value
  if (!pin || !isAuthenticated.value) {
    router.push('/login')
    return
  }
  heartBurst.value = true
  window.setTimeout(() => {
    heartBurst.value = false
  }, 900)
  try {
    await toggleLike(pin.slug)
  } catch {
    heartBurst.value = false
  }
}

function openPinPage() {
  const slug = current.value?.slug
  if (!slug) return
  close()
  router.push(`/pin/${slug}`)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  if (e.key === 'Escape') close()
  else if (e.key === 'ArrowRight') goNext()
  else if (e.key === 'ArrowLeft') goPrev()
}

let lastTap = 0
function onCenterTap() {
  const pin = current.value
  if (!pin || !isAuthenticated.value) return
  const now = Date.now()
  if (now - lastTap < 340) {
    lastTap = 0
    void doLike()
    return
  }
  lastTap = now
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => {
  window.removeEventListener('keydown', onKeydown)
  clearAdvance()
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue && pins.length > 0"
      class="fixed inset-0 z-[100] bg-black flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Progress segments -->
      <div class="flex gap-1 px-2 pt-safe pt-3 shrink-0">
        <div
          v-for="(_, si) in pins"
          :key="si"
          class="h-0.5 flex-1 rounded-full bg-white/25 overflow-hidden"
        >
          <div
            class="h-full bg-white transition-all duration-300"
            :style="{ width: si < index ? '100%' : si === index ? '40%' : '0%' }"
          />
        </div>
      </div>

      <div class="absolute top-4 right-4 z-40">
        <button
          type="button"
          class="w-10 h-10 rounded-full bg-white/10 flex items-center justify-center text-white hover:bg-white/20"
          @click="close"
        >
          <span class="material-symbols-outlined">close</span>
        </button>
      </div>

      <!-- Tap zones : précédent | centre (double tap like) | suivant -->
      <div class="relative flex-1 min-h-0 flex items-center justify-center">
        <button
          type="button"
          class="absolute inset-y-0 left-0 w-1/4 z-30 opacity-0 cursor-w-resize"
          aria-label="Story précédente"
          @click.stop="goPrev"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 w-1/4 z-30 opacity-0 cursor-e-resize"
          aria-label="Story suivante"
          @click.stop="goNext"
        />

        <div
          class="absolute inset-y-0 left-1/4 right-1/4 z-25 flex items-center justify-center"
          @click.stop="onCenterTap"
          @dblclick.stop.prevent="doLike"
        />

        <div class="relative max-h-full max-w-full px-2 py-6 flex flex-col items-center justify-center">
          <img
            v-if="current"
            :src="current.imageUrl"
            :alt="current.title"
            class="max-h-[calc(100vh-140px)] max-w-full object-contain select-none pointer-events-none"
            draggable="false"
            @contextmenu.prevent
            @dragstart.prevent
          />

          <transition name="fade">
            <div
              v-if="heartBurst"
              class="pointer-events-none absolute inset-0 flex items-center justify-center"
            >
              <span class="material-symbols-outlined text-white text-[120px] drop-shadow-lg animate-pulse fill-1">
                favorite
              </span>
            </div>
          </transition>
        </div>
      </div>

      <!-- Actions : pas de commentaires (style Stories) -->
      <div class="shrink-0 px-4 pb-8 pt-2 flex flex-col items-center gap-3 bg-gradient-to-t from-black/80 to-transparent">
        <p class="text-white text-sm font-semibold text-center line-clamp-2 px-4">{{ current?.title }}</p>
        <div class="flex items-center gap-4">
          <button
            type="button"
            class="flex flex-col items-center gap-1 text-white/90 hover:text-white"
            @click="doLike"
          >
            <span
              class="material-symbols-outlined text-3xl"
              :class="current?.liked ? 'fill-1 text-pink-400' : ''"
            >favorite</span>
            <span class="text-[10px]">{{ current?.stats.reactions ?? 0 }}</span>
          </button>
          <button
            type="button"
            class="px-4 py-2 rounded-full bg-white/15 text-white text-xs font-semibold hover:bg-white/25"
            @click="openPinPage"
          >
            {{ t('story.viewPin') }}
          </button>
        </div>
        <p class="text-[10px] text-white/50 text-center">{{ t('story.doubleTapHint') }}</p>
      </div>
    </div>
  </Teleport>
</template>

<style scoped>
.fade-enter-active,
.fade-leave-active {
  transition: opacity 0.35s ease;
}
.fade-enter-from,
.fade-leave-to {
  opacity: 0;
}
.pt-safe {
  padding-top: env(safe-area-inset-top, 0px);
}
</style>
