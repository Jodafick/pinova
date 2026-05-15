/**
 * usePwaContext — détection plateforme + état d'installation centralisé.
 *
 * Réf unique pour TOUTE l'app concernant :
 *  - Plateforme (iOS / Android / desktop)
 *  - Navigateur (Safari / Chrome iOS / Firefox iOS / Chrome Android / etc.)
 *  - Mode d'affichage (browser / standalone / minimal-ui / fullscreen)
 *  - Installabilité (event `beforeinstallprompt` capturé, déclenchable)
 *  - Offline status (`navigator.onLine` + `online` / `offline` events)
 *
 * Pourquoi un singleton ?
 *  - On capture `beforeinstallprompt` UNE SEULE FOIS au boot (sinon il est perdu).
 *  - On évite des dizaines de matchMedia listeners.
 *  - L'état doit être partagé entre App.vue, PwaInstallExperience, OfflineExperience, etc.
 *
 * Note iOS Safari :
 *  - `beforeinstallprompt` n'existe PAS sur iOS. La détection passe par
 *    `navigator.standalone` (déprécié mais toujours fonctionnel) + UA sniffing.
 *  - Pour proposer l'install, on doit afficher des instructions visuelles
 *    (Share → Add to Home Screen). C'est ce que fait `PwaInstallExperience`.
 *
 * Usage :
 *
 *   const { platform, isStandalone, canPromptInstall, promptInstall, isOnline } = usePwaContext()
 */

import { computed, ref, type Ref } from 'vue'

export type Platform = 'ios' | 'android' | 'desktop' | 'unknown'
export type Browser =
  | 'safari'
  | 'chrome-ios'   /* WKWebView Chrome iOS */
  | 'firefox-ios'
  | 'edge-ios'
  | 'chrome'
  | 'firefox'
  | 'edge'
  | 'samsung'
  | 'unknown'

export type DisplayMode = 'browser' | 'standalone' | 'minimal-ui' | 'fullscreen' | 'window-controls-overlay'

interface BeforeInstallPromptEvent extends Event {
  readonly platforms: ReadonlyArray<string>
  readonly userChoice: Promise<{ outcome: 'accepted' | 'dismissed'; platform: string }>
  prompt(): Promise<void>
}

/* ───────────────────────── Singleton state ───────────────────────── */

const platform: Ref<Platform> = ref('unknown')
const browser: Ref<Browser> = ref('unknown')
const displayMode: Ref<DisplayMode> = ref('browser')
const isOnline = ref(typeof navigator !== 'undefined' ? navigator.onLine : true)
const installPromptEvt = ref<BeforeInstallPromptEvent | null>(null)
const wasInstalledThisSession = ref(false)
let initialized = false

function detectPlatform(): Platform {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  /* iPad 13+ se présente comme Mac → on regarde maxTouchPoints. */
  if (/iPhone|iPad|iPod/i.test(ua)) return 'ios'
  if (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1) return 'ios'
  if (/Android/i.test(ua)) return 'android'
  return 'desktop'
}

