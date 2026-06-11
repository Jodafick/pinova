<script setup lang="ts">
import { onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import AvatarDisc from './AvatarDisc.vue'
import { displayInitials } from '../utils/displayInitials'
import { getAppScrollRoot } from '../utils/appScrollRoot'
import { clearProfileDrawerPwaTheme, setProfileDrawerPwaTheme } from '../composables/usePwaTheme'
import { usePwaContext } from '../composables/usePwaContext'
import { reloadPwaApplication } from '../utils/pwaAppReload'

const rowNavClass =
  'mb-1.5 flex items-center gap-3 rounded-[14px] border border-white/[0.12] bg-white/[0.14] px-3 py-3 transition-opacity active:opacity-88 dark:border-white/[0.08] dark:bg-black/30'
const iconBoxClass =
  'grid h-10 w-10 shrink-0 place-items-center rounded-xl bg-white/[0.22] dark:bg-white/[0.12]'
const rowNavButtonClass = `${rowNavClass} w-full text-left`

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'share-profile'): void
}>()

const router = useRouter()
const { t } = useI18n()
const { currentUser, logout } = useAuth()
const { isStandalone } = usePwaContext()

async function onReloadPwa() {
  close()
  await reloadPwaApplication()
}

let prevHtmlOverflow = ''
let prevScrollRootOverflow = ''

function close() {
  emit('update:modelValue', false)
}

function onShareProfile() {
  emit('share-profile')
  close()
}

function onLogout() {
  close()
  void logout()
  void router.push('/')
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return

    const scrollRoot = getAppScrollRoot()

    if (open) {
      prevHtmlOverflow = document.documentElement.style.overflow
      document.documentElement.style.overflow = 'hidden'
      document.body.style.overflow = 'hidden'
      if (scrollRoot && scrollRoot !== document.documentElement) {
        prevScrollRootOverflow = scrollRoot.style.overflow
        scrollRoot.style.overflow = 'hidden'
      }
    } else {
      document.documentElement.style.overflow = prevHtmlOverflow
      document.body.style.overflow = ''
      if (scrollRoot && scrollRoot !== document.documentElement) {
        scrollRoot.style.overflow = prevScrollRootOverflow
      }
      prevHtmlOverflow = ''
      prevScrollRootOverflow = ''
    }

    if (open) {
      setProfileDrawerPwaTheme()
    } else {
      clearProfileDrawerPwaTheme()
    }
  },
)

onUnmounted(() => {
  if (typeof document === 'undefined') return
  clearProfileDrawerPwaTheme()
  const scrollRoot = getAppScrollRoot()
  document.documentElement.style.overflow = prevHtmlOverflow
  document.body.style.overflow = ''
  if (scrollRoot && scrollRoot !== document.documentElement) {
    scrollRoot.style.overflow = prevScrollRootOverflow
  }
  prevHtmlOverflow = ''
  prevScrollRootOverflow = ''
})
</script>

