<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useAuth } from './composables/useAuth'
import { useMobileCreateChooser } from './composables/useMobileCreateChooser'
import { useI18n } from './i18n'
import GlobalHeader from './components/GlobalHeader.vue'
import AppMobilePageHeader from './components/AppMobilePageHeader.vue'
import MobileCreateChooser from './components/MobileCreateChooser.vue'
import AppAlertModal from './components/AppAlertModal.vue'
import ReferralRouteCapture from './components/referral/ReferralRouteCapture.vue'
import LayerHost from './components/layers/LayerHost.vue'
import PinContextualMenu from './components/PinContextualMenu.vue'
import OfflineExperience from './components/pwa/OfflineExperience.vue'
import PwaSplash from './components/pwa/PwaSplash.vue'
import PwaInstallExperience from './components/pwa/PwaInstallExperience.vue'
import NativeAppSuggestBanner from './components/NativeAppSuggestBanner.vue'
import AmbientGlow from './components/AmbientGlow.vue'
import ImmersiveMediaViewer from './components/ui/ImmersiveMediaViewer.vue'
import { useImmersiveViewer } from './composables/useImmersiveViewer'
import AppToast from './components/AppToast.vue'
import CookieConsentBanner from './components/CookieConsentBanner.vue'
import NotificationEnablePrompt from './components/NotificationEnablePrompt.vue'
import GuestAuthSheet from './components/GuestAuthSheet.vue'
import AppMobileTabBar from './components/AppMobileTabBar.vue'
import { useGuestAuthGate } from './composables/useGuestAuthGate'
import { usePendingIntentReplay } from './composables/usePendingIntentReplay'
import { initPwaTheme } from './composables/usePwaTheme'
import { initPwaContext } from './composables/usePwaContext'
import { useEdgeSwipeBack } from './composables/useEdgeSwipeBack'
import { useIsLgDown } from './composables/useIsLgDown'
import { devLog } from './lib/devLog'
import { resetPinovaBodyScrollLock } from './utils/pinovaModalBodyLock'
import { getAppScrollRoot } from './utils/appScrollRoot'
import { layerManager } from './navigation/layerManager'
import { adaptiveProfile, getPageTransitionNames } from './navigation/adaptiveNavigator'
import { pop as nativeStackPop } from './navigation/nativeStack'
import { pageNavDirection, pageNavIsInitial } from './navigation/routerViewTransition'
import {
  mobileBoardMoreButtonRef,
  mobileBoardMoreTrailing,
  mobileHeaderSubtitle,
  mobileHeaderTitleOverride,
  mobileMarkAllReadTrailing,
  mobileProfileTrailing,
  profileNavMobileDrawerOpen,
} from './composables/mobileHeaderContext'
import { useNotificationPrompt } from './composables/useNotificationPrompt'
import { useNotificationLive } from './composables/useNotificationLive'
import { usePwaInstallPrompt } from './composables/usePwaInstallPrompt'
import { useMobilePullToRefresh } from './composables/useMobilePullToRefresh'
import { isValidSettingsSectionId, settingsDetailTitleKey } from './data/settingsHubConfig'
import { reloadPwaApplication } from './utils/pwaAppReload'

/** Réf. du bouton ⋮ board : assignée dans le template ; `void` évite TS6133 (usage non vu par vue-tsc côté script). */
void mobileBoardMoreButtonRef

const route = useRoute()
const router = useRouter()
const { isLgDown } = useIsLgDown()
const appShellRef = ref<HTMLElement | null>(null)
const mainContentRef = ref<HTMLElement | null>(null)
/** Route « derrière » pour l’aperçu du geste edge-back (libellé discret). */
const edgePeekSourcePath = ref('')
const { fetchCurrentUser, isAuthenticated, currentUser } = useAuth()
const { guestGateOpen, guestGateIntent, closeGuestGate } = useGuestAuthGate()
usePendingIntentReplay()
const {
  notificationPromptOpen,
  notificationPromptSnooze,
  notificationPromptDecline,
} = useNotificationPrompt()
useNotificationLive()
usePwaInstallPrompt()
const { mobileCreateChooserOpen, openMobileCreateChooser } = useMobileCreateChooser()
const { t, setLang, currentLang, languages } = useI18n()
// Apply current language on app start (sets html lang/dir attributes).
setLang(currentLang.value)

