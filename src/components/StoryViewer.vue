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
const { isAuthenticated, currentUser } = useAuth()
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

/** L'auteur de la story voit le compteur de likes ; les autres non. */
const showLikeCountForStory = computed(() => {
  const pin = current.value
  const u = currentUser.value
  if (!pin || !u) return false
  return pin.username === u.username
})

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
      class="fixed inset-0 z-[100] bg-neutral-950 flex flex-col"
      role="dialog"
      aria-modal="true"
    >
      <!-- Progress -->
      <div class="flex gap-1 px-2 pt-safe pt-3 shrink-0 z-50">
        <div
          v-for="(_, si) in pins"
          :key="si"
          class="h-0.5 flex-1 rounded-full bg-white/15 overflow-hidden"
        >
          <div
            class="h-full bg-white transition-[width] duration-100 ease-linear"
            :style="{ width: si < index ? '100%' : si === index ? '72%' : '0%' }"
          />
        </div>
      </div>

      <div class="absolute top-safe right-3 z-50 flex flex-col items-end gap-2 pt-safe">
        <button
          type="button"
          class="w-11 h-11 rounded-full bg-black/40 backdrop-blur-md flex items-center justify-center text-white hover:bg-black/55 border border-white/10"
          @click="close"
        >
          <span class="material-symbols-outlined text-[22px]">close</span>
        </button>
      </div>

      <!-- Zones tap -->
      <div class="relative flex-1 min-h-0 flex items-stretch justify-center">
        <button
          type="button"
          class="absolute inset-y-0 left-0 w-[28%] z-30 cursor-w-resize opacity-0"
          aria-label="Précédent"
          @click.stop="goPrev"
        />
        <button
          type="button"
          class="absolute inset-y-0 right-0 w-[28%] z-30 cursor-e-resize opacity-0"
          aria-label="Suivant"
          @click.stop="goNext"
        />

        <div
          class="absolute inset-y-0 left-[28%] right-[28%] z-25 flex items-center justify-center"
          @click.stop="onCenterTap"
          @dblclick.stop.prevent="doLike"
        />

        <div class="relative flex-1 flex items-center justify-center px-3 pb-16 pt-14 sm:px-8">
          <div
            v-if="current"
            class="relative max-w-[min(100%,520px)] w-full rounded-2xl overflow-hidden shadow-[0_24px_80px_rgba(0,0,0,0.55)] ring-1 ring-white/10"
          >
            <img
              :src="current.imageUrl"
              :alt="current.title"
              class="w-full max-h-[min(78vh,820px)] object-contain bg-black select-none pointer-events-none block"
              draggable="false"
              @contextmenu.prevent
              @dragstart.prevent
            />

            <button
              type="button"
              class="absolute top-3 right-3 z-40 flex items-center gap-1 rounded-full bg-black/45 backdrop-blur-md px-3 py-2 text-white border border-white/15 hover:bg-black/55 transition"
              @click.stop="doLike"
            >
              <span
                class="material-symbols-outlined text-[26px]"
                :class="current?.liked ? 'fill-1 text-pink-400' : ''"
              >favorite</span>
              <span
                v-if="showLikeCountForStory"
                class="text-xs font-semibold tabular-nums min-w-[1.25rem]"
              >{{ current?.stats.reactions ?? 0 }}</span>
            </button>

            <transition name="fade">
              <div
                v-if="heartBurst"
                class="pointer-events-none absolute inset-0 flex items-center justify-center"
              >
                <span class="material-symbols-outlined text-white text-[100px] drop-shadow-2xl animate-pulse fill-1">
                  favorite
                </span>
              </div>
            </transition>
          </div>
        </div>
      </div>

      <div class="pointer-events-none absolute bottom-0 inset-x-0 h-28 bg-gradient-to-t from-black/70 to-transparent z-20" />

      <div class="absolute bottom-6 inset-x-0 z-40 flex justify-center px-4 pointer-events-none">
        <button
          type="button"
          class="pointer-events-auto px-5 py-2.5 rounded-full bg-white/15 backdrop-blur-md border border-white/20 text-white text-xs font-semibold hover:bg-white/25 transition"
          @click="openPinPage"
        >
          {{ t('story.viewPin') }}
        </button>
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
.top-safe {
  top: env(safe-area-inset-top, 0px);
}
</style>
