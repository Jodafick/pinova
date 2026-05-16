<script setup lang="ts">
/**
 * PwaInstallExperience — onboarding d'installation iOS premium.
 *
 * Scénarios gérés :
 *  1. Standalone déjà actif       → composant invisible (return early)
 *  2. Android / Chrome desktop    → bouton "Installer" qui déclenche `prompt()`
 *  3. iOS Safari (non installé)   → onboarding visuel "Share → Add to Home Screen"
 *  4. Chrome iOS / Firefox iOS    → message "Ouvrir dans Safari"
 *
 * Caractéristiques :
 *  - Fond glass premium (saturate + blur 22px)
 *  - Pas de popup agressive : déclenché explicitement par l'utilisateur
 *  - 3 étapes visuelles animées (Share icon → Add to Home → Tap icon)
 *  - "Plus tard" mémorisé en localStorage (snooze 7 jours)
 *  - Respect prefers-reduced-motion
 *
 * Usage :
 *
 *   const installExpRef = ref<InstanceType<typeof PwaInstallExperience>>()
 *   <PwaInstallExperience ref="installExpRef" />
 *   <button @click="installExpRef?.open()">Installer Pinova</button>
 *
 *   // Ou: helper global
 *   import { openPwaInstall } from './PwaInstallExperience.vue'
 *   openPwaInstall()
 */
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'
import PinovaModal from '../ui/PinovaModal.vue'
import { usePwaContext } from '../../composables/usePwaContext'
import { useI18n } from '../../i18n'
import { registerPwaInstallOpener } from '../../utils/pwaInstallBridge'
import { PWA_INSTALL_SNOOZE_KEY, isPwaInstallSnoozed } from '../../utils/pwaInstallStorage'

const isOpen = ref(false)
const { isStandalone, isIos, isAndroid, isSafariIos, isChromeIos, canPromptInstall, promptInstall, wasJustInstalled } = usePwaContext()
const { t } = useI18n()

const SNOOZE_MS = 7 * 24 * 3600 * 1000

const isSnoozed = computed(() => isPwaInstallSnoozed())

function open() {
  if (isStandalone.value) return
  isOpen.value = true
}

function close() {
  isOpen.value = false
}

function snooze() {
  if (typeof localStorage !== 'undefined') {
    localStorage.setItem(PWA_INSTALL_SNOOZE_KEY, String(Date.now() + SNOOZE_MS))
  }
  close()
}

onMounted(() => {
  registerPwaInstallOpener(() => open())
})
onBeforeUnmount(() => {
  registerPwaInstallOpener(null)
})

async function clickInstall() {
  if (!canPromptInstall.value) return
  const outcome = await promptInstall()
  if (outcome === 'accepted') {
    close()
  }
}

/* Scénario résolu côté UI. */
type Scenario = 'standalone' | 'just-installed' | 'native-prompt' | 'ios-safari' | 'ios-other-browser' | 'desktop-fallback'

const scenario = computed<Scenario>(() => {
  if (isStandalone.value) return 'standalone'
  if (wasJustInstalled.value) return 'just-installed'
  if (canPromptInstall.value) return 'native-prompt'
  if (isIos.value && (isChromeIos.value || (!isSafariIos.value && !isAndroid.value))) {
    /* Firefox / Edge iOS, etc. — ne peuvent pas installer. */
    return 'ios-other-browser'
  }
  if (isSafariIos.value) return 'ios-safari'
  return 'desktop-fallback'
})

defineExpose({ open, close, isSnoozed, scenario })
</script>

