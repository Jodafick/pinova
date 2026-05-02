<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import api from '../api'
import { mapDjangoPinToFrontend } from '../composables/usePins'
import type { Pin } from '../types'
import StoryViewer from './StoryViewer.vue'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../env'
import { displayInitials } from '../utils/displayInitials'

const { t } = useI18n()

function mediaUrl(url: string | undefined | null) {
  if (!url) return ''
  if (url.startsWith('http')) return url
  return `${API_BASE_URL}${url.startsWith('/') ? '' : '/'}${url}`
}

type StoryRingGroupUi = {
  username: string
  display_name: string
  avatar_url: string
  avatar_color: string
  cover_image_url: string
  pins: Pin[]
}

const groups = ref<StoryRingGroupUi[]>([])
const loading = ref(true)
const viewerOpen = ref(false)
const viewerPins = ref<Pin[]>([])
const scrollEl = ref<HTMLElement | null>(null)
const showArrows = ref(false)
const canScrollLeft = ref(false)
const canScrollRight = ref(false)

const SCROLL_STEP = 280

async function load() {
  loading.value = true
  try {
    const res = await api.get('pins/active-stories/')
    const rawGroups = res.data.groups
    if (Array.isArray(rawGroups) && rawGroups.length > 0) {
      groups.value = rawGroups.map((g: Record<string, unknown>) => ({
        username: String(g.username ?? ''),
        display_name: String(g.display_name ?? g.username ?? ''),
        avatar_url: mediaUrl(g.avatar_url as string),
        avatar_color: String(g.avatar_color ?? 'bg-neutral-400'),
        cover_image_url: mediaUrl(g.cover_image_url as string),
        pins: ((g.pins as unknown[]) || []).map(mapDjangoPinToFrontend),
      }))
    } else {
      const flat = ((res.data.pins || []) as unknown[]).map(mapDjangoPinToFrontend)
      groups.value =
        flat.length > 0
          ? [
              {
                username: flat[0]?.username ?? '',
                display_name: flat[0]?.user ?? '',
                avatar_url: flat[0]?.userAvatarUrl ?? '',
                avatar_color: flat[0]?.userAvatarColor ?? 'bg-neutral-400',
                cover_image_url: flat[0]?.imageUrl ?? '',
                pins: flat,
              },
            ]
          : []
    }
  } catch {
    groups.value = []
  } finally {
    loading.value = false
    await nextTick()
    syncScrollMetrics()
  }
}

function ringCover(g: StoryRingGroupUi) {
  const url = g.cover_image_url?.trim()
  if (url) return url
  for (let i = g.pins.length - 1; i >= 0; i--) {
    const p = g.pins[i]
    if (p?.imageUrl) return p.imageUrl
  }
  return g.avatar_url || ''
}

function coverIsVideo(url: string) {
  if (!url) return false
  return /\.(mp4|webm|mov)(\?|$)/i.test(url)
}

function openAt(groupIndex: number) {
  viewerPins.value = groups.value.slice(groupIndex).flatMap((g) => g.pins)
  viewerOpen.value = true
}

function scrollStrip(delta: number) {
  scrollEl.value?.scrollBy({ left: delta, behavior: 'smooth' })
}

function scrollPrev() {
  scrollStrip(-SCROLL_STEP)
}

function scrollNext() {
  scrollStrip(SCROLL_STEP)
}

function syncScrollMetrics() {
  const el = scrollEl.value
  if (!el) {
    showArrows.value = false
    return
  }
  const overflow = el.scrollWidth > el.clientWidth + 4
  showArrows.value = overflow
  canScrollLeft.value = el.scrollLeft > 6
  canScrollRight.value = el.scrollLeft + el.clientWidth < el.scrollWidth - 6
}

let ro: ResizeObserver | null = null

watch(scrollEl, (el) => {
  ro?.disconnect()
  if (el && ro) ro.observe(el)
  nextTick(syncScrollMetrics)
}, { flush: 'post' })

onMounted(() => {
  ro = typeof ResizeObserver !== 'undefined' ? new ResizeObserver(() => syncScrollMetrics()) : null
  if (scrollEl.value && ro) ro.observe(scrollEl.value)
  void load()
  window.addEventListener('resize', syncScrollMetrics)
})

