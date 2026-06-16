<script setup lang="ts">
import { onMounted, onUnmounted } from 'vue'
import type { SponsoredAd } from '../types'
import { useI18n } from '../i18n'
import SponsoredDetailView from './SponsoredDetailView.vue'

const props = defineProps<{
  item: SponsoredAd
  hasPrevious: boolean
  hasNext: boolean
}>()

const emit = defineEmits<{
  (e: 'close'): void
  (e: 'prev'): void
  (e: 'next'): void
}>()

const { t } = useI18n()

function onKeydown(e: KeyboardEvent) {
  if (e.key === 'ArrowLeft' && props.hasPrevious) {
    e.preventDefault()
    emit('prev')
  } else if (e.key === 'ArrowRight' && props.hasNext) {
    e.preventDefault()
    emit('next')
  } else if (e.key === 'Escape') {
    e.preventDefault()
    emit('close')
  }
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <Teleport to="body">
    <section class="hidden lg:flex fixed inset-0 z-[95] items-center justify-center px-8 py-7">
      <button
        type="button"
        class="absolute inset-0 bg-white/35 dark:bg-neutral-950/40 backdrop-blur-2xl saturate-150"
        :aria-label="t('common.close')"
        @click="emit('close')"
      />

      <button
        v-if="hasPrevious"
        type="button"
        class="absolute left-6 top-1/2 z-[2] -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-xl ring-1 ring-white/15 transition hover:bg-black/60"
        :aria-label="t('foto.overlay.prev')"
        @click="emit('prev')"
      >
        <FotoceIcon name="chevron_left" class="text-3xl" />
      </button>

      <button
        v-if="hasNext"
        type="button"
        class="absolute right-6 top-1/2 z-[2] -translate-y-1/2 grid h-12 w-12 place-items-center rounded-full bg-black/45 text-white backdrop-blur-xl ring-1 ring-white/15 transition hover:bg-black/60"
        :aria-label="t('foto.overlay.next')"
        @click="emit('next')"
      >
        <FotoceIcon name="chevron_right" class="text-3xl" />
      </button>

      <article
        class="relative z-[1] flex h-[min(86vh,760px)] w-full max-w-3xl flex-col overflow-hidden rounded-[2rem] bg-neutral-950 text-white shadow-[0_32px_100px_rgba(0,0,0,0.45)] ring-1 ring-white/15"
        role="dialog"
        aria-modal="true"
      >
        <button
          type="button"
          class="absolute right-4 top-4 z-20 grid h-11 w-11 place-items-center rounded-full bg-black/45 text-white backdrop-blur-xl ring-1 ring-white/15 transition hover:bg-black/60"
          :aria-label="t('common.close')"
          @click="emit('close')"
        >
          <FotoceIcon name="close" class="text-2xl" />
        </button>
        <SponsoredDetailView :item="item" tone="dark" layout="desktop" />
      </article>
    </section>
  </Teleport>
</template>
