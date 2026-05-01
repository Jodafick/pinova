<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'

const { formatCount, isPinSavePending } = usePins()
const { isAuthenticated } = useAuth()
const { t } = useI18n()

const props = defineProps<{
  pins: Pin[]
}>()

const emit = defineEmits<{
  (e: 'toggle-save', slug: string): void
  (e: 'open-pin', slug: string): void
  (e: 'more', slug: string): void
}>()

const columnCount = ref(2)
const loadedImages = ref<Record<number, boolean>>({})

const updateColumnCount = () => {
  const width = window.innerWidth
  if (width >= 1280) columnCount.value = 5
  else if (width >= 1024) columnCount.value = 4
  else if (width >= 640) columnCount.value = 3
  else columnCount.value = 2
}

onMounted(() => {
  updateColumnCount()
  window.addEventListener('resize', updateColumnCount)
})

onUnmounted(() => {
  window.removeEventListener('resize', updateColumnCount)
})

const columns = computed(() => {
  const cols = Array.from({ length: columnCount.value }, () => [] as Pin[])
  props.pins.forEach((pin, index) => {
    const targetCol = cols[index % columnCount.value]
    if (targetCol) {
      targetCol.push(pin)
    }
  })
  return cols
})

const markImageLoaded = (pinId: number) => {
  loadedImages.value[pinId] = true
}

const isImageLoaded = (pinId: number) => !!loadedImages.value[pinId]
const isSavePending = (slug: string) => isPinSavePending(slug)
</script>

<template>
  <div class="flex gap-3 sm:gap-4 items-start" :aria-label="t('pin.related')">
    <div
      v-for="(column, colIndex) in columns"
      :key="colIndex"
      class="flex-1 flex flex-col gap-3 sm:gap-4"
    >
      <article
        v-for="pin in column"
        :key="pin.id"
        class="group relative rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all cursor-pointer"
        @click="emit('open-pin', pin.slug)"
      >
        <!-- Image container -->
        <div class="relative overflow-hidden rounded-2xl bg-neutral-100 aspect-[3/4]">
          <div
            v-if="!isImageLoaded(pin.id)"
            class="absolute inset-0 animate-pulse bg-gradient-to-b from-neutral-200 via-neutral-100 to-neutral-200"
          ></div>
          <img
            :src="pin.imageUrl"
            :alt="pin.title"
            class="absolute inset-0 w-full h-full object-cover group-hover:scale-105 transition-all duration-500"
            :class="isImageLoaded(pin.id) ? 'opacity-100' : 'opacity-0'"
            loading="lazy"
            @load="markImageLoaded(pin.id)"
          />

          <!-- Dark overlay on hover -->
          <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>

          <!-- Save button -->
          <button
            v-if="isAuthenticated"
            class="absolute top-3 right-3 px-4 py-2 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg z-10"
            :class="pin.saved ? 'bg-neutral-900 text-white' : 'bg-pink-600 text-white hover:bg-pink-700'"
            :disabled="isSavePending(pin.slug)"
            @click.stop="emit('toggle-save', pin.slug)"
          >
            <span v-if="isSavePending(pin.slug)" class="w-4 h-4 inline-block border-2 border-current border-t-transparent rounded-full animate-spin"></span>
            <span v-else>{{ pin.saved ? t('pin.saved') : t('pin.save') }}</span>
          </button>

          <!-- Bottom actions on hover -->
          <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200 z-10">
            <!-- Link badge -->
            <a
              v-if="pin.link"
              :href="pin.link.startsWith('http') ? pin.link : 'https://' + pin.link"
              target="_blank"
              class="flex items-center gap-1 px-3 py-1.5 rounded-full bg-white/95 text-xs font-medium text-neutral-800 shadow-md hover:bg-white max-w-[60%] truncate"
              @click.stop
            >
              <span class="material-symbols-outlined text-sm">link</span>
              <span class="truncate">{{ pin.link }}</span>
            </a>
            <div v-else></div>

            <div class="flex items-center gap-1.5">
              <button
                class="w-8 h-8 rounded-full bg-white/95 flex items-center justify-center text-neutral-700 shadow-md hover:bg-white transition"
                @click.stop="emit('more', pin.slug)"
              >
                <span class="material-symbols-outlined text-lg">more_horiz</span>
              </button>
            </div>
          </div>
        </div>

        <!-- Pin info below image -->
        <div class="px-2 pt-2 pb-3">
          <h2 v-if="pin.title" class="text-sm font-semibold leading-snug line-clamp-2 text-neutral-900">
            {{ pin.title }}
          </h2>

          <router-link
            :to="`/profile/${pin.username}`"
            class="mt-1.5 flex items-center gap-2 hover:bg-neutral-100 p-1 rounded-lg transition-colors"
            @click.stop
          >
            <div
              class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 overflow-hidden avatar-shadow"
              :class="pin.userAvatarColor"
            >
              <img v-if="pin.userAvatarUrl" :src="pin.userAvatarUrl" class="w-full h-full object-cover" />
              <span v-else class="avatar-text">{{ pin.user[0] }}</span>
            </div>
            <span class="text-xs text-neutral-600 truncate font-medium">{{ pin.user }}</span>
          </router-link>

          <div class="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
            <span v-if="pin.stats.saves > 0" class="flex items-center gap-0.5">
              {{ formatCount(pin.stats.saves) }}
              <span class="material-symbols-outlined text-xs" :class="{ 'fill-1 text-neutral-600': pin.saved }">bookmark</span>
            </span>
            <span v-if="pin.stats.reactions > 0" class="flex items-center gap-0.5">
              {{ formatCount(pin.stats.reactions) }}
              <span class="material-symbols-outlined text-xs fill-1" :class="pin.liked ? 'text-pink-500' : 'text-neutral-300'">favorite</span>
            </span>
          </div>
        </div>
      </article>
    </div>
  </div>
</template>