/* PWA bootstrap : capture beforeinstallprompt + theme-color dynamique. */
initPwaContext()
initPwaTheme()

/*
 * Saut du splash quand on arrive depuis un `<a href>` interne marqué (ex.
 * chooser mobile → /create). Donne une impression de continuité au lieu
 * du gros écran de boot rose au milieu de l'action utilisateur.
 */
const SKIP_SPLASH_FLAG = 'pinova-skip-splash'
let skipSplashOnBoot = false
try {
  if (typeof sessionStorage !== 'undefined' && sessionStorage.getItem(SKIP_SPLASH_FLAG)) {
    skipSplashOnBoot = true
    sessionStorage.removeItem(SKIP_SPLASH_FLAG)
  }
} catch {
  /* ignore */
}

/* Splash : caché dès que la première fetch user est résolue (ou 700ms max),
   ou immédiatement si on arrive depuis un lien marqué `skip-splash`. */
const appReady = ref(skipSplashOnBoot)
/* Immersive media viewer singleton — ouvert via `openImmersiveViewer({...})` partout. */
const immersiveViewer = useImmersiveViewer()

// Google One Tap Sign-in
// Désactivé à la demande de l'utilisateur
/*
watch(isAuthenticated, (newValue) => {
  if (newValue) {
    // Si l'utilisateur vient de se connecter, on s'assure que One Tap ne s'affiche plus
  }
}, { immediate: true })

useOneTap({
  onSuccess: async (response) => {
    if (isAuthenticated.value) return
    
    console.log('✅ Google One Tap success:', response)
    if (response.credential) {
      const result = await socialLogin('google', response.credential)
      if (result.success) {
        console.log('🎉 Successfully logged in via One Tap!')
      }
    }
  },
  onError: (error) => {
    // Ne pas afficher d'erreur si l'utilisateur a simplement fermé la suggestion
    if (!isAuthenticated.value && error?.type !== 'skipped' && error?.type !== 'dismissed') {
      console.error('❌ Google One Tap error:', error)
    }
  },
  disable_auto_select: false, // Suggest automatically
  auto_select: true, // Auto select if only one account
})
*/

router.afterEach((_to, from) => {
  if (from.matched.length) edgePeekSourcePath.value = from.path
})

const edgePeekLabel = computed(() => {
  const p = edgePeekSourcePath.value
  if (!p || p === '/') return t('nav.home')
  if (p.startsWith('/profile')) return t('nav.profile')
  return t('nav.home')
})

const isAuthPage = computed(
  () => route.meta.guest === true || route.meta.mobileOAuthBridge === true,
)

/** Plein écran sans header global, barre mobile ni footer (onboarding, etc.). */
const hideAppChrome = computed(
  () => (route.meta as { hideAppChrome?: boolean }).hideAppChrome === true,
)

const suppressAppChrome = computed(() => isAuthPage.value || hideAppChrome.value)

const appShellEdgeBackEnabled = () =>
  isLgDown.value &&
  /*
   * Chrome Android : zone de bord élargie + `preventScroll` peut classer un geste
   * vertical comme horizontal → scroll principal bloqué. Le retour natif OS suffit.
   */
  adaptiveProfile.value.motionLanguage !== 'material' &&
  !suppressAppChrome.value &&
  !layerManager.hasLayers.value &&
  !isMobileFullscreenRoute.value &&
  route.meta.disableEdgeBack !== true

const appEdgeSwipe = useEdgeSwipeBack(appShellRef, {
  enabled: appShellEdgeBackEnabled,
  canAcceptPointerDown: (e) => {
    const el = e.target as HTMLElement | null
    if (!el) return true
    return !el.closest('[data-pinova-no-edge-back]')
  },
  onDismiss: () => {
    nativeStackPop()
    void nextTick(() => {
      appEdgeSwipe.cancel()
    })
  },
})

const edgePeekScale = ref(1)
watch(
  () => appEdgeSwipe.translateX.value,
  (x) => {
    const w = appShellRef.value?.clientWidth ?? (typeof window !== 'undefined' ? window.innerWidth : 390)
    const r = Math.min(1, Math.max(0, x / Math.max(1, w)))
    edgePeekScale.value = 0.97 + r * 0.03
  },
)

/** Aperçu « page derrière » : visible seulement pendant le swipe (sinon #app-shell transparent laissait voir ce calque → texte Accueil partout). */
const edgePeekVisible = computed(
  () => appEdgeSwipe.isDragging.value || appEdgeSwipe.translateX.value > 6,
)

