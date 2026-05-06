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
import { startSyncEngine } from './offline/syncEngine'

const app = createApp(App)

app.use(GoogleSignInPlugin, {
  clientId: GOOGLE_CLIENT_ID,
})

// Session : refresh proactif si JWT court expiré, puis profil utilisateur
const { fetchCurrentUser } = useAuth()
void proactiveRefreshIfStale()
  .then(() => fetchCurrentUser())
  .then(() => {
    startSyncEngine()
    app.use(router)
    app.mount('#app')
  })