<template>
  <PinovaModal
    v-model:open="isOpen"
    presentation="tallSheet"
    rose
    :show-header="true"
    :title="t('pwa.install.title')"
    :subtitle="t('pwa.install.subtitle')"
    handle
  >
    <template #headerStart>
      <button type="button" class="modal-header__action modal-header__action--ghost" @click="close">
        {{ t('common.close') }}
      </button>
    </template>

    <!-- Hero : illustration logo + glow rose. -->
    <div class="pwa-install__hero">
      <div class="pwa-install__hero-glow" aria-hidden="true" />
      <div class="pwa-install__hero-logo">
        <img src="/logo.png" alt="Pinova" width="68" height="68" />
      </div>
    </div>

    <!-- ── Scénario : déjà standalone (theoriquement impossible si on est mounted) ── -->
    <template v-if="scenario === 'standalone' || scenario === 'just-installed'">
      <p class="pwa-install__lead">{{ t('pwa.install.alreadyInstalled') }}</p>
      <button type="button" class="pwa-install__cta-secondary" @click="close">
        {{ t('common.close') }}
      </button>
    </template>

    <!-- ── Scénario : prompt natif (Chrome Android / bureau) + astuce menu ⋮ ── -->
    <template v-else-if="scenario === 'native-prompt'">
      <p class="pwa-install__lead">{{ t('pwa.install.nativePromptLead') }}</p>
      <ul class="pwa-install__bullets">
        <li><span class="material-symbols-outlined">flash_on</span>{{ t('pwa.install.bullet.fast') }}</li>
        <li><span class="material-symbols-outlined">offline_bolt</span>{{ t('pwa.install.bullet.offline') }}</li>
        <li><span class="material-symbols-outlined">notifications_active</span>{{ t('pwa.install.bullet.notifs') }}</li>
      </ul>
      <p class="pwa-install__android-hint">{{ t('pwa.install.androidMenuHint') }}</p>
      <button type="button" class="pwa-install__cta-primary" @click="clickInstall">
        <span class="material-symbols-outlined">install_mobile</span>
        {{ t('pwa.install.installNow') }}
      </button>
      <button type="button" class="pwa-install__cta-ghost" @click="snooze">
        {{ t('pwa.install.later') }}
      </button>
    </template>

    <!-- ── iOS Safari : barre d’outils basse (⋯ → Partager → Sur l’écran d’accueil) ── -->
    <template v-else-if="scenario === 'ios-safari'">
      <p class="pwa-install__lead">{{ t('pwa.install.iosLead') }}</p>

      <div class="pwa-install__safari-mock" aria-hidden="true">
        <div class="pwa-install__safari-url">
          <span class="pwa-install__safari-lock material-symbols-outlined">lock</span>
          <span class="pwa-install__safari-host">pinova…</span>
        </div>
        <div class="pwa-install__safari-toolbar">
          <span class="pwa-install__safari-fab pwa-install__safari-fab--ghost material-symbols-outlined">chevron_backward</span>
          <span class="pwa-install__safari-fab pwa-install__safari-fab--accent material-symbols-outlined">ios_share</span>
          <span class="pwa-install__safari-fab pwa-install__safari-fab--accent material-symbols-outlined">more_horiz</span>
        </div>
      </div>

      <ol class="pwa-install__steps">
        <li class="pwa-install__step">
          <div class="pwa-install__step-num">1</div>
          <div class="pwa-install__step-body">
            <div class="pwa-install__step-icon">
              <span class="material-symbols-outlined">more_horiz</span>
            </div>
            <p>{{ t('pwa.install.step1') }}</p>
          </div>
        </li>
        <li class="pwa-install__step">
          <div class="pwa-install__step-num">2</div>
          <div class="pwa-install__step-body">
            <div class="pwa-install__step-icon">
              <span class="material-symbols-outlined">ios_share</span>
            </div>
            <p>{{ t('pwa.install.step2') }}</p>
          </div>
        </li>
        <li class="pwa-install__step">
          <div class="pwa-install__step-num">3</div>
          <div class="pwa-install__step-body">
            <div class="pwa-install__step-icon">
              <span class="material-symbols-outlined">add_box</span>
            </div>
            <p>{{ t('pwa.install.step3') }}</p>
          </div>
        </li>
        <li class="pwa-install__step">
          <div class="pwa-install__step-num">4</div>
          <div class="pwa-install__step-body">
            <div class="pwa-install__step-icon">
              <span class="material-symbols-outlined">touch_app</span>
            </div>
            <p>{{ t('pwa.install.step4') }}</p>
          </div>
        </li>
      </ol>
      <button type="button" class="pwa-install__cta-ghost" @click="snooze">
        {{ t('pwa.install.later') }}
      </button>
    </template>

    <!-- ── Scénario : iOS hors-Safari (Chrome iOS, FF iOS) ── -->
    <template v-else-if="scenario === 'ios-other-browser'">
      <p class="pwa-install__lead">{{ t('pwa.install.iosNonSafariLead') }}</p>
      <div class="pwa-install__note">
        <span class="material-symbols-outlined">info</span>
        <p>{{ t('pwa.install.iosNonSafariNote') }}</p>
      </div>
      <button type="button" class="pwa-install__cta-primary" @click="snooze">
        {{ t('common.ok') }}
      </button>
    </template>

    <!-- ── Scénario : desktop fallback (pas de prompt dispo) ── -->
    <template v-else>
      <p class="pwa-install__lead">{{ t('pwa.install.desktopLead') }}</p>
      <button type="button" class="pwa-install__cta-ghost" @click="close">
        {{ t('common.close') }}
      </button>
    </template>
  </PinovaModal>