onMounted(async () => {
  resetPinovaBodyScrollLock()
  devLog('🚀 App mounted, initializing...')
  /* Fail-safe : on relâche le splash après 1.2s même si fetch n'a pas répondu. */
  const splashFallback = setTimeout(() => { appReady.value = true }, 1200)
  try {
    await fetchCurrentUser()
    const preferred = currentUser.value?.preferredLanguage
    if (preferred && languages.some((lang) => lang.code === preferred)) {
      setLang(preferred as typeof languages[number]['code'])
    }
    devLog('✅ Initialization complete.')
  } catch (err) {
    console.error('❌ Initialization error:', err)
  } finally {
    clearTimeout(splashFallback)
    appReady.value = true
  }
})

const isMobileFullscreenRoute = computed(() => typeof route.query.pin === 'string' && route.query.pin.trim().length > 0)

/** Routes `meta.presentation === 'fullscreen'` : pas de padding chrome du `<main>`. */
const isFullscreenPresentationRoute = computed(
  () => (route.meta as { presentation?: string }).presentation === 'fullscreen',
)

/** Routes immersives hors query `?pin=` : pas de padding chrome du `<main>` (safe + header fantôme). */
const suppressMobileMainChromeInsets = computed(() => {
  if (isMobileFullscreenRoute.value || isFullscreenPresentationRoute.value || hideAppChrome.value) {
    return true
  }
  const meta = route.meta as { suppressMainBottomInset?: boolean }
  return meta.suppressMainBottomInset === true
})

/** PWA mobile : remplir la coque sans min-height 100svh empilés (vide scrollable en bas). */
const isImmersiveMobileRoute = computed(
  () => isLgDown.value && suppressMobileMainChromeInsets.value,
)

/** Padding bas #main-content : réserve la tab bar fixe quand elle est visible. */
const mainMobileBottomPadClass = computed(() => {
  if (suppressAppChrome.value || suppressMobileMainChromeInsets.value) return ''
  if (suppressMobileChromeForProfileDrawer.value) return ''
  if (showMobileTabBar.value) {
    return 'max-lg:pb-[calc(var(--pinova-mobile-tab-bar-h,5rem)+env(safe-area-inset-bottom,0px))] lg:pb-0'
  }
  return 'max-lg:pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] lg:pb-0'
})

/*
 * UX mobile « app native » : le header global ne s'affiche que sur la home (/),
 * les autres écrans présentent une barre fixe (retour + titre + profil).
 * (style iOS/Android natif). Sur desktop (≥ lg), le header global reste partout.
 */
const isHomeRoute = computed(() => route.name === 'home' || route.path === '/')

/** Barre titre mobile + FAB créer masqués quand le menu latéral profil est ouvert. */
const suppressMobileChromeForProfileDrawer = computed(
  () => profileNavMobileDrawerOpen.value && route.name === 'profile',
)

const pullRefreshBlockedRoute = computed(() => {
  const meta = route.meta as { disablePullToRefresh?: boolean }
  return meta.disablePullToRefresh === true
})

/** Tirer depuis le haut du fil (≤ lg), y compris invité ou déconnecté. */
const pullToRefreshEnabled = computed(
  () =>
    isLgDown.value &&
    !isMobileFullscreenRoute.value &&
    !suppressMobileChromeForProfileDrawer.value &&
    !layerManager.hasLayers.value &&
    !immersiveViewer.open.value &&
    !pullRefreshBlockedRoute.value,
)

const { pullDistance: pullToRefreshPx, progress: pullToRefreshProgress } = useMobilePullToRefresh({
  scrollRootRef: mainContentRef,
  enabled: pullToRefreshEnabled,
  onRefresh: () => reloadPwaApplication(),
})

const pullRefreshIndicatorOpacity = computed(() =>
  Math.min(1, Math.max(0, pullToRefreshPx.value / 42)),
)

/** Tab bar basse mobile (home / explore / profil ou login/register invité). */
const showMobileTabBar = computed(
  () =>
    isLgDown.value &&
    !suppressAppChrome.value &&
    !isMobileFullscreenRoute.value &&
    !isFullscreenPresentationRoute.value &&
    !suppressMobileChromeForProfileDrawer.value &&
    !layerManager.hasLayers.value &&
    !immersiveViewer.open.value &&
    ['home', 'explore', 'explore-boards', 'profile', 'login', 'register'].includes(String(route.name || '')),
)

