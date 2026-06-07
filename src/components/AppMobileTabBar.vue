<script setup lang="ts">
import { computed } from 'vue'
import { useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useMobileCreateChooser } from '../composables/useMobileCreateChooser'
import { profileNavMobileDrawerOpen } from '../composables/mobileHeaderContext'
import { emitMicroFeedback } from '../composables/useMicroFeedback'

const route = useRoute()
const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { openMobileCreateChooser } = useMobileCreateChooser()

const profileTo = computed(() =>
  currentUser.value?.username ? `/profile/${currentUser.value.username}` : '/profile',
)

function isHomeActive() {
  return route.name === 'home'
}

function isExploreActive() {
  return route.name === 'explore' || route.name === 'explore-boards'
}

function isProfileActive() {
  return route.name === 'profile' || route.name === 'board'
}

/** Haptique discret uniquement lors d'un changement d'onglet réel. */
function tabSwitchIfLeaving(alreadyActive: boolean) {
  if (!alreadyActive) emitMicroFeedback('tabSwitch')
}
</script>

<template>
  <nav
    class="app-mobile-tab-bar fixed inset-x-0 bottom-0 z-40 flex border-t border-neutral-200 bg-white/95 pb-[env(safe-area-inset-bottom,0px)] backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden"
    :aria-label="t('nav.mobileTabBar')"
  >
    <template v-if="isAuthenticated">
      <router-link
        to="/"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="isHomeActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isHomeActive())"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">home</span>
        <span class="truncate">{{ t('nav.home') }}</span>
      </router-link>

      <div class="flex min-w-0 flex-1 flex-col items-center justify-start">
        <button
          v-if="!profileNavMobileDrawerOpen"
          type="button"
          class="-mt-3 flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-pink-700 dark:bg-pink-600 text-white shadow-lg shadow-pink-700/30 transition hover:bg-pink-800 dark:hover:opacity-90 active:scale-95"
          :aria-label="t('nav.create')"
          @click="openMobileCreateChooser"
        >
          <span class="material-symbols-outlined text-[28px]">add</span>
        </button>
      </div>

      <router-link
        :to="profileTo"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="isProfileActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isProfileActive())"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">person</span>
        <span class="truncate">{{ t('nav.profile') }}</span>
      </router-link>
    </template>

    <template v-else>
      <router-link
        to="/"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="isHomeActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isHomeActive())"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">home</span>
        <span class="truncate">{{ t('nav.home') }}</span>
      </router-link>

      <router-link
        to="/explore"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="isExploreActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isExploreActive())"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">travel_explore</span>
        <span class="truncate">{{ t('nav.explore') }}</span>
      </router-link>

      <router-link
        to="/contest/live"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="route.name === 'contest-live' ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(route.name === 'contest-live')"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">emoji_events</span>
        <span class="truncate">{{ t('nav.contest') }}</span>
      </router-link>

      <router-link
        to="/login"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="route.name === 'login' ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(route.name === 'login')"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">login</span>
        <span class="truncate">{{ t('nav.login') }}</span>
      </router-link>

      <router-link
        to="/register"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="route.name === 'register' ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(route.name === 'register')"
      >
        <span class="material-symbols-outlined text-[26px] leading-none">person_add</span>
        <span class="truncate">{{ t('nav.register') }}</span>
      </router-link>
    </template>
  </nav>
</template>
