<script setup lang="ts">
import { onMounted, ref, watch } from 'vue'
import api from '../api'
import { mapSponsoredFromApi } from '../composables/usePins'
import type { SponsoredAd } from '../types'
import SponsoredContentCard from './SponsoredContentCard.vue'

const props = withDefaults(
  defineProps<{
    placement: 'pin_detail' | 'story'
    topic?: string
    variant?: 'detail' | 'story'
  }>(),
  { topic: '', variant: 'detail' },
)

const ad = ref<SponsoredAd | null>(null)
const dismissed = ref(false)

async function load() {
  dismissed.value = false
  try {
    const res = await api.get<{ ad: Record<string, unknown> | null }>('monetization/contextual-ad/', {
      params: { placement: props.placement, topic: props.topic || undefined },
    })
    const raw = res.data?.ad
    ad.value = raw ? mapSponsoredFromApi(raw) : null
  } catch {
    ad.value = null
  }
}

onMounted(() => void load())
watch(() => [props.placement, props.topic], () => void load())
</script>

<template>
  <div v-if="ad && !dismissed" class="contextual-sponsored-slot">
    <div v-if="variant === 'story'" class="absolute inset-x-3 bottom-24 z-30 pointer-events-auto">
      <div class="relative">
        <button
          type="button"
          class="absolute -top-2 -right-2 z-10 h-7 w-7 rounded-full bg-black/60 text-white text-xs"
          aria-label="Fermer"
          @click="dismissed = true"
        >
          ×
        </button>
        <SponsoredContentCard :item="ad" variant="story" />
      </div>
    </div>
    <div v-else class="px-4 py-3">
      <SponsoredContentCard :item="ad" variant="detail" />
    </div>
  </div>
</template>