/** FAB création mobile : masqué quand la tab bar est visible (bouton création intégré). */
const showMobileCreateFab = computed(
  () =>
    isAuthenticated.value &&
    !showMobileTabBar.value &&
    !suppressAppChrome.value &&
    !isMobileFullscreenRoute.value &&
    !isFullscreenPresentationRoute.value &&
    !suppressMobileChromeForProfileDrawer.value &&
    (route.name === 'home' || route.name === 'profile'),
)

/** True quand la marge haute mobile doit compenser la barre (retour / recherche). */
const showMobileBackButton = computed(() => {
  if (suppressAppChrome.value) return false
  if (isMobileFullscreenRoute.value) return false
  if (isHomeRoute.value) return false
  return true
})

const hideAppMobileSubheader = computed(
  () => (route.meta as { hideAppMobileSubheader?: boolean }).hideAppMobileSubheader === true,
)

/** Barre page mobile (retour + titre + actions) — absente sur la home, routes custom, ou menu profil ouvert. */
const showAppMobileSubheader = computed(
  () =>
    showMobileBackButton.value &&
    !hideAppMobileSubheader.value &&
    !suppressMobileChromeForProfileDrawer.value,
)

/** Dès qu’on scroll (quelques px), accent visuel sur la barre titre mobile (ombre). */
const SCROLL_BLUR_THRESHOLD = 4

const mobilePageHeaderScrolled = ref(false)

function updateMobileHeaderScroll() {
  if (typeof document === 'undefined') return
  const y = getAppScrollRoot().scrollTop
  const past = y >= SCROLL_BLUR_THRESHOLD

  if (showAppMobileSubheader.value) {
    mobilePageHeaderScrolled.value = past
  } else {
    mobilePageHeaderScrolled.value = false
  }
}

watch(showAppMobileSubheader, () => {
  void nextTick(() => updateMobileHeaderScroll())
})

let detachAppScrollListener: (() => void) | null = null

function attachAppScrollListener() {
  detachAppScrollListener?.()
  detachAppScrollListener = null
  if (typeof document === 'undefined') return
  const target = getAppScrollRoot()
  /*
   * rAF-batched : on coalesce les événements scroll (60+ par seconde sur des
   * appareils rapides) en un seul update par frame. Les bindings réactifs
   * Vue (header tone, FAB, edge peek) ne sont re-évalués qu'une fois par
   * frame au lieu de potentiellement plusieurs dizaines.
   */
  let rafScheduled = false
  const onScroll = () => {
    if (rafScheduled) return
    rafScheduled = true
    requestAnimationFrame(() => {
      rafScheduled = false
      updateMobileHeaderScroll()
    })
  }
  target.addEventListener('scroll', onScroll, { passive: true })
  detachAppScrollListener = () => {
    target.removeEventListener('scroll', onScroll)
    detachAppScrollListener = null
  }
  updateMobileHeaderScroll()
}

watch(isLgDown, () => {
  void nextTick(() => attachAppScrollListener())
})

onMounted(() => {
  void nextTick(() => attachAppScrollListener())
})
onUnmounted(() => {
  detachAppScrollListener?.()
})

watch(
  () => route.path,
  () => {
    void nextTick(() => {
      attachAppScrollListener()
    })
    /*
     * Quand on arrive sur une route « page » classique (pas un layer
     * `fullscreen`/`modal`), on ferme toute couche orpheline qui aurait
     * survécu à la navigation (cas typique : layer ouvert → router.push
     * vers `/` sans passer par le bridge). Sans ça, le layer persistait
     * visuellement + son scroll-lock body bloquait toute la nouvelle page.
     */
    const meta = (route.meta as { presentation?: string }) || {}
    const targetIsLayer = meta.presentation === 'fullscreen' || meta.presentation === 'modal' || meta.presentation === 'sheet'
    if (!targetIsLayer && layerManager.hasLayers.value) {
      layerManager.popAll()
    }
    /*
     * Garde-fou : si aucun layer n'est ouvert mais que le verrou body est
     * resté actif (modal qui ne s'est pas démontée proprement, race au
     * démontage, etc.), on relâche. Sans ça, le scroll restait bloqué après
     * navigation depuis certaines vues qui ouvrent des modals.
     */
    if (typeof document !== 'undefined' && !layerManager.hasLayers.value) {
      document.documentElement.classList.remove('pinova-layer-scroll-lock')
      document.body.classList.remove('pinova-modal-scroll-lock')
      resetPinovaBodyScrollLock()
    }
  },
)