function detectBrowser(): Browser {
  if (typeof navigator === 'undefined') return 'unknown'
  const ua = navigator.userAgent
  /* Sur iOS, tous les navigateurs utilisent WebKit. On distingue par l'UA :
     - Safari            : pas de CriOS / FxiOS / EdgiOS dans l'UA
     - Chrome iOS        : CriOS
     - Firefox iOS       : FxiOS
     - Edge iOS          : EdgiOS
  */
  if (/iPhone|iPad|iPod/i.test(ua) || (navigator.platform === 'MacIntel' && (navigator as Navigator & { maxTouchPoints?: number }).maxTouchPoints! > 1)) {
    if (/CriOS/.test(ua)) return 'chrome-ios'
    if (/FxiOS/.test(ua)) return 'firefox-ios'
    if (/EdgiOS/.test(ua)) return 'edge-ios'
    if (/Safari/.test(ua)) return 'safari'
    return 'unknown'
  }
  /* Desktop / Android : ordre de check important (Edge > Chrome > Firefox). */
  if (/Edg\//.test(ua)) return 'edge'
  if (/SamsungBrowser/.test(ua)) return 'samsung'
  if (/Chrome\//.test(ua)) return 'chrome'
  if (/Firefox\//.test(ua)) return 'firefox'
  if (/Safari\//.test(ua)) return 'safari'
  return 'unknown'
}

function detectDisplayMode(): DisplayMode {
  if (typeof window === 'undefined') return 'browser'
  /* iOS Safari : navigator.standalone === true quand installé depuis l'écran d'accueil. */
  const nav = navigator as Navigator & { standalone?: boolean }
  if (nav.standalone === true) return 'standalone'
  /* Standard PWA via matchMedia. */
  const modes: DisplayMode[] = ['standalone', 'minimal-ui', 'fullscreen', 'window-controls-overlay']
  for (const mode of modes) {
    try {
      if (window.matchMedia(`(display-mode: ${mode})`).matches) return mode
    } catch { /* ignore */ }
  }
  return 'browser'
}

function bindStateListeners() {
  if (typeof window === 'undefined') return
  /* beforeinstallprompt (Chrome / Edge / Samsung). */
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    installPromptEvt.value = e as BeforeInstallPromptEvent
  })
  /* appinstalled : utilisateur a accepté l'install. */
  window.addEventListener('appinstalled', () => {
    wasInstalledThisSession.value = true
    installPromptEvt.value = null
  })
  /* Online / offline. */
  window.addEventListener('online', () => { isOnline.value = true })
  window.addEventListener('offline', () => { isOnline.value = false })
  /* Display mode change (utile pour transitions browser ↔ standalone). */
  try {
    const mql = window.matchMedia('(display-mode: standalone)')
    const update = () => { displayMode.value = detectDisplayMode() }
    if (mql.addEventListener) mql.addEventListener('change', update)
    else (mql as unknown as { addListener: (cb: () => void) => void }).addListener(update)
  } catch { /* ignore */ }
}

function ensureInit() {
  if (initialized) return
  initialized = true
  platform.value = detectPlatform()
  browser.value = detectBrowser()
  displayMode.value = detectDisplayMode()
  bindStateListeners()
}

/* ───────────────────────── API ───────────────────────── */

export interface UsePwaContextReturn {
  platform: Readonly<Ref<Platform>>
  browser: Readonly<Ref<Browser>>
  displayMode: Readonly<Ref<DisplayMode>>
  isStandalone: Readonly<Ref<boolean>>
  isIos: Readonly<Ref<boolean>>
  isAndroid: Readonly<Ref<boolean>>
  isMobile: Readonly<Ref<boolean>>
  isSafariIos: Readonly<Ref<boolean>>
  isChromeIos: Readonly<Ref<boolean>>
  /** Vrai si on peut déclencher `prompt()` (Android / Chrome). */
  canPromptInstall: Readonly<Ref<boolean>>
  /**
   * Affiche le prompt natif (Android / Chrome). Sur iOS Safari, renvoie 'unsupported'
   * — il faut afficher l'onboarding visuel à la place.
   */
  promptInstall: () => Promise<'accepted' | 'dismissed' | 'unsupported'>
  /** True si l'install s'est faite pendant la session courante. */
  wasJustInstalled: Readonly<Ref<boolean>>
  /** Statut online/offline réactif. */
  isOnline: Readonly<Ref<boolean>>
}

export function usePwaContext(): UsePwaContextReturn {
  /* Init synchrone idempotente — peut être appelée hors setup. */
  ensureInit()

  const isStandalone = computed(() => displayMode.value === 'standalone' || displayMode.value === 'fullscreen')
  const isIos = computed(() => platform.value === 'ios')
  const isAndroid = computed(() => platform.value === 'android')
  const isMobile = computed(() => isIos.value || isAndroid.value)
  const isSafariIos = computed(() => isIos.value && browser.value === 'safari')
  const isChromeIos = computed(() => isIos.value && browser.value === 'chrome-ios')
  const canPromptInstall = computed(() => installPromptEvt.value != null)

  async function promptInstall(): Promise<'accepted' | 'dismissed' | 'unsupported'> {
    const evt = installPromptEvt.value
    if (!evt) return 'unsupported'
    try {
      await evt.prompt()
      const choice = await evt.userChoice
      installPromptEvt.value = null
      return choice.outcome
    } catch (e) {
      console.warn('[usePwaContext] promptInstall error', e)
      return 'unsupported'
    }
  }

  return {
    platform,
    browser,
    displayMode,
    isStandalone,
    isIos,
    isAndroid,
    isMobile,
    isSafariIos,
    isChromeIos,
    canPromptInstall,
    promptInstall,
    wasJustInstalled: wasInstalledThisSession,
    isOnline,
  }
}

/**
 * À appeler au boot AVANT le mount pour capturer `beforeinstallprompt`
 * (qui peut se déclencher avant que le premier composant soit monté).
 */
export function initPwaContext(): void {
  ensureInit()
}