</template>

<style scoped>
.pwa-install__hero {
  position: relative;
  display: flex;
  justify-content: center;
  align-items: center;
  padding: 8px 0 16px;
}
.pwa-install__hero-glow {
  position: absolute;
  width: 180px;
  height: 180px;
  border-radius: 999px;
  background: radial-gradient(circle, rgba(224, 36, 94, 0.35) 0%, transparent 70%);
  filter: blur(8px);
  pointer-events: none;
}
.pwa-install__hero-logo {
  position: relative;
  width: 72px;
  height: 72px;
  border-radius: 22px;
  overflow: hidden;
  display: grid;
  place-items: center;
  background: white;
  box-shadow: 0 10px 30px rgba(224, 36, 94, 0.3), 0 0 0 1px rgba(255, 255, 255, 0.4) inset;
}
.pwa-install__hero-logo img {
  width: 64px;
  height: 64px;
  object-fit: cover;
}

.pwa-install__lead {
  font-size: 15px;
  line-height: 1.4;
  color: rgba(60, 60, 67, 0.85);
  margin: 0 0 18px;
  text-align: center;
}
:global(.dark) .pwa-install__lead { color: rgba(235, 235, 245, 0.78); }

.pwa-install__bullets {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.pwa-install__bullets li {
  display: flex;
  align-items: center;
  gap: 10px;
  font-size: 15px;
  color: var(--text, #111);
}
:global(.dark) .pwa-install__bullets li { color: #f5f5f7; }
.pwa-install__bullets .material-symbols-outlined { color: var(--pinova-rose-500, #e0245e); font-size: 22px; }

.pwa-install__android-hint {
  margin: -6px 0 18px;
  padding: 12px 14px;
  font-size: 13px;
  line-height: 1.45;
  color: rgba(60, 60, 67, 0.72);
  text-align: center;
  border-radius: 14px;
  background: rgba(224, 36, 94, 0.06);
  border: 1px solid rgba(224, 36, 94, 0.14);
}
:global(.dark) .pwa-install__android-hint {
  color: rgba(235, 235, 245, 0.72);
  background: rgba(255, 107, 156, 0.1);
  border-color: rgba(255, 107, 156, 0.22);
}

.pwa-install__safari-mock {
  margin: 0 0 18px;
  padding: 12px 12px 10px;
  border-radius: 18px;
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.75) 0%, rgba(250, 250, 252, 0.9) 100%);
  border: 1px solid var(--glass-border);
  box-shadow: 0 12px 32px rgba(224, 36, 94, 0.12), inset 0 1px 0 rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(12px);
  -webkit-backdrop-filter: blur(12px);
}
:global(.dark) .pwa-install__safari-mock {
  background: linear-gradient(180deg, rgba(32, 32, 38, 0.92) 0%, rgba(22, 22, 28, 0.96) 100%);
  box-shadow: 0 12px 36px rgba(0, 0, 0, 0.45), inset 0 1px 0 rgba(255, 255, 255, 0.06);
}
.pwa-install__safari-url {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 6px;
  padding: 8px 12px;
  margin-bottom: 10px;
  border-radius: 12px;
  background: rgba(0, 0, 0, 0.05);
  font-size: 13px;
  font-weight: 600;
  color: rgba(60, 60, 67, 0.85);
}
:global(.dark) .pwa-install__safari-url {
  background: rgba(255, 255, 255, 0.06);
  color: rgba(235, 235, 245, 0.88);
}
.pwa-install__safari-lock {
  font-size: 14px !important;
  opacity: 0.65;
}
.pwa-install__safari-host {
  letter-spacing: -0.02em;
}
.pwa-install__safari-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 6px 4px 2px;
  gap: 8px;
}
.pwa-install__safari-fab {
  display: grid;
  place-items: center;
  width: 40px;
  height: 40px;
  border-radius: 12px;
  font-size: 22px !important;
  color: rgba(60, 60, 67, 0.55);
}
:global(.dark) .pwa-install__safari-fab {
  color: rgba(235, 235, 245, 0.5);
}
.pwa-install__safari-fab--ghost {
  opacity: 0.45;
}
.pwa-install__safari-fab--accent {
  background: linear-gradient(145deg, rgba(224, 36, 94, 0.18), rgba(255, 77, 125, 0.12));
  color: var(--pinova-rose-600, #c2185b);
  box-shadow: 0 2px 8px rgba(224, 36, 94, 0.2);
}
:global(.dark) .pwa-install__safari-fab--accent {
  color: var(--pinova-rose-400, #ff6b9c);
  background: linear-gradient(145deg, rgba(255, 107, 156, 0.22), rgba(224, 36, 94, 0.12));
}

@media (prefers-reduced-motion: no-preference) {
  .pwa-install__safari-fab--accent {
    animation: pwa-install-pulse 2.4s ease-in-out infinite;
  }
}
@keyframes pwa-install-pulse {
  0%, 100% { transform: scale(1); opacity: 1; }
  50% { transform: scale(1.04); opacity: 0.92; }
}

.pwa-install__steps {
  list-style: none;
  padding: 0;
  margin: 0 0 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.pwa-install__step {
  display: flex;
  gap: 12px;
  padding: 12px 14px;
  border-radius: 16px;
  background-color: rgba(255, 255, 255, 0.6);
  border: 1px solid var(--glass-border);
}
:global(.dark) .pwa-install__step { background-color: rgba(22, 22, 26, 0.5); }

.pwa-install__step-num {
  width: 28px;
  height: 28px;
  flex-shrink: 0;
  display: grid;
  place-items: center;
  border-radius: 999px;
  background: var(--pinova-rose-500, #e0245e);
  color: white;
  font-weight: 700;
  font-size: 14px;
}
.pwa-install__step-body {
  display: flex;
  align-items: center;
  gap: 12px;
  flex: 1;
  min-width: 0;
}
.pwa-install__step-body p {
  margin: 0;
  font-size: 14.5px;
  color: var(--text, #111);
  flex: 1;
}
:global(.dark) .pwa-install__step-body p { color: #f5f5f7; }

.pwa-install__step-icon {
  display: grid;
  place-items: center;
  width: 38px;
  height: 38px;
  flex-shrink: 0;
  border-radius: 12px;
  background-color: rgba(224, 36, 94, 0.08);
  color: var(--pinova-rose-500, #e0245e);
}
:global(.dark) .pwa-install__step-icon {
  background-color: rgba(255, 107, 156, 0.16);
  color: var(--pinova-rose-400, #ff4d7d);
}

.pwa-install__note {
  display: flex;
  align-items: flex-start;
  gap: 8px;
  padding: 12px 14px;
  border-radius: 14px;
  background-color: rgba(224, 36, 94, 0.06);
  border: 1px solid rgba(224, 36, 94, 0.18);
  margin: 0 0 16px;
}
.pwa-install__note p { margin: 0; font-size: 14px; color: var(--text, #111); }
:global(.dark) .pwa-install__note p { color: #f5f5f7; }

.pwa-install__cta-primary {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 14px 16px;
  border-radius: 16px;
  border: 0;
  background: linear-gradient(135deg, #e0245e 0%, #ff4d7d 100%);
  color: white;
  font-weight: 600;
  font-size: 16px;
  cursor: pointer;
  box-shadow: 0 8px 22px rgba(224, 36, 94, 0.35);
  -webkit-tap-highlight-color: transparent;
  transition: transform var(--pinova-dur-ultraFast, 120ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--pinova-dur-ultraFast, 120ms) ease;
}
.pwa-install__cta-primary:active {
  transform: scale3d(0.97, 0.97, 1);
  filter: brightness(0.96);
}

.pwa-install__cta-secondary,
.pwa-install__cta-ghost {
  width: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 8px;
  padding: 12px 16px;
  margin-top: 8px;
  border-radius: 14px;
  border: 1px solid var(--glass-border);
  background-color: transparent;
  color: var(--pinova-rose-500, #e0245e);
  font-weight: 500;
  font-size: 15px;
  cursor: pointer;
  -webkit-tap-highlight-color: transparent;
  transition: opacity var(--pinova-dur-ultraFast, 120ms) ease;
}
.pwa-install__cta-ghost { border: 0; color: rgba(60, 60, 67, 0.7); }
:global(.dark) .pwa-install__cta-ghost { color: rgba(235, 235, 245, 0.7); }
.pwa-install__cta-secondary:active,
.pwa-install__cta-ghost:active { opacity: 0.55; }
</style>
