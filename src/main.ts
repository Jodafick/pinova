import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'
import { initAppearance } from './composables/useAppearance'
import { initReducedMotionWatcher } from './composables/useReducedMotion'
import { vPress } from './directives/vPress'
import { vSpring } from './directives/vSpring'
import { bindNativeStack } from './navigation/nativeStack'
import { installRouterLayerBridge } from './navigation/routerLayerBridge'
import { installRouterViewTransition } from './navigation/routerViewTransition'
import { initMemoryManager } from './core/memoryManager'
import { initMotionBudget } from './core/motionBudget'
import { initLayerLifecycle } from './core/layerLifecycle'
import { initPerfMonitor } from './core/perfMonitor'
import { initPerformanceEngine } from './core/performanceEngine'
import { initUxOrchestrator } from './core/uxOrchestrator'
import { initAnalytics } from './lib/analytics'
import { applyStoredCookieConsent } from './lib/cookieConsent'
import { initAnalyticsBridge } from './lib/initAnalyticsBridge'
import { initSentry } from './lib/sentry'
import { initAdaptiveNavigator } from './navigation/adaptiveNavigator'
import { initPwaStandaloneTopInset } from './utils/pwaSafeTopInset'
import { initInputAbstraction } from './navigation/inputAbstraction'
import { initMediaEngine } from './media'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient, installQueryPersister } from './data'

initAppearance()
initReducedMotionWatcher()
initMemoryManager()
initMotionBudget()
initAdaptiveNavigator()
initPwaStandaloneTopInset()
initLayerLifecycle()
initPerfMonitor()
/* Performance engine — orchestre FPS / memory / quality auto-degrade. */
initPerformanceEngine()
/* Media engine — image cache + video pool + offline fallback. Lazy mais
   non-bloquant : on lance l'init et on n'attend pas la résolution. */
void initMediaEngine().catch((err) => console.warn('[Pinova] initMediaEngine', err))

registerSW({ immediate: true })
import GoogleSignInPlugin from 'vue3-google-signin'
import { useAuth } from './composables/useAuth'
import { proactiveRefreshIfStale } from './api/index'
import { GOOGLE_CLIENT_ID } from './config/env'

const app = createApp(App)

/* Directives globales : v-press (legacy) + v-spring (premium, intent-aware). */
app.directive('press', vPress)
app.directive('spring', vSpring)

app.use(GoogleSignInPlugin, {
  clientId: GOOGLE_CLIENT_ID,
})

/* Vue Query — singleton client + hydratation localStorage (offline-first).
   Doit être installé AVANT le mount (sinon les composants useQuery() ne
   trouvent pas le client lors de leur premier setup). */
app.use(VueQueryPlugin, { queryClient })
installQueryPersister()

// Monter l’app tout de suite : l’UI ne doit pas rester bloquée sur le splash si l’API est lente ou injoignable.
// Session : refresh proactif + profil en arrière-plan (App.vue relance aussi fetchCurrentUser au besoin).
const { fetchCurrentUser } = useAuth()
app.use(router)
installRouterViewTransition(router)
/* Brancher la pile native iOS-like + interception layers basée sur meta.presentation. */
bindNativeStack(router)
/*
 * Routes « workflow » plein écran : toujours rendues par `<router-view>`, jamais
 * interceptées en couche. Sur mobile réel, ouvrir /create ou /onboarding en layer
 * laissait blur + scroll-lock sur #app-shell (écran blanc/noir figé) — l’émulateur
 * desktop ne reproduisait pas toujours le bug ; un lien <a> natif fonctionnait car
 * cold-start = page réelle.
 */
installRouterLayerBridge(router, {
  alwaysPage: [
    'mobile-google-auth',
    'mobile-google-auth-callback',
    'create',
    'create-standalone-story',
    'edit-pin',
    'onboarding',
  ],
})
initInputAbstraction(router)
/* Transitions `<router-view>` : pile session + styles adaptatifs (cf. routerViewTransition + style.css). */
/* UX Orchestrator — couche d'harmonisation finale (event bus + watchers nav /
   layer / quality / memory / platform). À brancher en dernier : il observe
   les autres systèmes, il ne les pilote pas. */
initUxOrchestrator(router)
initSentry(app, router)
applyStoredCookieConsent()
initAnalytics({ platform: 'web' })
initAnalyticsBridge()
app.mount('#app')
void proactiveRefreshIfStale()
  .catch((err) => console.warn('[Pinova] proactiveRefreshIfStale', err))
  .then(() =>
    fetchCurrentUser().catch((err) => console.warn('[Pinova] fetchCurrentUser (bootstrap)', err)),
  )
