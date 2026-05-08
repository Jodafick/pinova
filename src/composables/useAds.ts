import { computed, onMounted, ref } from 'vue'

const ADSENSE_CLIENT = (import.meta.env.VITE_ADSENSE_CLIENT as string | undefined)?.trim() ?? ''
const ADSENSE_ENABLED = (import.meta.env.VITE_ADSENSE_ENABLED as string | undefined) !== 'false'
const CONSENT_KEY = 'pinova_ads_consent'

const scriptLoaded = ref(false)
const adBlocked = ref(false)
const consent = ref<boolean | null>(null)

function isClient() {
  return typeof window !== 'undefined' && typeof document !== 'undefined'
}

function pushAd() {
  if (!isClient()) return
  try {
    ;(window as Window & { adsbygoogle?: unknown[] }).adsbygoogle?.push({})
  } catch {
    adBlocked.value = true
  }
}

function loadAdsenseScript() {
  if (!isClient() || scriptLoaded.value || !ADSENSE_CLIENT || !ADSENSE_ENABLED || !consent.value) return
  const existing = document.querySelector<HTMLScriptElement>('script[data-pinova-adsense="1"]')
  if (existing) {
    scriptLoaded.value = true
    return
  }
  const script = document.createElement('script')
  script.async = true
  script.src = `https://pagead2.googlesyndication.com/pagead/js/adsbygoogle.js?client=${ADSENSE_CLIENT}`
  script.crossOrigin = 'anonymous'
  script.dataset.pinovaAdsense = '1'
  script.onload = () => {
    scriptLoaded.value = true
  }
  script.onerror = () => {
    adBlocked.value = true
  }
  document.head.appendChild(script)
}

function readConsent() {
  if (!isClient()) return null
  const raw = window.localStorage.getItem(CONSENT_KEY)
  if (raw === '1') return true
  if (raw === '0') return false
  return null
}

export function useAds() {
  onMounted(() => {
    consent.value = readConsent()
    loadAdsenseScript()
  })

  const canRenderAds = computed(
    () => isClient() && ADSENSE_ENABLED && !!ADSENSE_CLIENT && consent.value === true && !adBlocked.value,
  )

  function setConsent(next: boolean) {
    consent.value = next
    if (isClient()) {
      window.localStorage.setItem(CONSENT_KEY, next ? '1' : '0')
    }
    if (next) loadAdsenseScript()
  }

  return {
    ADSENSE_CLIENT,
    consent,
    canRenderAds,
    adBlocked,
    scriptLoaded,
    setConsent,
    loadAdsenseScript,
    pushAd,
  }
}
