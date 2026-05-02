import { createRouter, createWebHistory } from 'vue-router'

import { useAuth } from '../composables/useAuth'
import { devLog } from '../devLog'

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
      meta: { requiresAuth: false },
    },
    {
      path: '/explore',
      name: 'explore',
      component: () => import('../pages/ExplorePage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/stories',
      name: 'stories',
      component: () => import('../pages/StoriesPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/following',
      name: 'following',
      component: () => import('../pages/FollowingPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/pin/:slug',
      name: 'pin-detail',
      component: () => import('../pages/PinDetailPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/create',
      name: 'create',
      component: () => import('../pages/CreatePinPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/profile/:username/board/:boardId',
      name: 'board',
      component: () => import('../pages/BoardPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/profile/:username?',
      name: 'profile',
      component: () => import('../pages/ProfilePage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/settings',
      name: 'settings',
      component: () => import('../pages/SettingsPage.vue'),
      meta: { requiresAuth: true },
    },
    {
      path: '/premium',
      name: 'premium',
      component: () => import('../pages/PremiumPage.vue'),
      meta: { requiresAuth: false },
    },
    {
      path: '/login',
      name: 'login',
      component: () => import('../pages/LoginPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/auth/mobile/google',
      name: 'mobile-google-auth',
      component: () => import('../pages/MobileGoogleAuth.vue'),
      meta: { guest: true },
    },
    {
      path: '/register',
      name: 'register',
      component: () => import('../pages/RegisterPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/forgot-password',
      name: 'forgot-password',
      component: () => import('../pages/ForgotPasswordPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/password-reset-confirm/:uid/:token',
      name: 'password-reset-confirm',
      component: () => import('../pages/ResetPasswordPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/verify-otp',
      name: 'verify-otp',
      component: () => import('../pages/VerifyOTPPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/verify-email/:key',
      name: 'verify-email',
      component: () => import('../pages/VerifyEmailPage.vue'),
      meta: { guest: true },
    },
    {
      path: '/:pathMatch(.*)*',
      name: 'not-found',
      component: () => import('../pages/NotFoundPage.vue'),
    },
  ],
})

import { watch } from 'vue'

// Navigation Guard
router.beforeEach(async (to, from) => {
  devLog(`🧭 Navigating from ${String(from.name)} to ${String(to.name)}`)
  const { isAuthenticated, isInitializing } = useAuth()
  
  // Attendre l'initialisation de l'auth si elle est en cours
  if (isInitializing.value) {
    devLog('⏳ Auth is initializing, waiting...')
    // On attend que fetchCurrentUser soit terminé via une promesse sur watch
    await new Promise<void>((resolve) => {
      const unwatch = watch(isInitializing, (val) => {
        if (!val) {
          unwatch()
          resolve()
        }
      }, { immediate: true })
    })
  }

  // Si la route demande d'être authentifié et que l'utilisateur n'est pas connecté
  if (to.meta.requiresAuth && !isAuthenticated.value) {
    console.warn('🔒 Route requires auth, redirecting to login...')
    return { name: 'login' }
  }
  
  // Si l'utilisateur est déjà connecté et essaie d'aller sur login/register
  if (to.meta.guest && isAuthenticated.value) {
    devLog('🚪 Already logged in, redirecting to home...')
    return { name: 'home' }
  }
})

router.afterEach((to) => {
  devLog(`✅ Navigated to ${String(to.name)}`)
})

router.onError((error) => {
  console.error('❌ Router error:', error)
})

export default router