/** Marge haute du `<main>` : barre chrome fixe (GlobalHeader et/ou barre page mobile). */
const needsMainChromeTopPad = computed(
  () => !suppressAppChrome.value && !suppressMobileMainChromeInsets.value,
)

const appMobilePageTitle = computed(() => {
  const override = mobileHeaderTitleOverride.value?.trim()
  if (override) return override
  const n = route.name
  if (typeof n !== 'string') return ''
  if (n === 'explore') return t('nav.explore')
  if (n === 'explore-boards') return t('explore.allBoards')
  if (n === 'following') return t('nav.following')
  if (n === 'board') return t('nav.board')
  if (n === 'profile') {
    const u = route.params.username
    return typeof u === 'string' && u.trim() ? `@${u}` : t('nav.profile')
  }
  if (n === 'settings') return t('nav.settings')
  if (n === 'settings-section') {
    const sid = String(route.params.sectionId || '')
    if (sid && isValidSettingsSectionId(sid)) return t(settingsDetailTitleKey(sid))
    return t('nav.settings')
  }
  if (n === 'billing') return t('nav.billing')
  if (n === 'premium') return t('nav.premium')
  if (n === 'faq') return t('nav.faq')
  if (n === 'contact') return t('app.footer.contact')
  if (n === 'legal') {
    const slug = String(route.params.slug || '')
    if (slug === 'privacy') return t('app.footer.privacy')
    if (slug === 'contact') return t('app.footer.contact')
    return t('app.footer.terms')
  }
  if (n === 'creator') return t('nav.creator')
  if (n === 'contest-live') return t('nav.contest')
  if (n === 'contest-history') return t('contest.history.title')
  if (n === 'contest-notifications') return t('header.notifications')
  if (n === 'referral-contest-live' || n === 'referral-invite' || n === 'referral-history' || n === 'referral-notifications') {
    return t('nav.referral')
  }
  if (n === 'notifications') return t('header.notifications')
  if (n === 'not-found') return t('notFound.title')
  return ''
})

function goBack() {
  // Si on a un historique applicatif, on revient en arrière ; sinon on retourne à la home.
  const historyLen = typeof window !== 'undefined' ? window.history.length : 0
  if (historyLen > 1) {
    router.back()
  } else {
    router.push('/')
  }
}

const canCreateStory = computed(() => {
  const p = currentUser.value?.subscription?.plan
  return p === 'plus' || p === 'pro'
})

/** Transitions router-view : forward/back (pile) + variante adaptative (iOS / Material / desktop). */
const pageTransitionName = computed(() => {
  const meta = route.meta as { noTransition?: boolean }
  if (meta.noTransition) return 'page-none'
  if (pageNavIsInitial.value) return 'page-initial'
  return getPageTransitionNames(pageNavDirection.value).enter
})

/*
 * Status bar dynamique : `initPwaTheme()` synchronise déjà `<meta name="theme-color">`
 * avec le mode dark/light via observer sur `document.documentElement.classList`.
 * Le layerManager applique des couleurs spécifiques (cf. syncStatusBar) quand une
 * couche est ouverte. Ici on n'a plus rien à faire — le système est self-driving.
 *
 * Transitions de page : `routerViewTransition` + `getPageTransitionNames` ; les
 * couches (LayerHost), pin détail, visionneuse immersive gardent leurs anims dédiées.
 */
</script>

