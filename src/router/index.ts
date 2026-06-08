import { createRouter, createWebHistory } from 'vue-router'

import { useAuth } from '../composables/useAuth'
import { userNeedsOnboarding } from '../utils/onboarding'
import { devLog } from '../lib/devLog'
import { maybeRedirectWebToApp } from '../utils/appDeepLink'
import { isValidSettingsSectionId } from '../data/settingsHubConfig'
import { ensureFontAwesomeLoaded } from '../utils/loadFontAwesome'
import { markSkipSplash, shouldSkipSplashForPath } from '../utils/skipSplash'

/*
 * Routes & meta layer system (iOS-first immersif).
 *
 * `meta.presentation` :
 *   - 'page'       → page classique pleine fenêtre (router-view)
 *   - 'fullscreen' → fullscreen modal au-dessus du contexte (PinDetail, Story)
 *   - 'modal'      → modale centrée
 *   - 'sheet'      → bottom sheet
 *   - 'floatingCard' / 'transparentOverlay'
 *
 * `meta.gestureDismiss`     : swipe plein écran (`true`), désactivé (`false`), ou depuis la barre `data-pinova-swipe-dismiss-handle` (`'header'`).
 * `meta.preserveBackground` : conserve le contexte de fond vivant.
 * `meta.statusBar`          : 'light' | 'dark' | 'auto' — couleur status bar.
 * `meta.disableEdgeBack`    : désactive le geste edge-back iOS pour cette route.
 * `meta.keyboardFeedNav`    : J/K pour faire défiler le feed (cf. inputAbstraction).
 * En navigation interne, le `routerLayerBridge` pousse la route comme couche
 * au-dessus du contexte précédent. En accès direct (URL tapée / refresh /
 * lien externe), la route est rendue en page standalone classique.
 */

