import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import { initAppearance } from './composables/useAppearance'

initAppearance()
import GoogleSignInPlugin from 'vue3-google-signin'
import { useAuth } from './composables/useAuth'
import { proactiveRefreshIfStale } from './api'
import { GOOGLE_CLIENT_ID } from './env'

const app = createApp(App)

app.use(GoogleSignInPlugin, {
  clientId: GOOGLE_CLIENT_ID,
})

// Session : refresh proactif si JWT court expiré, puis profil utilisateur.
// Toujours monter l’app ensuite : sinon le splash statique de index.html reste à l’infini
// si l’API ne répond pas (CORS, mauvaise URL, backend down) ou si une promesse rejette.
const { fetchCurrentUser } = useAuth()
void proactiveRefreshIfStale()
  .catch((err) => console.warn('[Pinova] proactiveRefreshIfStale', err))
  .then(() =>
    fetchCurrentUser().catch((err) => console.warn('[Pinova] fetchCurrentUser (bootstrap)', err)),
  )
  .finally(() => {
    app.use(router)
    app.mount('#app')
  })
