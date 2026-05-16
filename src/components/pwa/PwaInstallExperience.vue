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

/** Ouvre le guide (réglages / pont). En PWA installée, affiche l’état « déjà installée ». */
function open() {
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
    <template v-else-if="scenario === 'ios-safari'">
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
        <div class="flex items-center justify-between gap-2 px-1 pb-0.5 pt-1.5">
          <span
            class="pwa-install__safari-fab pwa-install__safari-fab--ghost material-symbols-outlined grid size-10 place-items-center rounded-xl text-[22px] text-neutral-500 opacity-45 dark:text-neutral-400"
          >chevron_backward</span>
          <span
            class="pwa-install__safari-fab pwa-install__safari-fab--accent material-symbols-outlined grid size-10 place-items-center rounded-xl bg-pink-500/18 text-[22px] text-pink-700 shadow-sm shadow-pink-600/15 dark:bg-pink-500/25 dark:text-pink-300 dark:shadow-pink-900/30"
          >ios_share</span>
          <span
            class="pwa-install__safari-fab pwa-install__safari-fab--accent material-symbols-outlined grid size-10 place-items-center rounded-xl bg-pink-500/18 text-[22px] text-pink-700 shadow-sm shadow-pink-600/15 dark:bg-pink-500/25 dark:text-pink-300 dark:shadow-pink-900/30"
          >more_horiz</span>
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
              class="grid size-[38px] shrink-0 place-items-center rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400"
            >
              <span class="material-symbols-outlined text-[22px]">more_horiz</span>
            </div>
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
              class="grid size-[38px] shrink-0 place-items-center rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400"
            >
              <span class="material-symbols-outlined text-[22px]">ios_share</span>
            </div>
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
              class="grid size-[38px] shrink-0 place-items-center rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400"
            >
              <span class="material-symbols-outlined text-[22px]">add_box</span>
            </div>
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
              class="grid size-[38px] shrink-0 place-items-center rounded-xl bg-pink-500/10 text-pink-600 dark:bg-pink-500/20 dark:text-pink-400"
            >
              <span class="material-symbols-outlined text-[22px]">touch_app</span>
            </div>
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

    <!-- ── Scénario : iOS hors-Safari (Chrome iOS, FF iOS) ── -->
    <template v-else-if="scenario === 'ios-other-browser'">
      <p class="mb-4 text-center text-[15px] leading-snug text-neutral-700 dark:text-neutral-200">
        {{ t('pwa.install.iosNonSafariLead') }}
      </p>
      <div
        class="mb-4 flex items-start gap-2 rounded-2xl border border-pink-500/20 bg-pink-500/[0.07] px-3.5 py-3 dark:border-pink-400/30 dark:bg-pink-500/10"
      >
        <span class="material-symbols-outlined shrink-0 text-pink-600 dark:text-pink-400">info</span>
        <p class="m-0 text-[14px] leading-snug text-neutral-800 dark:text-neutral-100">
          {{ t('pwa.install.iosNonSafariNote') }}
        </p>
      </div>
      <button
        type="button"
        class="w-full flex items-center justify-center gap-2 rounded-2xl border-0 bg-gradient-to-br from-pink-600 to-pink-500 px-4 py-3.5 text-base font-semibold text-white shadow-lg shadow-pink-600/30 transition [transition-property:transform,filter] active:scale-[0.98] active:brightness-[0.96] dark:shadow-pink-900/45"
        @click="snooze"
      >
        {{ t('common.ok') }}
      </button>
    </template>

    <!-- ── Scénario : desktop fallback (pas de prompt dispo) ── -->
    <template v-else>
      <p class="mb-5 text-center text-[15px] leading-snug text-neutral-700 dark:text-neutral-200">
        {{ t('pwa.install.desktopLead') }}
      </p>
      <button
        type="button"
        class="mt-2 w-full rounded-xl border-0 py-3 text-[15px] font-medium text-neutral-600 transition active:opacity-55 dark:text-neutral-300"
        @click="close"
      >
        {{ t('common.close') }}
      </button>
    </template>
  </PinovaModal>
</template>

<style scoped>
@media (prefers-reduced-motion: no-preference) {
  .pwa-install__safari-fab--accent {
    animation: pwa-install-pulse 2.4s ease-in-out infinite;
  }
}
@media (prefers-reduced-motion: reduce) {
  .pwa-install__safari-fab--accent {
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
    opacity: 0.92;
  }
}
</style>
