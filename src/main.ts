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
import { initAdaptiveNavigator } from './navigation/adaptiveNavigator'
import { initPwaStandaloneTopInset } from './utils/pwaSafeTopInset'
import { initInputAbstraction } from './navigation/inputAbstraction'
import { scheduleDeferredBoot } from './core/bootDeferred'
import { markBootPhase } from './core/bootMarks'
import PinovaIcon from './components/ui/PinovaIcon.vue'
import { ensureMaterialSymbolsLoaded } from './utils/loadMaterialSymbols'
import { VueQueryPlugin } from '@tanstack/vue-query'
import { queryClient, installQueryPersister } from './data'
import { applyStoredCookieConsent } from './lib/cookieConsent'
import GoogleSignInPlugin from 'vue3-google-signin'
import { proactiveRefreshIfStale } from './api/index'
import { GOOGLE_CLIENT_ID } from './config/env'

markBootPhase('boot_start')

/* ── Chemin critique first paint ── */
initAppearance()
initReducedMotionWatcher()
initMemoryManager()
initMotionBudget()
initAdaptiveNavigator()
initPwaStandaloneTopInset()
initLayerLifecycle()
void ensureMaterialSymbolsLoaded()
function registerServiceWorkerDeferred() {
  const run = () => registerSW({ immediate: true })
  if (typeof requestIdleCallback === 'function') {
    requestIdleCallback(run, { timeout: 5000 })
  } else {
    setTimeout(run, 2500)
  }
}
registerServiceWorkerDeferred()

const app = createApp(App)

app.component('PinovaIcon', PinovaIcon)

app.directive('press', vPress)
app.directive('spring', vSpring)

app.use(GoogleSignInPlugin, {
  clientId: GOOGLE_CLIENT_ID,
})

app.use(VueQueryPlugin, { queryClient })
installQueryPersister()

app.use(router)
installRouterViewTransition(router)
bindNativeStack(router)
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
applyStoredCookieConsent()

app.mount('#app')
markBootPhase('app_mounted')

/* Post-mount : perf, analytics, sentry replay, media engine. */
scheduleDeferredBoot(app, router)

void proactiveRefreshIfStale().catch((err) =>
  console.warn('[Pinova] proactiveRefreshIfStale', err),
)

function deferNonCriticalAssets() {
  void import('./pages/HomePage.vue')
}
if (typeof requestIdleCallback === 'function') {
  requestIdleCallback(deferNonCriticalAssets, { timeout: 3000 })
} else {
  setTimeout(deferNonCriticalAssets, 400)
}
