/**
 * usePwaTheme — synchronise dynamiquement `<meta name="theme-color">`,
 * `<meta name="apple-mobile-web-app-status-bar-style">` et le `body.background-color`
 * avec le mode (dark/light) ET le contexte courant (route / couche / modale).
 *
 * Pourquoi c'est important :
 *  - En PWA standalone iOS, le `theme-color` détermine la teinte de la
 *    barre d'état (Dynamic Island incluse).
 *  - Un fond mismatch entre body et theme-color crée un "flash blanc" à
 *    l'ouverture de l'app.
 *  - Quand une couche fullscreen est ouverte, on veut la status bar adaptée
 *    à cette couche (ex: noir pour story viewer).
 *
 * Ce composable est **un singleton réactif** : on l'utilise dans App.vue
 * pour binder les valeurs, et n'importe quel composant peut appeler
 * `setThemeColor()` pour override temporairement (puis `clearOverride()` au
 * démontage).
 *
 * Stack de priorité (du plus prioritaire au moins) :
 *   1. Override manuel actif (setThemeColor)
 *   2. Top layer dans layerManager.stack (si statusBar non-'auto')
 *   3. Route courante (meta.statusBar / dark/light du moment)
 *   4. Fallback : noir en dark, blanc en light
 */

import { computed, ref, watch, type Ref } from 'vue'

interface ThemeColors {
  light: string
  dark: string
}

const DEFAULT_COLORS: ThemeColors = {
  light: '#ffffff',
  dark: '#0a0a0a',
}

const overrideColor: Ref<ThemeColors | null> = ref(null)
const isDark = ref(false)

function applyThemeColor(color: string) {
  if (typeof document === 'undefined') return
  /* theme-color : status bar PWA. */
  let metaTheme = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
  if (!metaTheme) {
    metaTheme = document.createElement('meta')
    metaTheme.setAttribute('name', 'theme-color')
    document.head.appendChild(metaTheme)
  }
  if (metaTheme.getAttribute('content') !== color) {
    metaTheme.setAttribute('content', color)
  }
  /* background-color du body pour éviter le flash blanc à l'ouverture. */
  if (document.body.style.backgroundColor !== color) {
    document.body.style.backgroundColor = color
  }
}

function applyAppleStatusBarStyle(style: 'default' | 'black' | 'black-translucent') {
  if (typeof document === 'undefined') return
  let meta = document.querySelector<HTMLMetaElement>('meta[name="apple-mobile-web-app-status-bar-style"]')
  if (!meta) {
    meta = document.createElement('meta')
    meta.setAttribute('name', 'apple-mobile-web-app-status-bar-style')
    document.head.appendChild(meta)
  }
  if (meta.getAttribute('content') !== style) {
    meta.setAttribute('content', style)
  }
}

const resolvedColor = computed(() => {
  const colors = overrideColor.value ?? DEFAULT_COLORS
  return isDark.value ? colors.dark : colors.light
})

let watching = false
function startWatchingDark() {
  if (watching) return
  if (typeof document === 'undefined' || typeof MutationObserver === 'undefined') return
  watching = true
  isDark.value = document.documentElement.classList.contains('dark')
  const observer = new MutationObserver(() => {
    const next = document.documentElement.classList.contains('dark')
    if (next !== isDark.value) isDark.value = next
  })
  observer.observe(document.documentElement, { attributes: true, attributeFilter: ['class'] })
  /* Le PWA reste mounted toute la durée de la session → pas de cleanup. */
}

export interface UsePwaThemeReturn {
  /** Couleur résolue courante (hex). */
  resolvedColor: Readonly<Ref<string>>
  /** Le mode dark est-il actif ? */
  isDark: Readonly<Ref<boolean>>
  /**
   * Override temporaire (ex: page de story → noir + status-bar translucide).
   * Appeler `clearThemeColor()` pour revenir au comportement par défaut.
   */
  setThemeColor: (light: string, dark?: string, statusBar?: 'default' | 'black' | 'black-translucent') => void
  /** Annule l'override. */
  clearThemeColor: () => void
}

/**
 * Initialise le watcher dark/light + le binding `meta theme-color`.
 * À appeler UNE FOIS au boot (depuis App.vue).
 */
export function initPwaTheme(): void {
  startWatchingDark()
  /* Toute variation de `resolvedColor` (dark/light, override tiroir profil, etc.) → meta + body. */
  watch(resolvedColor, (color) => applyThemeColor(color), { immediate: true })
}

/** Même teinte que le menu profil mobile — status bar / body PWA alignés. */
const PROFILE_DRAWER_THEME: ThemeColors = {
  light: '#e11d77',
  dark: '#4c0d24',
}

export function setProfileDrawerPwaTheme(): void {
  overrideColor.value = PROFILE_DRAWER_THEME
  applyAppleStatusBarStyle('black-translucent')
  applyThemeColor(resolvedColor.value)
}

export function clearProfileDrawerPwaTheme(): void {
  overrideColor.value = null
  applyAppleStatusBarStyle('black-translucent')
  applyThemeColor(resolvedColor.value)
}

export function usePwaTheme(): UsePwaThemeReturn {
  startWatchingDark()

  /* Synchronisation continue. */
  watch(resolvedColor, (color) => applyThemeColor(color), { immediate: true })

  function setThemeColor(light: string, dark?: string, statusBar?: 'default' | 'black' | 'black-translucent') {
    overrideColor.value = { light, dark: dark ?? light }
    if (statusBar) applyAppleStatusBarStyle(statusBar)
  }

  function clearThemeColor() {
    overrideColor.value = null
    /* iOS black-translucent (par défaut dans index.html) permet le contenu sous Dynamic Island. */
    applyAppleStatusBarStyle('black-translucent')
  }

  return {
    resolvedColor,
    isDark,
    setThemeColor,
    clearThemeColor,
  }
}
