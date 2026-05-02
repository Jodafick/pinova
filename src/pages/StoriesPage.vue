<script setup lang="ts">
import { ref, onMounted } from 'vue'
import api from '../api'
import { mapDjangoPinToFrontend } from '../composables/usePins'
import type { Pin } from '../types'
import StoryViewer from '../components/StoryViewer.vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

const pins = ref<Pin[]>([])
const loading = ref(true)
const viewerOpen = ref(false)
const initialIndex = ref(0)

async function load() {
  loading.value = true
  try {
    const res = await api.get('pins/active-stories/')
    pins.value = (res.data.pins || []).map(mapDjangoPinToFrontend)
  } catch {
    pins.value = []
  } finally {
    loading.value = false
  }
}

function openAt(i: number) {
  initialIndex.value = i
  viewerOpen.value = true
}

onMounted(load)
</script>

<template>
  <div class="max-w-6xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900">{{ t('stories.title') }}</h1>
    <p class="text-sm text-neutral-500 mt-2 max-w-xl">{{ t('stories.subtitle') }}</p>

    <div v-if="loading" class="flex justify-center py-24">
      <div class="w-10 h-10 border-4 border-neutral-100 border-t-pink-600 rounded-full animate-spin"></div>
    </div>

    <div v-else-if="pins.length === 0" class="py-20 text-center text-neutral-500 text-sm">
      {{ t('stories.empty') }}
    </div>

    <div v-else class="mt-10 flex gap-4 overflow-x-auto pb-4 snap-x snap-mandatory">
      <button
        v-for="(p, i) in pins"
        :key="p.slug"
        type="button"
        class="snap-start shrink-0 flex flex-col items-center gap-2 w-[84px]"
        @click="openAt(i)"
      >
        <div class="w-20 h-20 rounded-full p-[3px] bg-gradient-to-tr from-pink-500 via-amber-400 to-violet-500">
          <div class="w-full h-full rounded-full overflow-hidden bg-white p-[2px]">
            <img
              :src="p.imageUrl"
              :alt="p.title"
              class="w-full h-full rounded-full object-cover bg-neutral-100 pointer-events-none select-none"
              draggable="false"
              @contextmenu.prevent
            />
          </div>
        </div>
      </button>
    </div>

    <StoryViewer v-if="pins.length > 0" v-model="viewerOpen" :pins="pins" :initial-index="initialIndex" />
  </div>
</template>
