import { ref } from 'vue'

export type GuestAuthIntent = 'like' | 'save' | 'follow' | 'comment' | 'contest' | 'generic'

const open = ref(false)
const intent = ref<GuestAuthIntent>('generic')

export function useGuestAuthGate() {
  function promptGuest(i: GuestAuthIntent = 'generic') {
    intent.value = i
    open.value = true
  }

  function closeGuestGate() {
    open.value = false
  }

  return { guestGateOpen: open, guestGateIntent: intent, promptGuest, closeGuestGate }
}
