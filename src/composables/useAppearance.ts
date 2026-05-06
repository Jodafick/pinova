import { computed, ref } from 'vue'

export type AppearanceMode = 'light' | 'dark'

const STORAGE_KEY = 'pinova-appearance'

/** État singleton (SSR-safe : défaut light). */
const mode = ref<AppearanceMode>('light')
let syncedFromStorage = false

function detectSystemAppearance(): AppearanceMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

export function initAppearance(): void {
  if (typeof document === 'undefined') return
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (raw === 'dark' || raw === 'light') {
      mode.value = raw
    } else {
      mode.value = detectSystemAppearance()
    }
    syncedFromStorage = true
  } catch {
    mode.value = detectSystemAppearance()
    syncedFromStorage = true
  }
  applyAppearanceClass(mode.value)
}

export function applyAppearanceClass(m: AppearanceMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', m === 'dark')
}

function persistAppearance(m: AppearanceMode): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(STORAGE_KEY, m)
  } catch {
    /* ignore */
  }
}

export function useAppearance() {
  const setMode = (m: AppearanceMode) => {
    mode.value = m
    persistAppearance(m)
    applyAppearanceClass(m)
  }

  const toggle = () => {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  const isDark = computed(() => mode.value === 'dark')

  return {
    mode,
    isDark,
    setMode,
    toggle,
    /** Pour tests / hydratation */
    syncedFromStorage: () => syncedFromStorage,
  }
}