const router = createRouter({
  history: createWebHistory(),
  scrollBehavior() {
    return { top: 0 }
  },
  routes: [
    {
      path: '/',
      name: 'home',
      component: () => import('../pages/HomePage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        statusBar: 'auto',
        keyboardFeedNav: true,
      },
    },
    {
      path: '/explore',
      name: 'explore',
      component: () => import('../pages/ExplorePage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        statusBar: 'auto',
        keyboardFeedNav: true,
      },
    },
    {
      path: '/explore/boards',
      name: 'explore-boards',
      component: () => import('../pages/ExploreBoardsPage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        statusBar: 'auto',
        keyboardFeedNav: true,
      },
    },
    {
      path: '/stories',
      redirect: '/',
    },
    {
      path: '/following',
      name: 'following',
      component: () => import('../pages/FollowingPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        presentation: 'page',
        statusBar: 'auto',
        keyboardFeedNav: true,
      },
    },
    {
      path: '/pin/:slug/edit',
      name: 'edit-pin',
      component: () => import('../pages/CreatePinPage.vue'),
      meta: {
        requiresAuth: true,
        presentation: 'fullscreen',
        gestureDismiss: 'header',
        preserveBackground: true,
        statusBar: 'auto',
        disableEdgeBack: true,
        hideAppMobileSubheader: true,
        suppressMainBottomInset: true,
        preloadNsfwScanner: true,
      },
    },
    {
      path: '/pin/:slug',
      name: 'pin-detail',
      redirect: (to, from) => {
        const slug = String(to.params.slug || '')
        const fromName = from?.name
        const keepContext =
          fromName &&
          ['home', 'profile', 'explore', 'explore-boards', 'following', 'board', 'notifications'].includes(
            String(fromName),
          )
        return {
          path: keepContext ? from.path : '/',
          query: {
            ...(keepContext ? from.query : to.query),
            pin: slug,
          },
        }
      },
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        /* La fiche pin s'ouvre déjà comme couche via PinDetailOverlayHost (?pin=). */
        presentation: 'fullscreen',
        gestureDismiss: true,
        preserveBackground: true,
        statusBar: 'light',
      },
    },
    {
      path: '/create',
      name: 'create',
      component: () => import('../pages/CreatePinPage.vue'),
      meta: {
        requiresAuth: true,
        presentation: 'fullscreen',
        gestureDismiss: 'header',
        preserveBackground: true,
        statusBar: 'auto',
        disableEdgeBack: true,
        hideAppMobileSubheader: true,
        suppressMainBottomInset: true,
        /* Pas d'anim de transition : navigation depuis le chooser mobile via
           `<a href>` doit donner une impression de continuité. */
        noTransition: true,
        preloadNsfwScanner: true,
      },
    },
    {
      path: '/story/create',
      name: 'create-standalone-story',
      component: () => import('../pages/CreateStandaloneStoryPage.vue'),
      meta: {
        requiresAuth: true,
        presentation: 'fullscreen',
        gestureDismiss: 'header',
        preserveBackground: true,
        statusBar: 'light',
        disableEdgeBack: true,
        hideAppMobileSubheader: true,
        suppressMainBottomInset: true,
        noTransition: true,
        preloadNsfwScanner: true,
      },
    },
    {
      path: '/profile/:username/board/:boardId',
      name: 'board',
      component: () => import('../pages/BoardPage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/profile/:username?',
      name: 'profile',
      component: () => import('../pages/ProfilePage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/onboarding',
      name: 'onboarding',
      component: () => import('../pages/OnboardingPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: false,
        presentation: 'fullscreen',
        hideAppChrome: true,
        hideAppMobileSubheader: true,
        disablePullToRefresh: true,
        gestureDismiss: false,
        statusBar: 'auto',
      },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../pages/SettingsHubPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: false,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
      beforeEnter(to) {
        const hashId = to.hash.replace(/^#/, '').trim()
        if (hashId && isValidSettingsSectionId(hashId)) {
          return { name: 'settings-section', params: { sectionId: hashId }, replace: true }
        }
        const raw = to.query.section
        const sectionRaw = typeof raw === 'string' ? raw : Array.isArray(raw) ? raw[0] : ''
        if (sectionRaw) {
          const normalized = sectionRaw.startsWith('settings-') ? sectionRaw : `settings-${sectionRaw}`
          if (isValidSettingsSectionId(normalized)) {
            return { name: 'settings-section', params: { sectionId: normalized }, replace: true }
          }
        }
        return true
      },
    },
    {
      path: '/settings/:sectionId',
      name: 'settings-section',
      component: () => import('../pages/SettingsPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: false,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/staff/partner-ads',
      name: 'staff-partner-ads',
      component: () => import('../pages/PartnerAdsManagePage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: false,
        presentation: 'page',
        statusBar: 'auto',
      },
    },
    {
      path: '/promote',
      name: 'boost-promote',
      component: () => import('../pages/BoostPromotePage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: false,
        presentation: 'page',
        statusBar: 'auto',
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/promote/pin/:pinSlug',
      redirect: (to) => ({
        name: 'boost-promote',
        query: { pin: String(to.params.pinSlug || '') },
      }),
    },
    {
      path: '/promote/campaigns',
      name: 'pin-promo-campaigns',
      redirect: () => ({ name: 'boost-promote', query: { tab: 'campaigns' } }),
    },
    {
      path: '/billing',
      name: 'billing',
      component: () => import('../pages/BillingHistoryPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/premium',
      name: 'premium',
      component: () => import('../pages/PremiumPage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/legal/:slug',
      name: 'legal',
      component: () => import('../pages/LegalPage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/contact',
      name: 'contact',
      component: () => import('../pages/ContactPage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/faq',
      name: 'faq',
      component: () => import('../pages/FaqPage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/creator',
      name: 'creator',
      component: () => import('../pages/CreatorDashboardPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: false,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        loadFontAwesome: true,
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/contest/live',
      name: 'contest-live',
      component: () => import('../pages/ContestLivePage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        loadFontAwesome: true,
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/contest/history',
      name: 'contest-history',
      component: () => import('../pages/ContestHistoryPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/referrals/contest',
      name: 'referral-contest-live',
      component: () => import('../pages/ReferralContestLivePage.vue'),
      meta: {
        requiresAuth: false,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        loadFontAwesome: true,
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/referrals/invite',
      name: 'referral-invite',
      component: () => import('../pages/ReferralInvitePage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        loadFontAwesome: true,
        suppressMainBottomInset: true,
      },
    },
    {
      path: '/referrals/history',
      name: 'referral-history',
      component: () => import('../pages/ReferralHistoryPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/referrals/notifications',
      name: 'referral-notifications',
      component: () => import('../pages/ReferralNotificationsPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
      meta: {
        guest: true,
        preferAppRedirect: true,
        presentation: 'page',
        statusBar: 'auto',
        gestureDismiss: true,
      },
    },
    {
      path: '/auth/mobile/google',
      name: 'mobile-google-auth',
      component: () => import('../pages/MobileGoogleAuth.vue'),
      meta: { presentation: 'page', statusBar: 'auto', mobileOAuthBridge: true },
    },
    {
      path: '/auth/mobile/google/callback',
      name: 'mobile-google-auth-callback',
      component: () => import('../pages/MobileGoogleAuth.vue'),
      meta: { presentation: 'page', statusBar: 'auto', mobileOAuthBridge: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../pages/RegisterPage.vue'),
      meta: {
        guest: true,
        preferAppRedirect: true,
        presentation: 'page',
        statusBar: 'auto',
      },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../pages/ForgotPasswordPage.vue'),
      meta: { guest: true, presentation: 'page', statusBar: 'auto', gestureDismiss: true },
    },
    {
      path: '/password-reset-confirm/:uid/:token',
      name: 'password-reset-confirm',
      component: () => import('../pages/ResetPasswordPage.vue'),
      meta: { guest: true, presentation: 'page', statusBar: 'auto', gestureDismiss: true },
    },
    {
      path: '/checkout/go',
      name: 'checkout-go',
      component: () => import('../pages/CheckoutGoPage.vue'),
      meta: { requiresAuth: true, presentation: 'page', statusBar: 'auto', hideAppChrome: true, suppressMainBottomInset: true },
    },
    {
      path: '/checkout/return',
      name: 'checkout-return',
      component: () => import('../pages/CheckoutReturnPage.vue'),
      meta: { requiresAuth: false, presentation: 'page', statusBar: 'auto', suppressMainBottomInset: true },
    },
    {
      path: '/verify-otp',
      name: 'verify-otp',
      component: () => import('../pages/VerifyOTPPage.vue'),
      meta: { guest: true, presentation: 'page', statusBar: 'auto', gestureDismiss: true },
    },
    {
      path: '/verify-email/:key',
      name: 'verify-email',
      component: () => import('../pages/VerifyEmailPage.vue'),
      meta: { guest: true, presentation: 'page', statusBar: 'auto' },
    },
    {
      path: '/notifications',
      name: 'notifications',
      component: () => import('../pages/NotificationsPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    {
      path: '/search',
      name: 'search',
      component: () => import('../pages/SearchPage.vue'),
      meta: {
        keepAlive: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
        /** Barre mobile dédiée (recherche) dans la page — pas la barre titre globale. */
        hideAppMobileSubheader: true,
      },
    },
    {
      path: '/contest/notifications',
      name: 'contest-notifications',
      component: () => import('../pages/WebToAppStubPage.vue'),
      meta: {
        requiresAuth: true,
        keepAlive: true,
        preferAppRedirect: true,
        presentation: 'page',
        gestureDismiss: true,
        statusBar: 'auto',
      },
    },
    ...(import.meta.env.DEV
      ? [
          {
            path: '/dev/design-system',
            name: 'dev-design-system',
            component: () => import('../pages/dev/DesignSystemPage.vue'),
            meta: { requiresAuth: false, presentation: 'page' as const, statusBar: 'auto' as const },
          },
        ]
      : []),
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
      meta: { presentation: 'page' as const, statusBar: 'auto' as const },
    },
  ],
})

// Navigation Guard
router.beforeEach(async (to, from) => {
  devLog(`🧭 Navigating from ${String(from.name)} to ${String(to.name)}`)
  if (shouldSkipSplashForPath(to.path)) {
    markSkipSplash()
  }
  const { isAuthenticated, fetchCurrentUser, currentUser } = useAuth()

  const hasStoredToken =
    typeof window !== 'undefined' && !!window.localStorage.getItem('pinova_token')

  // JWT stocké mais profil pas encore hydraté (ex. retour sur l’accueil après Google).
  if (!isAuthenticated.value && hasStoredToken) {
    await fetchCurrentUser({ silent: true }).catch(() => undefined)
  }

  const isMobileOAuthBridge = to.meta.mobileOAuthBridge === true

  // Si la route demande d'être authentifié et que l'utilisateur n'est pas connecté
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    console.warn('🔒 Route requires auth, redirecting to login...')
    return {
      name: 'login',
      query: { redirect: encodeURIComponent(to.fullPath) },
    }
  }

  /* Profil serveur à jour (ex. date de naissance) avant la création — sans écran de chargement global. */
  if ((to.name === 'create' || to.name === 'edit-pin') && isAuthenticated.value) {
    await fetchCurrentUser({ silent: true })
  }

  if (to.meta.loadFontAwesome) {
    await ensureFontAwesomeLoaded()
  }
  if (to.meta.preloadNsfwScanner) {
    void import('../composables/nsfwScanner').then((m) => m.preloadNsfwScanner())
  }
  
  // Login/register invités — sauf le pont OAuth mobile (session web ≠ compte app).
  if (to.meta.guest && isAuthenticated.value && !isMobileOAuthBridge) {
    if (userNeedsOnboarding(currentUser.value)) {
      return { name: 'onboarding' }
    }
    devLog('🚪 Already logged in, redirecting to home...')
    return { name: 'home' }
  }

  // Nouveau compte : onboarding obligatoire — sauf pont OAuth mobile.
  if (
    isAuthenticated.value &&
    userNeedsOnboarding(currentUser.value) &&
    to.name !== 'onboarding' &&
    !isMobileOAuthBridge
  ) {
    return { name: 'onboarding' }
  }

  if (to.name === 'onboarding' && isAuthenticated.value && !userNeedsOnboarding(currentUser.value)) {
    return { name: 'home' }
  }
})

router.afterEach((to) => {
  devLog(`✅ Navigated to ${String(to.name)}`)
  if (to.meta.mobileOAuthBridge === true) return
  const { isAuthenticated } = useAuth()
  maybeRedirectWebToApp(to, { isAuthenticated: isAuthenticated.value })
})

router.onError((error) => {
  console.error('❌ Router error:', error)
})

export default router
