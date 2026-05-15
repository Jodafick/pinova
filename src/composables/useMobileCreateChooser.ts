import { ref } from 'vue'

const mobileCreateChooserOpen = ref(false)

export function useMobileCreateChooser() {
  function openMobileCreateChooser() {
    mobileCreateChooserOpen.value = true
  }
  return {
    mobileCreateChooserOpen,
    openMobileCreateChooser,
  }
}
