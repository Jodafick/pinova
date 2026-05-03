<script setup lang="ts">
import { ref, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import api from '../api'
import { mapDjangoPinToFrontend } from '../composables/usePins'
import type { Pin } from '../types'
import StoryViewer from './StoryViewer.vue'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../env'
import StoryRingCover from './StoryRingCover.vue'
const { t } = useI18n()
const route = useRoute()
const router = useRouter()

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
const viewerInitialIndex = ref(0)
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

/** Vignette anneau : dernier pin de la story (chronologie) préféré ; image puis vidéo. */
function ringCoverUrl(g: StoryRingGroupUi) {
  const fromApi = g.cover_image_url?.trim()
  if (fromApi) return fromApi
  for (let i = g.pins.length - 1; i >= 0; i--) {
    const p = g.pins[i]
    if (p?.imageUrl?.trim()) return p.imageUrl
    const vurl = (p?.storyVideoUrl || '').trim()
    if (vurl) return vurl
  }
  return ''
}

function normalizeQueryStory(raw: unknown): string {
  const s = Array.isArray(raw) ? raw[0] : raw
  return String(s ?? '').trim()
}

/** Ouvre le viewer plein écran pour un slug après notification ou push (`/?story=slug`). */
function openStoryFromSlugIfPossible() {
  if (route.path !== '/' && route.path !== '') return
  const slug = normalizeQueryStory(route.query.story)
  if (!slug || loading.value) return

  const grps = groups.value
  let pinIdx = -1
  let found: StoryRingGroupUi | null = null
  for (const g of grps) {
    const i = g.pins.findIndex((p) => p.slug === slug)
    if (i !== -1) {
      pinIdx = i
      found = g
      break
    }
  }

  const nextQuery = { ...route.query } as Record<string, string | string[] | undefined | null>
  delete nextQuery.story

  if (found != null && pinIdx >= 0) {
    viewerPins.value = [...found.pins]
    viewerInitialIndex.value = pinIdx
    viewerOpen.value = true
    void router.replace({ path: '/', query: nextQuery })
    return
  }

  /* Story absente du bandeau (expirée, filtre) : page détail si le pin existe encore. */
  const cq = route.query.commentId
  const commentQ: Record<string, string> = {}
  if (cq) {
    const c = Array.isArray(cq) ? cq[0] : cq
    if (typeof c === 'string' && c.trim()) commentQ.commentId = c.trim()
  }
  void router.replace({
    path: `/pin/${encodeURIComponent(slug)}`,
    query: commentQ.commentId ? { commentId: commentQ.commentId } : {},
  })
}

function openAt(groupIndex: number) {
  const g = groups.value[groupIndex]
  if (!g?.pins?.length) return
  /* Une barre par auteur uniquement ; ne pas concaténer les autres comptes. */
  viewerPins.value = [...g.pins]
  viewerInitialIndex.value = 0
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

watch(
  () =>
    ({
      slug: normalizeQueryStory(route.query.story),
      busy: loading.value,
      grpLen: groups.value.length,
      path: route.path,
    }) as const,
  () => {
    openStoryFromSlugIfPossible()
  },
)

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
              <StoryRingCover
                :cover-url="ringCoverUrl(g)"
                :display-name="g.display_name"
                :username="g.username"
                :avatar-url="g.avatar_url"
                :avatar-color="g.avatar_color"
              />
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

  <StoryViewer
    v-if="viewerPins.length > 0"
    v-model="viewerOpen"
    :pins="viewerPins"
    :initial-index="viewerInitialIndex"
  />
</template>
