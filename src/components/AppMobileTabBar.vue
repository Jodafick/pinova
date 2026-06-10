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
    class="app-mobile-tab-bar fixed inset-x-0 bottom-0 z-40 flex items-end border-t border-neutral-200 bg-white/95 backdrop-blur-md dark:border-neutral-800 dark:bg-neutral-950/95 lg:hidden"
    :aria-label="t('nav.mobileTabBar')"
  >
    <template v-if="isAuthenticated">
      <router-link
        to="/"
        class="flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors"
        :class="isHomeActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isHomeActive())"
      >
        <PinovaIcon name="home" class="text-[32px] leading-none" />
        <span class="truncate">{{ t('nav.home') }}</span>
      </router-link>

      <div class="flex min-w-0 flex-1 flex-col items-center justify-end pb-1">
        <button
          v-if="!profileNavMobileDrawerOpen"
          type="button"
          class="-mt-4 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-pink-700 dark:bg-pink-600 text-white shadow-lg shadow-pink-700/30 transition hover:bg-pink-800 dark:hover:opacity-90 active:scale-95"
          :aria-label="t('nav.create')"
          @click="openMobileCreateChooser"
        >
          <PinovaIcon name="add" class="text-[36px]" />
        </button>
      </div>

      <router-link
        :to="profileTo"
        class="flex min-w-0 flex-1 flex-col items-center gap-1 py-2.5 text-[11px] font-semibold transition-colors"
        :class="isProfileActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isProfileActive())"
      >
        <PinovaIcon name="person" class="text-[32px] leading-none" />
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
        <PinovaIcon name="home" class="text-[28px] leading-none" />
        <span class="truncate">{{ t('nav.home') }}</span>
      </router-link>

      <router-link
        to="/explore"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="isExploreActive() ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(isExploreActive())"
      >
        <PinovaIcon name="travel_explore" class="text-[28px] leading-none" />
        <span class="truncate">{{ t('nav.explore') }}</span>
      </router-link>

      <router-link
        to="/contest/live"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="route.name === 'contest-live' ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(route.name === 'contest-live')"
      >
        <PinovaIcon name="emoji_events" class="text-[28px] leading-none" />
        <span class="truncate">{{ t('nav.contest') }}</span>
      </router-link>

      <router-link
        to="/login"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="route.name === 'login' ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(route.name === 'login')"
      >
        <PinovaIcon name="login" class="text-[28px] leading-none" />
        <span class="truncate">{{ t('nav.login') }}</span>
      </router-link>

      <router-link
        to="/register"
        class="flex min-w-0 flex-1 flex-col items-center gap-0.5 py-2 text-[10px] font-semibold transition-colors"
        :class="route.name === 'register' ? 'text-pink-700 dark:text-pink-600' : 'text-neutral-500 dark:text-neutral-400'"
        @click="tabSwitchIfLeaving(route.name === 'register')"
      >
        <PinovaIcon name="person_add" class="text-[28px] leading-none" />
        <span class="truncate">{{ t('nav.register') }}</span>
      </router-link>
    </template>
  </nav>
</template>
