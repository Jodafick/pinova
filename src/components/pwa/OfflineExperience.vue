<script setup lang="ts">
/**
 * OfflineExperience — bannière + écran plein quand pas de réseau.
 *
 * Comportement intelligent :
 *  - Banner discrète en haut quand l'app était online et devient offline
 *    (les composants déjà chargés continuent de fonctionner sur leur cache).
 *  - Écran plein "no network" UNIQUEMENT si on n'a aucune donnée à afficher
 *    (premier boot sans connexion ET sans cache SW).
 *  - Retry intelligent : bouton "Réessayer" qui force `window.location.reload()`
 *    après un check `navigator.onLine`.
 *  - Disparition automatique avec micro-animation au retour online.
 *
 * Le composant est mounted dans App.vue.
 *
 * Usage : aucune prop, le composant écoute `usePwaContext().isOnline` lui-même.
 */
import { computed, ref, watch } from 'vue'
import { usePwaContext } from '../../composables/usePwaContext'
import { useI18n } from '../../i18n'

const { isOnline } = usePwaContext()
const { t } = useI18n()

/* Bannière (recouvre toute la largeur, ~36px). */
const showBanner = ref(false)
const justBackOnline = ref(false)
let backOnlineTimer: ReturnType<typeof setTimeout> | null = null

watch(isOnline, (online) => {
  if (online) {
    /* Retour online : on flash 1.2s "Connexion rétablie" puis on cache. */
    if (showBanner.value || justBackOnline.value) {
      justBackOnline.value = true
      if (backOnlineTimer) clearTimeout(backOnlineTimer)
      backOnlineTimer = setTimeout(() => {
        justBackOnline.value = false
        showBanner.value = false
      }, 1500)
    }
  } else {
    showBanner.value = true
    justBackOnline.value = false
  }
}, { immediate: true })

function retry() {
  /* Si on est toujours offline, on relance juste un check sans reload (sinon
     ça fait un écran d'erreur natif moche). */
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    window.location.reload()
  } else {
    /* Ping rapide via Image() avec timestamp pour bypass cache. */
    const probe = new Image()
    probe.onload = () => window.location.reload()
    probe.onerror = () => {
      /* Reste offline : on déclenche un petit shake visuel. */
      const banner = document.querySelector('.fotoce-offline-banner')
      banner?.classList.remove('fotoce-offline-banner--shake')
      requestAnimationFrame(() => banner?.classList.add('fotoce-offline-banner--shake'))
    }
    probe.src = `/favicon-16x16.png?probe=${Date.now()}`
  }
}

const bannerLabel = computed(() => {
  if (justBackOnline.value) return t('pwa.offline.back')
  return t('pwa.offline.banner')
})
</script>

<template>
  <transition name="fotoce-offline-fade">
    <div
      v-if="showBanner"
      class="fotoce-offline-banner"
      :class="{ 'is-back': justBackOnline }"
      role="status"
      aria-live="polite"
    >
      <FotoceIcon :name="justBackOnline ? 'wifi' : 'wifi_off'" class="fotoce-offline-banner__icon" />
      <span class="fotoce-offline-banner__label">{{ bannerLabel }}</span>
      <button
        v-if="!justBackOnline"
        type="button"
        class="fotoce-offline-banner__retry"
        @click="retry"
      >
        {{ t('common.retry') }}
      </button>
    </div>
  </transition>
</template>

<style scoped>
.fotoce-offline-banner {
  position: fixed;
  top: calc(env(safe-area-inset-top, 0px) + 8px);
  left: 50%;
  transform: translateX(-50%);
  z-index: 95;
  display: inline-flex;
  align-items: center;
  gap: 10px;
  padding: 8px 14px 8px 12px;
  border-radius: 999px;
  background-color: rgba(40, 40, 44, 0.92);
  backdrop-filter: blur(18px) saturate(180%);
  -webkit-backdrop-filter: blur(18px) saturate(180%);
  color: white;
  font-size: 13px;
  font-weight: 500;
  box-shadow: 0 8px 28px rgba(0, 0, 0, 0.35);
  border: 1px solid rgba(255, 255, 255, 0.1);
  max-width: calc(100vw - 32px);
  pointer-events: auto;
}

.fotoce-offline-banner.is-back {
  background-color: rgba(30, 130, 76, 0.92);
}

.fotoce-offline-banner__icon {
  font-size: 18px;
  flex-shrink: 0;
}

.fotoce-offline-banner__label {
  white-space: nowrap;
}

.fotoce-offline-banner__retry {
  background: rgba(255, 255, 255, 0.18);
  border: 0;
  color: white;
  font-size: 13px;
  font-weight: 600;
  padding: 4px 12px;
  border-radius: 999px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  flex-shrink: 0;
  transition: background-color var(--fotoce-dur-ultraFast, 120ms) ease;
}
.fotoce-offline-banner__retry:hover { background: rgba(255, 255, 255, 0.28); }
.fotoce-offline-banner__retry:active { background: rgba(255, 255, 255, 0.35); }

.fotoce-offline-banner--shake {
  animation: fotoce-offline-shake 360ms cubic-bezier(0.36, 0.07, 0.19, 0.97);
}

@keyframes fotoce-offline-shake {
  0%, 100% { transform: translateX(-50%) translateY(0); }
  20%      { transform: translateX(-50%) translateY(-2px); }
  40%      { transform: translateX(-46%) translateY(0); }
  60%      { transform: translateX(-54%) translateY(0); }
  80%      { transform: translateX(-50%) translateY(-2px); }
}

.fotoce-offline-fade-enter-active,
.fotoce-offline-fade-leave-active {
  transition:
    transform var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--fotoce-dur-fast, 180ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.fotoce-offline-fade-enter-from,
.fotoce-offline-fade-leave-to {
  opacity: 0;
  transform: translateX(-50%) translateY(-100%);
}

@media (prefers-reduced-motion: reduce) {
  .fotoce-offline-fade-enter-active,
  .fotoce-offline-fade-leave-active { transition: opacity 180ms ease; }
  .fotoce-offline-banner--shake { animation: none; }
}
</style>
