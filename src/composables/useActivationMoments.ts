import { ref } from 'vue'
import type { CreatorMilestoneId } from '@pinova/shared'

export type PublishedPinPayload = {
  slug: string
  username?: string | null
}

const celebrationOpen = ref(false)
const suggestionsOpen = ref(false)
const pendingPublishedPin = ref<PublishedPinPayload | null>(null)

export function useActivationMoments() {
  return {
    celebrationOpen,
    suggestionsOpen,
    pendingPublishedPin,
  }
}

export function openFirstPinCelebration(payload: PublishedPinPayload) {
  pendingPublishedPin.value = payload
  celebrationOpen.value = true
}

export function closeFirstPinCelebration() {
  celebrationOpen.value = false
}

export function openCreatorSuggestionsAfterCelebration() {
  celebrationOpen.value = false
  suggestionsOpen.value = true
}

export function closeCreatorSuggestions() {
  suggestionsOpen.value = false
}

export function clearPendingPublishedPin() {
  pendingPublishedPin.value = null
}

export function recordCreatorMilestoneLocal(id: CreatorMilestoneId) {
  /* réservé — la persistance passe par useActivationFunnel.patchFunnel */
  void id
}
