import { ref, computed, watch, onMounted } from 'vue'

const STORAGE_OVERRIDE = 'pinova_low_data_override'

export type DataSaverOverride = 'auto' | 'on' | 'off'

function readOverride(): DataSaverOverride {
  if (typeof window === 'undefined') return 'auto'
  const v = window.localStorage.getItem(STORAGE_OVERRIDE)
  if (v === 'on' || v === 'off' || v === 'auto') return v
  return 'auto'
}

function saveOverride(v: DataSaverOverride) {
  if (typeof window === 'undefined') return
  window.localStorage.setItem(STORAGE_OVERRIDE, v)
}

function detectHeuristicLowData(): boolean {
  if (typeof window === 'undefined' || typeof navigator === 'undefined') return false
  const conn = navigator.connection as NetworkInformation | undefined
  if (conn?.saveData === true) return true
  const et = conn?.effectiveType
  if (et === 'slow-2g' || et === '2g') return true
  try {
    const narrow = window.matchMedia('(max-width: 639px)').matches
    const saveish = et === '3g'
    return narrow && !!saveish
  } catch {
    return false
  }
}

/** Attributs médias et préchargement allégés pour mobile ou connexion limitée. */
export function useDataSaver() {
  const override = ref<DataSaverOverride>('auto')

  onMounted(() => {
    override.value = readOverride()
  })

  const isLowDataMode = computed(() => {
    if (override.value === 'on') return true
    if (override.value === 'off') return false
    return detectHeuristicLowData()
  })

  const setOverride = (v: DataSaverOverride) => {
    override.value = v
    saveOverride(v)
  }

  const gridImageFetchPriority = computed(() => (isLowDataMode.value ? 'low' : 'auto'))
  const gridImageSizes = computed(() =>
    isLowDataMode.value ? '(max-width: 640px) 45vw, 18vw' : '(max-width: 640px) 50vw, 20vw',
  )
  const storyVideoPreload = computed<'none' | 'metadata'>(() => (isLowDataMode.value ? 'none' : 'metadata'))
  const detailVideoPreload = computed<'none' | 'metadata'>(() => (isLowDataMode.value ? 'none' : 'metadata'))

  watch(override, (v) => saveOverride(v))

  return {
    override,
    isLowDataMode,
    setOverride,
    gridImageFetchPriority,
    gridImageSizes,
    storyVideoPreload,
    detailVideoPreload,
  }
}

interface NetworkInformation {
  saveData?: boolean
  effectiveType?: string
}