<template>
  <!--
    `#app-shell` reçoit l'effet de profondeur (scale + blur léger) appliqué
    par `LayerHost` lorsqu'une couche page/fullscreen est ouverte au-dessus.
    Ne pas changer l'id : `LayerHost` cible cet élément exactement.
  -->
  <!--
    Skip-link a11y : permet aux utilisateurs clavier/lecteur d'écran de
    sauter directement au contenu principal (premier focus dans l'app).
    Visible uniquement lors d'un focus clavier (cf. .pinova-skip-link).
  -->
  <a href="#main-content" class="pinova-skip-link">
    {{ t('a11y.skipToContent') || 'Aller au contenu' }}
  </a>

  <!-- Mobile : hauteur viewport pilotée par `style.css` (.pinova-chrome-stack) pour le scroll interne #main-content. -->
  <div
    class="pinova-chrome-stack relative flex w-full flex-col min-h-screen max-lg:overflow-hidden"
  >
    <div
      class="pinova-edge-peek pointer-events-none absolute inset-0 z-0 flex flex-col overflow-hidden bg-neutral-100 dark:bg-[#050506] transition-opacity duration-100"
      :class="edgePeekVisible ? 'opacity-100' : 'opacity-0'"
      aria-hidden="true"
    >
      <div
        class="flex h-full w-full flex-col px-6 pt-[calc(5.5rem+env(safe-area-inset-top,0px)+var(--pinova-pwa-extra-top-inset,0px))] transition-transform duration-75 will-change-transform"
        :style="{ transform: `scale(${edgePeekScale})`, transformOrigin: 'left center' }"
      >
        <p class="text-[11px] font-extrabold uppercase tracking-[0.2em] text-neutral-400 dark:text-neutral-500">
          {{ edgePeekLabel }}
        </p>
      </div>
    </div>

    <!--
      Hors de #app-shell : évite que translate3d (edge-back, modale) ne casse
      position:fixed du header — barre toujours ancrée au viewport (web + mobile).
    -->
    <GlobalHeader
      v-if="!suppressAppChrome"
      class="app-global-header"
      :class="isHomeRoute ? '' : 'max-lg:hidden'"
    />

  <div
    id="app-shell"
    ref="appShellRef"
    class="relative z-10 flex min-h-screen flex-1 flex-col bg-transparent text-neutral-900 dark:text-neutral-100 transition-colors duration-200 pinova-app-shell max-lg:min-h-0 max-lg:overflow-hidden"
    :class="{
      'app-mobile-fullscreen-route': isMobileFullscreenRoute,
      'app-hide-chrome-route': hideAppChrome,
      'app-immersive-route': isImmersiveMobileRoute,
    }"
  >
    <!-- Wash rose ambient (fixed, behind content). Désactivé sur routes fullscreen media. -->
    <AmbientGlow :disabled="isMobileFullscreenRoute" />

    <ReferralRouteCapture />

    <main
      id="main-content"
      ref="mainContentRef"
      tabindex="-1"
      class="flex min-h-0 flex-1 flex-col max-lg:overscroll-y-contain max-lg:[-webkit-overflow-scrolling:touch]"
      :class="[
        isImmersiveMobileRoute
          ? 'max-lg:overflow-hidden'
          : 'max-lg:overflow-y-auto',
        !suppressAppChrome && !suppressMobileMainChromeInsets
          ? mainMobileBottomPadClass
          : '',
        needsMainChromeTopPad && !suppressMobileChromeForProfileDrawer
          ? 'pt-[var(--pinova-global-header-h,calc(3.5rem+env(safe-area-inset-top,0px)+var(--pinova-pwa-extra-top-inset,0px)))]'
          : '',
      ]"
    >
      <div class="pinova-page-transition-host relative flex min-h-0 flex-1 flex-col w-full">
      <!--
        Transitions : pile session (routerViewTransition) → forward / back.
        Clé `r.path` (pas fullPath) : éviter remount feed quand seule la query ?pin change.
      -->
      <router-view v-slot="{ Component, route: r }">
        <transition :name="pageTransitionName" appear>
          <KeepAlive v-if="r.meta.keepAlive">
            <component
              :is="Component"
              :key="r.path"
            />
          </KeepAlive>
          <component
            v-else
            :is="Component"
            :key="r.path"
          />
        </transition>
      </router-view>
      </div>
    </main>

    <MobileCreateChooser
      v-if="isAuthenticated"
      v-model="mobileCreateChooserOpen"
      :can-create-story="canCreateStory"
    />

    <AppAlertModal />

    <!-- Footer (masqué en coquille app &lt; lg : navigation par barre du bas) -->
    <footer v-if="!(route.meta as any).guest" class="app-global-footer max-lg:hidden border-t border-neutral-200/85 dark:border-neutral-800/90 bg-white/92 dark:bg-neutral-950/90 backdrop-blur-md backdrop-saturate-150 py-6 px-6 sm:px-10 transition-colors">
      <div class="max-w-7xl mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <div class="flex items-center gap-2">
          <div class="w-6 h-6 rounded-full bg-pink-700 dark:bg-pink-600 flex items-center justify-center overflow-hidden shadow-sm shadow-pink-900/15 dark:shadow-black/35 ring-1 ring-black/[0.06] dark:ring-white/12">
            <img
              src="./assets/logo.png"
              alt="Logo"
              class="w-full h-full object-cover contrast-[1.02] dark:brightness-110 dark:contrast-[1.04] dark:saturate-[1.06]"
            />
          </div>
          <span class="text-sm font-semibold text-neutral-700 dark:text-neutral-200">Pinova</span>
        </div>

        <nav class="flex flex-wrap items-center justify-center gap-x-5 gap-y-2 text-xs text-neutral-500 dark:text-neutral-400">
          <router-link v-if="isAuthenticated" to="/" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('nav.home') }}</router-link>
          <router-link v-if="!isAuthenticated" to="/explore" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('nav.explore') }}</router-link>
          <router-link v-if="isAuthenticated" to="/profile" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('nav.profile') }}</router-link>
          <router-link v-if="isAuthenticated" to="/settings" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('nav.settings') }}</router-link>
          <router-link to="/faq" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('nav.faq') }}</router-link>
          <router-link to="/legal/privacy" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('app.footer.privacy') }}</router-link>
          <router-link to="/legal/terms" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('app.footer.terms') }}</router-link>
          <router-link to="/contact" class="hover:text-neutral-700 dark:hover:text-neutral-200 transition">{{ t('app.footer.contact') }}</router-link>
        </nav>

        <p class="text-xs text-neutral-400 dark:text-neutral-500 text-center sm:text-right">
          {{ t('app.copyright') }}
        </p>
      </div>
    </footer>
  </div>
  </div>

  <!--
    Hôte unique du Layer Navigation System.
    Monté UNE SEULE FOIS hors de #app-shell : il reste fixe pendant que le
    contexte derrière subit le scale/blur de profondeur.
  -->
  <LayerHost />

  <!--
    Menu contextuel singleton (long-press iOS).
    Ouvert via `openPinContextualMenu()` depuis n'importe où.
  -->
  <PinContextualMenu />

  <!-- PWA premium experience : splash boot + bannière offline. -->
  <PwaSplash :open="!appReady" />
  <OfflineExperience />
  <PwaInstallExperience />
  <NativeAppSuggestBanner :app-ready="appReady" />

  <!-- Visionneuse média immersive singleton (image/vidéo fullscreen iOS). -->
  <ImmersiveMediaViewer
    v-model:open="immersiveViewer.open.value"
    :items="immersiveViewer.items.value"
    :initial-index="immersiveViewer.initialIndex.value"
    :title="immersiveViewer.title.value"
    :zoom-enabled="immersiveViewer.zoomEnabled.value"
    :swipe-enabled="immersiveViewer.swipeEnabled.value"
    :on-like="immersiveViewer.onLike"
    @change-index="immersiveViewer.onChangeIndex"
    @update:open="(v: boolean) => { if (!v) immersiveViewer.onCloseInternal() }"
  />

  <!-- Toast singleton (queue gérée par useToast.ts). -->
  <AppToast />
  <CookieConsentBanner />

  <NotificationEnablePrompt
    v-if="isAuthenticated"
    v-model:open="notificationPromptOpen"
    @snooze="notificationPromptSnooze"
    @decline="notificationPromptDecline"
  />

  <GuestAuthSheet
    :open="guestGateOpen"
    :intent="guestGateIntent"
    @close="closeGuestGate"
  />

  <AppMobileTabBar v-if="showMobileTabBar" />

  <!-- FAB création (mobile / tablette) — hors #app-shell. -->
  <Teleport to="body">
    <button
      v-if="showMobileCreateFab"
      type="button"
      class="pinova-mobile-create-fab lg:hidden fixed z-[60] flex h-14 w-14 items-center justify-center rounded-full bg-pink-700 dark:bg-pink-600 text-white shadow-lg shadow-pink-700/35 transition hover:bg-pink-800 dark:hover:opacity-90 active:scale-95 focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-950"
      :style="{
        bottom: 'calc(1rem + env(safe-area-inset-bottom, 0px))',
        right: 'calc(1rem + env(safe-area-inset-right, 0px))',
      }"
      :aria-label="t('nav.create')"
      @click="openMobileCreateChooser()"
    >
      <span class="material-symbols-outlined text-[30px] leading-none">add</span>
    </button>
  </Teleport>

  <Teleport to="body">
    <AppMobilePageHeader
      v-if="showAppMobileSubheader"
      :title="appMobilePageTitle"
      :subtitle="mobileHeaderSubtitle || ''"
      :elevated="mobilePageHeaderScrolled"
      @back="goBack"
    >
      <template #trailing>
        <button
          v-if="mobileBoardMoreTrailing"
          ref="mobileBoardMoreButtonRef"
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/70 bg-white/90 text-neutral-800 shadow-sm backdrop-blur-sm dark:border-neutral-600/70 dark:bg-neutral-900/85 dark:text-neutral-100"
          :aria-label="mobileBoardMoreTrailing.ariaLabel"
          @click="mobileBoardMoreTrailing.onClick()"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">more_vert</span>
        </button>
        <button
          v-else-if="mobileMarkAllReadTrailing"
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/70 bg-white/90 text-neutral-800 shadow-sm backdrop-blur-sm dark:border-neutral-600/70 dark:bg-neutral-900/85 dark:text-neutral-100"
          :aria-label="mobileMarkAllReadTrailing.ariaLabel"
          @click="mobileMarkAllReadTrailing.onClick()"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">done_all</span>
        </button>
        <button
          v-else-if="mobileProfileTrailing"
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full border border-neutral-200/70 bg-white/90 text-neutral-800 shadow-sm backdrop-blur-sm dark:border-neutral-600/70 dark:bg-neutral-900/85 dark:text-neutral-100"
          :aria-label="mobileProfileTrailing.ariaLabel"
          @click="mobileProfileTrailing.onClick()"
        >
          <span class="material-symbols-outlined text-[22px] leading-none">{{ mobileProfileTrailing.icon }}</span>
        </button>
      </template>
    </AppMobilePageHeader>
  </Teleport>

  <!-- Tirer pour actualiser (mobile lg-) — invité inclus ; évite métier sur écrans d’édition. -->
  <Teleport to="body">
    <div
      v-if="isLgDown && pullToRefreshPx > 3"
      class="pointer-events-none fixed inset-x-0 z-[88] flex flex-col items-center gap-1 px-4"
      :style="{ top: 'calc(env(safe-area-inset-top, 0px) + 8px)' }"
      aria-hidden="true"
    >
      <div
        class="flex h-10 w-10 items-center justify-center rounded-full border border-neutral-200/70 bg-white/95 shadow-md backdrop-blur-md dark:border-neutral-700/65 dark:bg-neutral-950/94 pinova-ptr-bubble"
        :style="{ opacity: pullRefreshIndicatorOpacity }"
      >
        <span
          class="material-symbols-outlined text-[25px] text-pink-600 dark:text-pink-400"
          :style="{ transform: `rotate(${pullToRefreshPx * 3.2}deg)` }"
          >refresh</span
        >
      </div>
      <span
        v-if="pullToRefreshProgress >= 0.94"
        class="max-w-[min(100vw-2rem,20rem)] rounded-full bg-neutral-900/85 px-3 py-1.5 text-center text-[11px] font-semibold text-white backdrop-blur-sm dark:bg-white/90 dark:text-neutral-950"
      >
        {{ t('pwa.pullToRefresh.release') }}
      </span>
    </div>
  </Teleport>
</template>

<style>
@media (max-width: 1023px) {
  .app-mobile-fullscreen-route .app-global-header,
  .app-mobile-fullscreen-route .app-global-footer,
  .app-hide-chrome-route .app-global-header,
  .app-hide-chrome-route .app-global-footer {
    display: none !important;
  }

  .app-mobile-fullscreen-route {
    background: #000;
  }

  /* Onboarding, création, concours dock : pas de min-height 100svh empilé → vide PWA en bas. */
  .app-immersive-route .pinova-page-transition-host {
    min-height: 0;
    flex: 1 1 auto;
    height: auto;
  }
}

/*
  App shell : préparé pour l'effet de profondeur appliqué par LayerHost.
  Le transform/filter est posé via JS quand une couche est au-dessus.
*/
.pinova-app-shell {
  will-change: auto;
  /* Évite les jaggies pendant le scale. */
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Pas de contain:layout ici : sur mobile WebKit ça pouvait empêcher le scroll
     document alors que le contenu (ex. home) dépasse le viewport. */
}

@media (prefers-reduced-motion: reduce) {
  .pinova-ptr-bubble span.material-symbols-outlined[style] {
    transform: none !important;
  }
}
</style>
