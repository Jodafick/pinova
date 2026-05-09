<script setup lang="ts">
import { onMounted } from 'vue'
import { useRoute } from 'vue-router'

import { watchRouteForReferralIntent } from '../../composables/useReferralIntent'
import { ensureDeviceBindingId } from '../../utils/deviceBinding'

const route = useRoute()

onMounted(() => {
  ensureDeviceBindingId()
})

watchRouteForReferralIntent(() => route)
</script>

<template>
  <span class="hidden" aria-hidden="true" />
</template>
