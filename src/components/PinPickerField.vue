<script setup lang="ts">
import { computed, ref } from 'vue'
import type { Pin } from '../types'
import { useI18n } from '../i18n'
import OfflineImg from './OfflineImg.vue'

const props = defineProps<{
  pins: Pin[]
  selectedSlug: string
  loading?: boolean
  loadingMore?: boolean
  hasMore?: boolean
}>()

const emit = defineEmits<{
  (e: 'select', slug: string): void
  (e: 'load-more'): void
}>()

const { t } = useI18n()
const search = ref('')

const filteredPins = computed(() => {
  const q = search.value.trim().toLowerCase()
  if (!q) return props.pins
  return props.pins.filter((p) => {
    const title = (p.title || '').toLowerCase()
    const slug = p.slug.toLowerCase()
    return title.includes(q) || slug.includes(q)
  })
})
</script>

<template>
  <div class="pin-picker-field space-y-2">
    <input
      v-model="search"
      type="search"
      class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm"
      :placeholder="t('promote.picker.search')"
      :disabled="loading"
    />

    <div v-if="loading && !pins.length" class="py-6 text-center text-sm text-neutral-400">
      {{ t('common.loading') }}
    </div>
    <p v-else-if="!pins.length" class="text-sm text-neutral-500 py-2">{{ t('promote.sheet.noPins') }}</p>
    <p v-else-if="!filteredPins.length" class="text-sm text-neutral-500 py-2">{{ t('promote.picker.noMatch') }}</p>

    <div
      v-else
      class="max-h-52 overflow-y-auto rounded-xl border app-divider-subtle divide-y divide-neutral-100 dark:divide-neutral-800"
    >
      <button
        v-for="p in filteredPins"
        :key="p.slug"
        type="button"
        class="flex w-full items-center gap-3 px-3 py-2.5 text-left transition hover:bg-pink-50/60 dark:hover:bg-pink-950/20"
        :class="selectedSlug === p.slug ? 'bg-pink-50 dark:bg-pink-950/30' : ''"
        @click="emit('select', p.slug)"
      >
        <div class="h-12 w-10 shrink-0 overflow-hidden rounded-lg bg-neutral-100 dark:bg-neutral-800">
          <OfflineImg
            v-if="p.imageUrl"
            :src="p.imageUrl"
            :alt="p.title || p.slug"
            class="h-full w-full object-cover"
          />
        </div>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
            {{ p.title || t('promote.picker.untitled') }}
          </p>
          <p class="text-xs text-neutral-500 truncate">{{ p.slug }}</p>
        </div>
        <PinovaIcon name="check_circle" class="text-pink-600 text-lg shrink-0" />
      </button>
    </div>

    <button
      v-if="hasMore && !search.trim()"
      type="button"
      class="w-full rounded-xl border border-dashed app-divider-subtle py-2 text-xs font-semibold text-pink-700 disabled:opacity-50"
      :disabled="loadingMore"
      @click="emit('load-more')"
    >
      {{ loadingMore ? t('common.loading') : t('promote.picker.loadMore') }}
    </button>
  </div>
</template>
