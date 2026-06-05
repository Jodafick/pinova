<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import api from '../api'
import { mapSponsoredFromApi } from '../composables/usePins'
import type { SponsoredAd } from '../types'
import SponsoredNativeStrip from './SponsoredNativeStrip.vue'

const props = withDefaults(
  defineProps<{
    placement: 'pin_detail' | 'story'
    topic?: string
    variant?: 'detail' | 'story'
    tone?: 'light' | 'dark'
  }>(),
  { topic: '', variant: 'detail', tone: 'light' },
)

const ad = ref<SponsoredAd | null>(null)
const dismissed = ref(false)

const stripVariant = computed<'detail' | 'story'>(() =>
  props.tone === 'dark' || props.variant === 'story' ? 'story' : 'detail',
)

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
  <div v-if="ad && !dismissed" class="contextual-sponsored-slot pointer-events-auto">
    <div
      v-if="variant === 'story'"
      class="absolute inset-x-4 bottom-[5.5rem] z-30 max-w-md mx-auto"
    >
      <SponsoredNativeStrip :item="ad" :variant="stripVariant" @dismiss="dismissed = true" />
    </div>
    <div v-else>
      <SponsoredNativeStrip :item="ad" :variant="stripVariant" @dismiss="dismissed = true" />
    </div>
  </div>
</template>
