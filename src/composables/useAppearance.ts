import { computed, ref } from 'vue'

export type AppearanceMode = 'light' | 'dark'
export type AppearancePreference = 'light' | 'dark' | 'system'

const STORAGE_KEY = 'fotoce-appearance'
const PREF_STORAGE_KEY = 'fotoce-appearance-pref'

/** Mode effectif appliqué (light/dark). */
const mode = ref<AppearanceMode>('light')
/** Préférence utilisateur incluant « système ». */
const preference = ref<AppearancePreference>('system')
let syncedFromStorage = false

function detectSystemAppearance(): AppearanceMode {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return 'light'
  try {
    return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
  } catch {
    return 'light'
  }
}

function resolveEffectiveMode(pref: AppearancePreference): AppearanceMode {
  if (pref === 'system') return detectSystemAppearance()
  return pref
}

export function initAppearance(): void {
  if (typeof document === 'undefined') return
  try {
    const prefRaw = localStorage.getItem(PREF_STORAGE_KEY)
    if (prefRaw === 'dark' || prefRaw === 'light' || prefRaw === 'system') {
      preference.value = prefRaw
    } else {
      const legacy = localStorage.getItem(STORAGE_KEY)
      if (legacy === 'dark' || legacy === 'light') {
        preference.value = legacy
      } else {
        preference.value = 'system'
      }
    }
    mode.value = resolveEffectiveMode(preference.value)
    syncedFromStorage = true
  } catch {
    preference.value = 'system'
    mode.value = detectSystemAppearance()
    syncedFromStorage = true
  }
  applyAppearanceClass(mode.value)
  if (typeof window !== 'undefined' && typeof window.matchMedia === 'function') {
    try {
      const mq = window.matchMedia('(prefers-color-scheme: dark)')
      mq.addEventListener('change', () => {
        if (preference.value === 'system') {
          mode.value = detectSystemAppearance()
          applyAppearanceClass(mode.value)
        }
      })
    } catch {
      /* ignore */
    }
  }
}

export function applyAppearanceClass(m: AppearanceMode): void {
  if (typeof document === 'undefined') return
  document.documentElement.classList.toggle('dark', m === 'dark')
  document.documentElement.dataset.fotoceAccent =
    (typeof document !== 'undefined' && document.documentElement.dataset.fotoceAccent) || 'rose'
}

export function applyAccentColor(accentId: string): void {
  if (typeof document === 'undefined') return
  document.documentElement.dataset.fotoceAccent = accentId || 'rose'
}

function persistAppearance(pref: AppearancePreference, effective: AppearanceMode): void {
  if (typeof localStorage === 'undefined') return
  try {
    localStorage.setItem(PREF_STORAGE_KEY, pref)
    localStorage.setItem(STORAGE_KEY, effective)
  } catch {
    /* ignore */
  }
}

export function syncAppearanceFromProfile(themeMode?: string | null): void {
  const pref =
    themeMode === 'light' || themeMode === 'dark' || themeMode === 'system' ? themeMode : preference.value
  preference.value = pref
  mode.value = resolveEffectiveMode(pref)
  persistAppearance(pref, mode.value)
  applyAppearanceClass(mode.value)
}

export function useAppearance() {
  const setPreference = (pref: AppearancePreference) => {
    preference.value = pref
    mode.value = resolveEffectiveMode(pref)
    persistAppearance(pref, mode.value)
    applyAppearanceClass(mode.value)
  }

  const setMode = (m: AppearanceMode) => {
    setPreference(m)
  }

  const toggle = () => {
    setMode(mode.value === 'dark' ? 'light' : 'dark')
  }

  const isDark = computed(() => mode.value === 'dark')

  return {
    mode,
    preference,
    isDark,
    setMode,
    setPreference,
    toggle,
    syncedFromStorage: () => syncedFromStorage,
  }
}
