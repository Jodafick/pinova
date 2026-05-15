import { onMounted, onUnmounted, ref } from 'vue'

const LG_MAX_PX = 1023
const QUERY = `(max-width: ${LG_MAX_PX}px)`

/**
 * true quand la largeur viewport est celle des layouts « mobile / tablette » (<lg Tailwind),
 * pour aligner le flux création pin sur l’app native et le shell story web.
 */
export function useIsLgDown() {
  const isLgDown = ref(
    typeof window !== 'undefined' && typeof window.matchMedia === 'function'
      ? window.matchMedia(QUERY).matches
      : false,
  )

  let mq: MediaQueryList | null = null
  const apply = () => {
    if (mq) isLgDown.value = mq.matches
  }

  onMounted(() => {
    mq = window.matchMedia(QUERY)
    apply()
    mq.addEventListener('change', apply)
  })

  onUnmounted(() => {
    mq?.removeEventListener('change', apply)
  })

  return { isLgDown }
}
