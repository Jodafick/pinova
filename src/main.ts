import { createApp } from 'vue'
import { registerSW } from 'virtual:pwa-register'
import './style.css'
import App from './App.vue'
import router from './router'
import { initAppearance } from './composables/useAppearance'

initAppearance()

registerSW({ immediate: true })
import GoogleSignInPlugin from 'vue3-google-signin'
import { useAuth } from './composables/useAuth'
import { proactiveRefreshIfStale } from './api'
import { GOOGLE_CLIENT_ID } from './env'

const app = createApp(App)

app.use(GoogleSignInPlugin, {
  clientId: GOOGLE_CLIENT_ID,
})

// Monter l’app tout de suite : l’UI ne doit pas rester bloquée sur le splash si l’API est lente ou injoignable.
// Session : refresh proactif + profil en arrière-plan (App.vue relance aussi fetchCurrentUser au besoin).
const { fetchCurrentUser } = useAuth()
app.use(router)
app.mount('#app')
void proactiveRefreshIfStale()
  .catch((err) => console.warn('[Pinova] proactiveRefreshIfStale', err))
  .then(() =>
    fetchCurrentUser().catch((err) => console.warn('[Pinova] fetchCurrentUser (bootstrap)', err)),
  )
