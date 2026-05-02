<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../api'
import { mapDjangoPinToFrontend } from '../composables/usePins'
import type { Pin } from '../types'
import StoryViewer from '../components/StoryViewer.vue'
import { useI18n } from '../i18n'
import { API_BASE_URL } from '../env'

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
  }
}

/** À partir de l'utilisateur cliqué : toutes ses stories puis celles des suivants (ordre reco conservé). */
function openAt(groupIndex: number) {
  viewerPins.value = groups.value.slice(groupIndex).flatMap((g) => g.pins)
  viewerOpen.value = true
}

onMounted(load)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">{{ t('stories.title') }}</h1>
    <p class="text-sm text-neutral-500 mt-2 max-w-xl">{{ t('stories.subtitle') }}</p>

    <!-- Skeleton -->
    <div v-if="loading" class="mt-10 animate-pulse space-y-8">
      <div class="flex gap-4 overflow-x-auto pb-4 scrollbar-none">
        <div
          v-for="i in 14"
          :key="'sk-ring-' + i"
          class="snap-start shrink-0 flex flex-col items-center gap-2 w-[84px]"
        >
          <div class="w-20 h-20 rounded-full bg-gradient-to-tr from-neutral-200 via-neutral-100 to-neutral-200 p-[3px]">
            <div class="w-full h-full rounded-full bg-neutral-100" />
          </div>
        </div>
      </div>
      <div class="hidden sm:flex gap-3 justify-center">
        <div class="h-10 w-40 rounded-full bg-neutral-100" />
        <div class="h-10 w-40 rounded-full bg-neutral-100" />
      </div>
    </div>

    <div v-else-if="groups.length === 0" class="py-20 text-center text-neutral-500 text-sm">
      {{ t('stories.empty') }}
    </div>

    <div v-else class="mt-10 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
      <button
        v-for="(g, i) in groups"
        :key="g.username || `g-${i}`"
        type="button"
        class="snap-start shrink-0 flex flex-col items-center gap-2 w-[84px]"
        @click="openAt(i)"
      >
        <div class="w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-pink-500 via-amber-400 to-violet-500">
          <div class="w-full h-full rounded-full overflow-hidden bg-white p-[2px]">
            <img
              :src="g.cover_image_url || g.pins[g.pins.length - 1]?.imageUrl || ''"
              :alt="g.display_name"
              class="w-full h-full rounded-full object-cover bg-neutral-100 pointer-events-none select-none"
              draggable="false"
              @contextmenu.prevent
            />
          </div>
        </div>
      </button>
    </div>

    <StoryViewer v-if="viewerPins.length > 0" v-model="viewerOpen" :pins="viewerPins" :initial-index="0" />
  </div>
</template>
