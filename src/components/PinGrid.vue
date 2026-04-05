<script setup lang="ts">
import type { Pin } from '../types'
import { usePins } from '../composables/usePins'

const { formatCount } = usePins()

defineProps<{
  pins: Pin[]
}>()

const emit = defineEmits<{
  (e: 'toggle-save', id: number): void
  (e: 'open-pin', id: number): void
  (e: 'more', id: number): void
}>()
</script>

<template>
  <section
    class="columns-2 sm:columns-3 lg:columns-4 xl:columns-5 gap-3 sm:gap-4"
    aria-label="Flux de pins"
  >
    <article
      v-for="pin in pins"
      :key="pin.id"
      class="group relative break-inside-avoid mb-3 sm:mb-4 rounded-2xl overflow-hidden bg-white shadow-sm hover:shadow-xl transition-all cursor-pointer"
      @click="emit('open-pin', pin.id)"
    >
      <!-- Image container -->
      <div class="relative overflow-hidden rounded-2xl">
        <img
          :src="pin.imageUrl"
          :alt="pin.title"
          class="w-full object-cover group-hover:scale-105 transition-transform duration-500"
          loading="lazy"
        />

        <!-- Dark overlay on hover -->
        <div class="absolute inset-0 bg-black/0 group-hover:bg-black/20 transition-colors duration-300"></div>

        <!-- Save button -->
        <button
          class="absolute top-3 right-3 px-4 py-2 rounded-full text-sm font-bold opacity-0 group-hover:opacity-100 translate-y-1 group-hover:translate-y-0 transition-all duration-200 shadow-lg"
          :class="pin.saved ? 'bg-neutral-900 text-white' : 'bg-red-600 text-white hover:bg-red-700'"
          @click.stop="emit('toggle-save', pin.id)"
        >
          {{ pin.saved ? 'Enregistré' : 'Enregistrer' }}
        </button>

        <!-- Bottom actions on hover -->
        <div class="absolute bottom-3 left-3 right-3 flex items-center justify-between opacity-0 group-hover:opacity-100 transition-opacity duration-200">
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
              @click.stop="emit('more', pin.id)"
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

        <div class="mt-1.5 flex items-center gap-2">
          <div
            class="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0"
            :class="pin.userAvatarColor"
          >
            {{ pin.user[0] }}
          </div>
          <span class="text-xs text-neutral-600 truncate">{{ pin.user }}</span>
        </div>

        <div class="mt-1 flex items-center gap-3 text-[11px] text-neutral-400">
          <span v-if="pin.stats.saves > 0">{{ formatCount(pin.stats.saves) }} enreg.</span>
          <span v-if="pin.stats.reactions > 0" class="flex items-center gap-0.5">
            {{ formatCount(pin.stats.reactions) }}
            <span class="material-symbols-outlined text-xs">favorite</span>
          </span>
        </div>
      </div>
    </article>
  </section>
</template>