watch(groups, () => nextTick(syncScrollMetrics))

onUnmounted(() => {
  window.removeEventListener('resize', syncScrollMetrics)
  ro?.disconnect()
  ro = null
})
</script>

<template>
  <section v-if="!loading && groups.length > 0" class="mb-6 sm:mb-8">
    <div class="flex items-center justify-between gap-2 mb-3 px-0.5">
      <h2 class="text-sm font-semibold text-neutral-800">{{ t('home.stories.title') }}</h2>
    </div>

    <div class="relative flex items-center gap-1 sm:gap-2">
      <button
        v-if="showArrows"
        type="button"
        class="hidden sm:flex shrink-0 w-10 h-10 rounded-full border border-neutral-200 bg-white shadow-sm items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:pointer-events-none transition"
        :disabled="!canScrollLeft"
        :aria-label="t('home.stories.prev')"
        @click="scrollPrev"
      >
        <span class="material-symbols-outlined text-2xl">chevron_left</span>
      </button>

      <div
        ref="scrollEl"
        class="flex-1 min-w-0 flex gap-4 overflow-x-auto overflow-y-hidden pb-2 pt-1 scroll-smooth snap-x snap-mandatory overscroll-x-contain touch-pan-x [scrollbar-width:none] [-ms-overflow-style:none] [&::-webkit-scrollbar]:hidden"
        @scroll.passive="syncScrollMetrics"
      >
        <button
          v-for="(g, i) in groups"
          :key="g.username || `g-${i}`"
          type="button"
          class="snap-start shrink-0 flex flex-col items-center gap-2 w-[84px] focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-500 rounded-xl py-1"
          @click="openAt(i)"
        >
          <div class="w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-pink-500 via-amber-400 to-violet-500">
            <div class="w-full h-full rounded-full overflow-hidden bg-white p-[2px]">
              <img
                v-if="ringCover(g) && !coverIsVideo(ringCover(g))"
                :src="ringCover(g)"
                :alt="g.display_name"
                class="w-full h-full rounded-full object-cover bg-neutral-100 pointer-events-none select-none"
                draggable="false"
                @contextmenu.prevent
              />
              <div
                v-else
                class="w-full h-full rounded-full flex items-center justify-center text-[11px] font-bold text-white leading-none px-1 text-center"
                :class="g.avatar_color || 'bg-neutral-400'"
              >
                {{ displayInitials(g.display_name || g.username) }}
              </div>
            </div>
          </div>
          <span class="text-[11px] font-medium text-neutral-600 truncate max-w-[84px] text-center leading-tight px-0.5">
            {{ g.display_name || g.username }}
          </span>
        </button>
      </div>

      <button
        v-if="showArrows"
        type="button"
        class="hidden sm:flex shrink-0 w-10 h-10 rounded-full border border-neutral-200 bg-white shadow-sm items-center justify-center text-neutral-700 hover:bg-neutral-50 disabled:opacity-30 disabled:pointer-events-none transition"
        :disabled="!canScrollRight"
        :aria-label="t('home.stories.next')"
        @click="scrollNext"
      >
        <span class="material-symbols-outlined text-2xl">chevron_right</span>
      </button>
    </div>

    <StoryViewer v-if="viewerPins.length > 0" v-model="viewerOpen" :pins="viewerPins" :initial-index="0" />
  </section>

  <!-- Chargement léger : même hauteur que la rangée pour éviter un saut -->
  <div v-else-if="loading" class="mb-6 sm:mb-8 animate-pulse">
    <div class="h-4 w-24 bg-neutral-200 rounded mb-3" />
    <div class="flex gap-4 overflow-hidden pb-2">
      <div v-for="i in 10" :key="'sk-' + i" class="shrink-0 flex flex-col items-center gap-2 w-[84px]">
        <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-neutral-200 via-neutral-100 to-neutral-200 p-[3px]">
          <div class="w-full h-full rounded-full bg-neutral-100" />
        </div>
      </div>
    </div>
  </div>
</template>
