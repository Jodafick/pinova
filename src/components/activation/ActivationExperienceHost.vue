<script setup lang="ts">
import { watch } from 'vue'
import { useRouter } from 'vue-router'
import {
  clearPendingPublishedPin,
  useActivationMoments,
} from '../../composables/useActivationMoments'
import { navigateToPublishedPin } from '../../utils/postPublishNavigation'
import FirstPinCelebrationModal from './FirstPinCelebrationModal.vue'
import CreatorSuggestionsSheet from './CreatorSuggestionsSheet.vue'

const router = useRouter()
const { celebrationOpen, suggestionsOpen, pendingPublishedPin } = useActivationMoments()

watch([celebrationOpen, suggestionsOpen], async ([celebrating, suggesting]) => {
  if (celebrating || suggesting) return
  const pending = pendingPublishedPin.value
  if (!pending?.slug) return
  const slug = pending.slug
  const username = pending.username
  clearPendingPublishedPin()
  await navigateToPublishedPin(router, { slug, username: username ?? null, pin: null })
})
</script>

<template>
  <FirstPinCelebrationModal v-model:open="celebrationOpen" />
  <CreatorSuggestionsSheet v-model:open="suggestionsOpen" />
</template>
