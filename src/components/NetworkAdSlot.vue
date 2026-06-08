<script setup lang="ts">
import { useNetworkAds } from '../composables/useNetworkAds'
import NetworkAdBanner from './NetworkAdBanner.vue'

const props = withDefaults(
  defineProps<{
    placement?: 'feed' | 'detail'
  }>(),
  { placement: 'detail' },
)

const { showFeedAds, showDetailAds, webClientId, webFeedSlot, webDetailSlot } = useNetworkAds()

const visible = props.placement === 'feed' ? showFeedAds : showDetailAds
const slotId = props.placement === 'feed' ? webFeedSlot : webDetailSlot
</script>

<template>
  <NetworkAdBanner
    v-if="visible && webClientId && slotId"
    :client-id="webClientId"
    :slot-id="slotId"
    :variant="placement"
  />
</template>