<template>
  <!--
    Tiroir profil mobile : menu fixe qui slide depuis la gauche.
    Sur iOS, le contenu derrière ne subit plus de transformation 3D (voir style.css).
  -->
  <button
    v-if="modelValue"
    type="button"
    class="appearance-none pointer-events-auto fixed inset-0 z-[8] m-0 cursor-default border-0 bg-[linear-gradient(180deg,#e11d77_0%,#be185d_50%,#e11d77_75%,#be185d_100%)] p-0 dark:bg-[linear-gradient(180deg,#1a0508_0%,#3d0a1a_38%,#5b1230_62%,#2d0612_100%)] lg:hidden"
    :aria-label="t('common.close')"
    @click="close"
  />
  <div
    v-if="modelValue"
    class="pointer-events-none fixed inset-0 z-[9] bg-[#be185d]/30 dark:bg-black/25 lg:hidden"
    aria-hidden="true"
  />

  <aside
    key="profile-nav-aside"
    class="fixed top-0 bottom-0 z-[25] flex w-full max-w-none flex-col border-0 bg-[linear-gradient(180deg,#e11d77_0%,#be185d_50%,#e11d77_75%,#be185d_100%)] text-white shadow-[4px_0_24px_rgba(0,0,0,0.12)] transition-[left,opacity,visibility] duration-300 [transition-timing-function:cubic-bezier(0.4,0,0.2,1)] will-change-[left] dark:bg-[linear-gradient(180deg,#1a0508_0%,#3d0a1a_38%,#5b1230_62%,#2d0612_100%)] lg:hidden"
    :class="
      modelValue
        ? 'left-0 opacity-100 visible'
        : 'pointer-events-none invisible -left-full opacity-0'
    "
    :style="{
      paddingTop: 'calc(env(safe-area-inset-top, 0px) + 6px)',
      paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 6px)',
    }"
    role="navigation"
    :aria-label="t('nav.profile')"
    :aria-hidden="!modelValue"
    @click.stop
  >
        <!-- En-tête identité — pleine largeur -->
        <div
          class="mb-2 flex w-full min-w-0 flex-row items-start justify-between gap-3 border-b border-white/[0.22] px-4 pb-3 dark:border-white/[0.14]"
        >
          <div class="flex min-w-0 flex-1 flex-row items-center gap-[11px]">
            <div class="rounded-full border-2 border-white/[0.35] p-[2px] dark:border-white/[0.22]">
              <AvatarDisc
                v-if="currentUser"
                :color="currentUser.avatarColor || DEFAULT_AVATAR_COLOR_CLASS"
                frame-class="h-[52px] w-[52px] shrink-0 border-0 text-xl ring-0"
                text-class="text-white font-extrabold"
                :has-image="!!currentUser.avatarUrl"
              >
                <img
                  v-if="currentUser.avatarUrl"
                  :src="currentUser.avatarUrl"
                  alt=""
                  class="h-full w-full object-cover"
                />
                <span v-else>{{ displayInitials(currentUser.displayName || currentUser.username) }}</span>
              </AvatarDisc>
            </div>
            <div v-if="currentUser" class="min-w-0 flex-1">
              <p class="line-clamp-2 text-[17px] font-extrabold leading-[22px] text-white">
                {{ currentUser.displayName }}
              </p>
              <p class="mt-0.5 truncate text-[12.5px] font-semibold text-white/[0.82]">
                @{{ currentUser.username }}
              </p>
            </div>
          </div>
          <button
            type="button"
            class="mt-0.5 grid h-10 w-10 shrink-0 place-items-center rounded-full bg-white/[0.22] text-white shadow-sm shadow-black/10 dark:bg-black/40 dark:text-white dark:shadow-black/40 dark:ring-1 dark:ring-white/15"
            :aria-label="t('common.close')"
            @click="close"
          >
            <PinovaIcon name="close" class="text-[22px]" />
          </button>
        </div>

        <div
          class="flex min-h-0 w-[70vw] max-w-[70%] flex-1 flex-col self-start px-4 pb-1"
        >
        <nav
          class="drawer-nav-scroll min-h-0 flex-1 overflow-y-auto pb-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <p
            class="mb-2 ml-0.5 mt-0.5 text-[11px] font-extrabold uppercase tracking-[1.1px] text-white/[0.55] dark:text-white/[0.62]"
          >
            {{ t('mobile.profile.drawerSectionNav') }}
          </p>

          <router-link
            to="/"
            :class="rowNavClass"
            @click="close"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="home" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{ t('mobile.profile.drawerHome') }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </router-link>

          <router-link
            to="/contest/live"
            :class="rowNavClass"
            @click="close"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="emoji_events" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{ t('nav.contest') }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </router-link>

          <router-link
            to="/referrals/contest"
            :class="rowNavClass"
            @click="close"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="card_giftcard" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{
              t('mobile.profile.drawerReferralContest')
            }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </router-link>

          <router-link
            to="/referrals/invite"
            :class="rowNavClass"
            @click="close"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="group_add" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{
              t('mobile.profile.drawerReferralInvite')
            }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </router-link>

          <button
            type="button"
            :class="rowNavButtonClass"
            @click="onShareProfile"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="share" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{ t('profile.share.profileTitle') }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </button>

          <router-link
            to="/settings"
            :class="rowNavClass"
            @click="close"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="settings" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{ t('nav.settings') }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </router-link>

          <button
            v-if="isStandalone"
            type="button"
            :class="rowNavButtonClass"
            @click="onReloadPwa"
          >
            <span :class="iconBoxClass">
              <PinovaIcon name="refresh" class="text-[22px] text-white" />
            </span>
            <span class="flex-1 text-[15px] font-bold text-white">{{ t('pwa.reload.title') }}</span>
            <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
          </button>

          <p
            class="mb-2 ml-0.5 mt-3.5 text-[11px] font-extrabold uppercase tracking-[1.1px] text-white/[0.55] dark:text-white/[0.62]"
          >
            {{ t('mobile.profile.drawerSectionOffers') }}
          </p>

          <div class="mb-1 grid grid-cols-3 gap-2">
            <router-link
              to="/premium"
              class="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-pink-200/90 bg-white/95 px-2 py-3 shadow-lg shadow-black/[0.08] backdrop-blur-sm transition-opacity active:opacity-88 dark:border-pink-800/55 dark:bg-neutral-950/96 dark:shadow-xl dark:shadow-black/50"
              @click="close"
            >
              <span
                class="mb-2 grid h-11 w-11 place-items-center rounded-full bg-violet-500/[0.13] dark:bg-violet-500/20"
              >
                <PinovaIcon name="workspace_premium" class="text-[24px] text-violet-600 dark:text-violet-400" />
              </span>
              <span class="text-center text-[12px] font-extrabold text-neutral-900 dark:text-neutral-100">{{
                t('mobile.profile.drawerPremium')
              }}</span>
            </router-link>
            <router-link
              to="/promote"
              class="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-amber-200/90 bg-white/95 px-2 py-3 shadow-md shadow-black/[0.06] backdrop-blur-sm transition-opacity active:opacity-88 dark:border-amber-800/55 dark:bg-neutral-950/96 dark:shadow-lg dark:shadow-black/45"
              @click="close"
            >
              <span
                class="mb-2 grid h-11 w-11 place-items-center rounded-full bg-amber-500/15 dark:bg-amber-600/25"
              >
                <PinovaIcon name="rocket_launch" class="text-[24px] text-amber-700 dark:text-amber-400" />
              </span>
              <span class="text-center text-[12px] font-extrabold text-amber-800 dark:text-amber-300">{{
                t('nav.promote')
              }}</span>
            </router-link>
            <router-link
              to="/creator"
              class="flex min-h-24 flex-col items-center justify-center rounded-2xl border border-neutral-200/90 bg-white/95 px-2 py-3 shadow-md shadow-black/[0.06] backdrop-blur-sm transition-opacity active:opacity-88 dark:border-neutral-600/60 dark:bg-neutral-950/96 dark:shadow-lg dark:shadow-black/45"
              @click="close"
            >
              <span
                class="mb-2 grid h-11 w-11 place-items-center rounded-full bg-pink-500/15 dark:bg-pink-600/25"
              >
                <PinovaIcon name="show_chart" class="text-[24px] text-pink-700 dark:text-pink-400" />
              </span>
              <span class="text-center text-[12px] font-extrabold text-pink-700 dark:text-pink-400">{{
                t('mobile.profile.drawerCreator')
              }}</span>
            </router-link>
          </div>

          <p
            class="mb-2 ml-0.5 mt-3.5 text-[11px] font-extrabold uppercase tracking-[1.1px] text-white/[0.55] dark:text-white/[0.62]"
          >
            {{ t('mobile.profile.drawerSectionHelp') }}
          </p>

          <div
            class="mb-1 rounded-2xl border border-white/[0.14] bg-white/[0.1] px-2.5 py-1 backdrop-blur-md dark:border-white/[0.1] dark:bg-black/25 dark:backdrop-blur-lg"
          >
            <router-link
              to="/faq"
              class="flex items-center gap-2.5 rounded-none px-0.5 py-2.5 transition-opacity active:opacity-88"
              @click="close"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.14] dark:bg-white/[0.1]">
                <PinovaIcon name="help" class="text-[20px] text-white" />
              </span>
              <span class="flex-1 text-[14.5px] font-bold text-white/[0.95]">{{ t('nav.faq') }}</span>
              <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
            </router-link>
            <div class="ml-[46px] h-px bg-white/[0.12] dark:bg-white/[0.1]" />
            <router-link
              to="/contact"
              class="flex items-center gap-2.5 rounded-none px-0.5 py-2.5 transition-opacity active:opacity-88"
              @click="close"
            >
              <span class="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-white/[0.14] dark:bg-white/[0.1]">
                <PinovaIcon name="mail" class="text-[20px] text-white" />
              </span>
              <span class="flex-1 text-[14.5px] font-bold text-white/[0.95]">{{
                t('mobile.profile.drawerContact')
              }}</span>
              <PinovaIcon name="chevron_right" class="text-[20px] text-white/45 dark:text-white/32" />
            </router-link>
          </div>

          <p
            class="mb-2 ml-0.5 mt-3.5 text-[11px] font-extrabold uppercase tracking-[1.1px] text-white/[0.55] dark:text-white/[0.62]"
          >
            {{ t('mobile.profile.drawerSectionLegal') }}
          </p>

          <div class="mb-1 flex flex-row flex-wrap gap-2">
            <router-link
              to="/legal/terms"
              class="flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.14] px-3.5 py-2.5 backdrop-blur-sm transition-colors active:bg-white/[0.22] dark:border-white/[0.12] dark:bg-black/35 dark:active:bg-black/50"
              @click="close"
            >
              <PinovaIcon name="description" class="text-[16px] text-white/90 dark:text-white/85" />
              <span class="text-[12.5px] font-bold text-white">{{ t('legal.badgeTerms') }}</span>
            </router-link>
            <router-link
              to="/legal/privacy"
              class="flex items-center gap-2 rounded-full border border-white/20 bg-white/[0.14] px-3.5 py-2.5 backdrop-blur-sm transition-colors active:bg-white/[0.22] dark:border-white/[0.12] dark:bg-black/35 dark:active:bg-black/50"
              @click="close"
            >
              <PinovaIcon name="shield_lock" class="text-[16px] text-white/90 dark:text-white/85" />
              <span class="text-[12.5px] font-bold text-white">{{ t('legal.badgePrivacy') }}</span>
            </router-link>
          </div>
        </nav>

        <button
          type="button"
          class="mt-2 flex w-full shrink-0 items-center justify-center gap-2.5 rounded-2xl border border-white/30 bg-white/40 px-4 py-3.5 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.35)] backdrop-blur-xl backdrop-saturate-150 transition active:scale-[0.99] active:opacity-95 dark:border-white/12 dark:bg-black/45 dark:shadow-black/50"
          @click="onLogout"
        >
          <PinovaIcon name="logout" class="text-[21px] text-neutral-900 dark:text-white" aria-hidden="true" />
          <span class="text-base font-extrabold tracking-tight text-neutral-900 dark:text-white">{{
            t('nav.logout')
          }}</span>
        </button>
        </div>
      </aside>
</template>
