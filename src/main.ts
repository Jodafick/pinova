import { createApp } from 'vue'
import './style.css'
import App from './App.vue'
import router from './router'
import GoogleSignInPlugin from 'vue3-google-signin'
import { useAuth } from './composables/useAuth'

const app = createApp(App)

app.use(GoogleSignInPlugin, {
  clientId: '274683910451-u52eib3lr7t5qehu23bhnafn85ovaub3.apps.googleusercontent.com',
})

// Restaurer la session utilisateur au démarrage de l'application
const { fetchCurrentUser } = useAuth()
fetchCurrentUser().then(() => {
  app.use(router)
  app.mount('#app')
})
