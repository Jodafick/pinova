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
const {
  isStandalone,
  isIos,
  isSafariIos,
  isChromeIos,
  canOfferInstallExperience,
  canPromptInstall,
  promptInstall,
  wasJustInstalled,
} = usePwaContext()
const { t } = useI18n()

const SNOOZE_MS = 7 * 24 * 3600 * 1000

const isSnoozed = computed(() => isPwaInstallSnoozed())

/** Ouvre le guide (réglages / pont). En PWA installée, affiche l’état « déjà installée ». */
function open() {
  if (!canOfferInstallExperience.value) return
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
type Scenario = 'standalone' | 'just-installed' | 'native-prompt' | 'ios-webkit-supported' | 'unsupported'

const scenario = computed<Scenario>(() => {
  if (isStandalone.value) return 'standalone'
  if (wasJustInstalled.value) return 'just-installed'
  if (canPromptInstall.value) return 'native-prompt'
  if (isIos.value && (isSafariIos.value || isChromeIos.value)) return 'ios-webkit-supported'
  return 'unsupported'
})

defineExpose({ open, close, isSnoozed, scenario })
</script>

<template>
  <PinovaModal
    v-if="scenario !== 'unsupported'"
    v-model:open="isOpen"
    presentation="tallSheet"
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

    <!-- Hero : illustration logo + glow rose (adaptatif thème). -->
    <div class="relative flex flex-col items-center justify-center px-0 pb-4 pt-2">
      <div
        class="pointer-events-none absolute size-44 rounded-full bg-[radial-gradient(circle,rgba(224,36,94,0.38)_0%,transparent_68%)] blur-md dark:bg-[radial-gradient(circle,rgba(244,114,182,0.34)_0%,transparent_70%)]"
        aria-hidden="true"
      />
      <div
        class="pwa-install__hero-logo relative grid size-[72px] place-items-center overflow-hidden rounded-[22px] bg-white shadow-lg shadow-pink-600/25 ring-1 ring-black/5 dark:bg-neutral-800 dark:shadow-black/40 dark:ring-white/10"
      >
        <img src="/logo.png" alt="Pinova" width="68" height="68" class="size-16 object-cover" />
      </div>
    </div>

    <!-- ── Scénario : déjà standalone (theoriquement impossible si on est mounted) ── -->
    <template v-if="scenario === 'standalone' || scenario === 'just-installed'">
      <p class="mb-5 text-center text-[15px] leading-snug text-neutral-700 dark:text-neutral-200">
        {{ t('pwa.install.alreadyInstalled') }}
      </p>
      <button
        type="button"
        class="mt-2 w-full rounded-xl border border-neutral-200/90 bg-transparent py-3 text-[15px] font-medium text-pink-600 transition active:opacity-55 dark:border-white/15 dark:text-pink-400"
        @click="close"
      >
        {{ t('common.close') }}
      </button>
    </template>

    <!-- ── Scénario : prompt natif (Chrome Android / bureau) + astuce menu ⋮ ── -->
    <template v-else-if="scenario === 'native-prompt'">
      <p class="mb-5 text-center text-[15px] leading-snug text-neutral-700 dark:text-neutral-200">
        {{ t('pwa.install.nativePromptLead') }}
      </p>
      <ul class="mb-5 flex list-none flex-col gap-2 p-0">
        <li class="flex items-center gap-2.5 text-[15px] text-neutral-800 dark:text-neutral-100">
          <span class="material-symbols-outlined shrink-0 text-[22px] text-pink-600 dark:text-pink-400">flash_on</span>
          <span>{{ t('pwa.install.bullet.fast') }}</span>
        </li>
        <li class="flex items-center gap-2.5 text-[15px] text-neutral-800 dark:text-neutral-100">
          <span class="material-symbols-outlined shrink-0 text-[22px] text-pink-600 dark:text-pink-400">offline_bolt</span>
          <span>{{ t('pwa.install.bullet.offline') }}</span>
        </li>
        <li class="flex items-center gap-2.5 text-[15px] text-neutral-800 dark:text-neutral-100">
          <span class="material-symbols-outlined shrink-0 text-[22px] text-pink-600 dark:text-pink-400">notifications_active</span>
          <span>{{ t('pwa.install.bullet.notifs') }}</span>
        </li>
      </ul>
      <p
        class="mb-5 rounded-2xl border border-pink-500/15 bg-pink-500/[0.08] px-3.5 py-3 text-center text-[13px] leading-snug text-neutral-600 dark:border-pink-400/25 dark:bg-pink-500/10 dark:text-neutral-300"
      >
        {{ t('pwa.install.androidMenuHint') }}
      </p>
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-pink-600 to-pink-500 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-pink-600/30 transition [transition-property:transform,filter] active:scale-[0.98] active:brightness-[0.96] dark:shadow-pink-900/45"
        @click="clickInstall"
      >
        <span class="material-symbols-outlined text-[22px]">install_mobile</span>
        {{ t('pwa.install.installNow') }}
      </button>
      <button
        type="button"
        class="mt-2 w-full rounded-xl border-0 py-3 text-[15px] font-medium text-neutral-600 transition active:opacity-55 dark:text-neutral-300"
        @click="snooze"
      >
        {{ t('pwa.install.later') }}
      </button>
    </template>

    <!-- ── iOS Safari : barre d’outils basse (⋯ → Partager → Sur l’écran d’accueil) ── -->
    <template v-else-if="scenario === 'ios-webkit-supported'">
      <p class="mb-5 text-center text-[15px] leading-snug text-neutral-700 dark:text-neutral-200">
        {{ t('pwa.install.iosLead') }}
      </p>

      <div
        class="pwa-install__safari-mock mb-[18px] rounded-2xl border border-neutral-200/90 bg-gradient-to-b from-white/80 to-neutral-50/95 px-3 py-3 shadow-md shadow-black/5 backdrop-blur-md dark:border-white/10 dark:from-neutral-900/90 dark:to-neutral-950/95 dark:shadow-black/50"
        aria-hidden="true"
      >
        <div
          class="mb-2.5 flex items-center justify-center gap-1.5 rounded-xl bg-black/[0.06] px-3 py-2 text-[13px] font-semibold text-neutral-800 dark:bg-white/10 dark:text-neutral-100"
        >
          <span class="pwa-install__safari-lock material-symbols-outlined !text-sm opacity-60">lock</span>
          <span class="pwa-install__safari-host tracking-tight">pinova…</span>
        </div>
        <div class="flex items-center justify-center gap-4 px-1 pb-1 pt-2">
          <span
            class="pwa-install__glass-icon-btn material-symbols-outlined text-[22px] leading-none text-neutral-900 dark:text-white"
            style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
          ><span class="block translate-y-px opacity-[0.38]">chevron_backward</span></span>
          <span
            class="pwa-install__glass-icon-btn pwa-install__glass-icon-btn--pulse material-symbols-outlined text-[22px] leading-none text-neutral-900 dark:text-white"
            style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
          ><span class="block translate-y-px">ios_share</span></span>
          <span
            class="pwa-install__glass-icon-btn pwa-install__glass-icon-btn--pulse material-symbols-outlined text-[21px] leading-none text-neutral-900 dark:text-white"
            style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
          ><span class="block translate-y-px">more_horiz</span></span>
        </div>
      </div>

      <ol class="mb-[18px] flex list-none flex-col gap-3 p-0">
        <li
          class="flex gap-3 rounded-2xl border border-neutral-200/90 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-neutral-900/55"
        >
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white dark:bg-pink-500"
          >
            1
          </div>
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div
              class="pwa-install__glass-icon-btn pwa-install__glass-icon-btn--sm material-symbols-outlined text-[21px] leading-none text-neutral-900 dark:text-white"
              style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            ><span class="block translate-y-px">more_horiz</span></div>
            <p class="m-0 flex-1 text-[14.5px] leading-snug text-neutral-800 dark:text-neutral-100">
              {{ t('pwa.install.step1') }}
            </p>
          </div>
        </li>
        <li
          class="flex gap-3 rounded-2xl border border-neutral-200/90 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-neutral-900/55"
        >
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white dark:bg-pink-500"
          >
            2
          </div>
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div
              class="pwa-install__glass-icon-btn pwa-install__glass-icon-btn--sm material-symbols-outlined text-[21px] leading-none text-neutral-900 dark:text-white"
              style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            ><span class="block translate-y-px">ios_share</span></div>
            <p class="m-0 flex-1 text-[14.5px] leading-snug text-neutral-800 dark:text-neutral-100">
              {{ t('pwa.install.step2') }}
            </p>
          </div>
        </li>
        <li
          class="flex gap-3 rounded-2xl border border-neutral-200/90 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-neutral-900/55"
        >
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white dark:bg-pink-500"
          >
            3
          </div>
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div
              class="pwa-install__glass-icon-btn pwa-install__glass-icon-btn--sm material-symbols-outlined text-[21px] leading-none text-neutral-900 dark:text-white"
              style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            ><span class="block translate-y-px">add_box</span></div>
            <p class="m-0 flex-1 text-[14.5px] leading-snug text-neutral-800 dark:text-neutral-100">
              {{ t('pwa.install.step3') }}
            </p>
          </div>
        </li>
        <li
          class="flex gap-3 rounded-2xl border border-neutral-200/90 bg-white/75 px-3.5 py-3 dark:border-white/10 dark:bg-neutral-900/55"
        >
          <div
            class="flex size-7 shrink-0 items-center justify-center rounded-full bg-pink-600 text-sm font-bold text-white dark:bg-pink-500"
          >
            4
          </div>
          <div class="flex min-w-0 flex-1 items-center gap-3">
            <div
              class="pwa-install__glass-icon-btn pwa-install__glass-icon-btn--sm material-symbols-outlined text-[21px] leading-none text-neutral-900 dark:text-white"
              style="font-variation-settings: 'FILL' 0, 'wght' 500, 'GRAD' 0, 'opsz' 24"
            ><span class="block translate-y-px">touch_app</span></div>
            <p class="m-0 flex-1 text-[14.5px] leading-snug text-neutral-800 dark:text-neutral-100">
              {{ t('pwa.install.step4') }}
            </p>
          </div>
        </li>
      </ol>
      <button
        type="button"
        class="mt-2 w-full rounded-xl border-0 py-3 text-[15px] font-medium text-neutral-600 transition active:opacity-55 dark:text-neutral-300"
        @click="snooze"
      >
        {{ t('pwa.install.later') }}
      </button>
    </template>

    <template v-else />
  </PinovaModal>
</template>

<style scoped>
/* Bouton circulaire « liquid glass » + icône monochrome (aligné Safari réel). */
.pwa-install__glass-icon-btn {
  display: grid;
  place-items: center;
  width: 2.75rem;
  height: 2.75rem;
  flex-shrink: 0;
  margin: 0;
  border-radius: 9999px;
  background: rgba(255, 255, 255, 0.42);
  border: 1px solid rgba(255, 255, 255, 0.62);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.85) inset,
    0 6px 20px -10px rgba(0, 0, 0, 0.22);
  backdrop-filter: blur(18px) saturate(1.35);
  -webkit-backdrop-filter: blur(18px) saturate(1.35);
}
:global(.dark) .pwa-install__glass-icon-btn {
  background: rgba(255, 255, 255, 0.08);
  border-color: rgba(255, 255, 255, 0.18);
  box-shadow:
    0 1px 0 rgba(255, 255, 255, 0.14) inset,
    0 10px 28px -14px rgba(0, 0, 0, 0.75);
}

.pwa-install__glass-icon-btn--sm {
  width: 2.375rem;
  height: 2.375rem;
}

@media (prefers-reduced-motion: no-preference) {
  .pwa-install__glass-icon-btn--pulse {
    animation: pwa-install-pulse 2.4s ease-in-out infinite;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pwa-install__glass-icon-btn--pulse {
    animation: none;
  }
}
@keyframes pwa-install-pulse {
  0%,
  100% {
    transform: scale(1);
    opacity: 1;
  }
  50% {
    transform: scale(1.04);
    opacity: 0.94;
  }
}
</style>
