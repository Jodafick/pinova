<script setup lang="ts">
import { computed, watch, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import AvatarDisc from './AvatarDisc.vue'
import { displayInitials } from '../utils/displayInitials'

const props = defineProps<{
  modelValue: boolean
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', value: boolean): void
  (e: 'create-pin'): void
}>()

const router = useRouter()
const { t } = useI18n()
const { currentUser, logout } = useAuth()

const currentPlan = computed(() => currentUser.value?.subscription?.plan || 'free')
const currentPlanLabel = computed(() => {
  if (currentPlan.value === 'pro') return 'PRO'
  if (currentPlan.value === 'plus') return 'PLUS'
  return 'FREE'
})

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (typeof document === 'undefined') return
    document.body.style.overflow = open ? 'hidden' : ''
  },
)

function onLogout() {
  close()
  void logout()
  void router.push('/')
}

function onCreatePin() {
  close()
  emit('create-pin')
}

onUnmounted(() => {
  if (typeof document !== 'undefined') document.body.style.overflow = ''
})
</script>

<template>
  <Teleport to="body">
    <div
      v-if="modelValue"
      class="fixed inset-0 z-[199] lg:hidden"
      role="dialog"
      aria-modal="true"
      :aria-label="t('nav.profile')"
    >
      <div
        class="absolute inset-0 bg-black/50 backdrop-blur-[1px]"
        @click="close"
      />
      <aside
        class="absolute left-0 top-0 bottom-0 flex w-[min(20rem,88vw)] flex-col bg-white shadow-2xl dark:bg-neutral-950 dark:shadow-black/40"
        @click.stop
      >
        <div class="flex items-center justify-between border-b border-neutral-200 px-4 py-3 dark:border-neutral-800">
          <p class="text-sm font-black text-neutral-900 dark:text-neutral-50">
            {{ t('nav.profile') }}
          </p>
          <button
            type="button"
            class="grid h-9 w-9 place-items-center rounded-full bg-neutral-100 text-neutral-700 dark:bg-neutral-800 dark:text-neutral-100"
            :aria-label="t('common.close')"
            @click="close"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>

        <div
          v-if="currentUser"
          class="flex gap-3 border-b border-neutral-200 px-4 py-4 dark:border-neutral-800"
        >
          <AvatarDisc
            :color="currentUser.avatarColor || DEFAULT_AVATAR_COLOR_CLASS"
            frame-class="w-12 h-12 shrink-0 text-sm ring-2 ring-pink-100"
            text-class="text-white"
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
          <div class="min-w-0 flex-1">
            <p class="flex items-center gap-1 text-sm font-semibold text-neutral-900 dark:text-neutral-100">
              <span
                v-if="currentPlan === 'pro'"
                class="material-symbols-outlined shrink-0 text-base text-amber-500"
              >
                verified
              </span>
              <span class="truncate">{{ currentUser.displayName }}</span>
            </p>
            <p class="truncate text-xs text-neutral-500">@{{ currentUser.username }}</p>
          </div>
        </div>

        <nav class="flex-1 overflow-y-auto py-2">
          <router-link
            v-if="currentUser"
            :to="`/profile/${currentUser.username}`"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">person</span>
            {{ t('header.user.myProfile') }}
          </router-link>

          <button
            type="button"
            class="flex w-full items-center gap-3 px-4 py-2.5 text-left text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="onCreatePin"
          >
            <span class="material-symbols-outlined text-lg text-pink-700">add_circle</span>
            {{ t('nav.create') }}
          </button>

          <router-link
            to="/"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">home</span>
            {{ t('nav.home') }}
          </router-link>
          <router-link
            to="/explore"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">travel_explore</span>
            {{ t('nav.explore') }}
          </router-link>
          <router-link
            to="/contest/live"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">emoji_events</span>
            {{ t('nav.contest') }}
          </router-link>
          <router-link
            to="/referrals/contest"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">card_giftcard</span>
            {{ t('nav.referral') }}
          </router-link>
          <router-link
            to="/following"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">groups</span>
            {{ t('nav.following') }}
          </router-link>
          <router-link
            v-if="currentPlan === 'pro'"
            to="/creator"
            class="flex items-center gap-3 px-4 py-2.5 text-sm font-medium text-amber-900 transition hover:bg-amber-50 dark:text-amber-100 dark:hover:bg-amber-950/40"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg">insights</span>
            {{ t('nav.creator') }}
          </router-link>

          <div class="my-2 border-t border-neutral-100 dark:border-neutral-800" />

          <router-link
            to="/settings"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">settings</span>
            {{ t('nav.settings') }}
          </router-link>
          <router-link
            to="/billing"
            class="flex items-center gap-3 px-4 py-2.5 text-sm text-neutral-800 transition hover:bg-neutral-50 dark:text-neutral-100 dark:hover:bg-neutral-900"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg text-neutral-500">receipt_long</span>
            {{ t('nav.billing') }}
          </router-link>
          <router-link
            to="/premium"
            class="mx-2 mt-1 flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-semibold text-pink-700 transition hover:bg-pink-50 dark:text-pink-600 dark:hover:bg-pink-950/30"
            @click="close"
          >
            <span class="material-symbols-outlined text-lg">workspace_premium</span>
            {{ t('nav.premium') }}
            <span
              class="ml-auto text-[9px] font-bold uppercase tracking-wider"
              :class="
                currentPlan === 'pro'
                  ? 'rounded bg-amber-100 px-1.5 py-0.5 text-amber-700'
                  : currentPlan === 'plus'
                    ? 'rounded bg-pink-100 px-1.5 py-0.5 text-pink-700'
                    : 'rounded bg-neutral-100 px-1.5 py-0.5 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-300'
              "
            >
              {{ currentPlanLabel }}
            </span>
          </router-link>
        </nav>

        <div class="border-t border-neutral-200 p-2 dark:border-neutral-800">
          <button
            type="button"
            class="flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium text-pink-700 transition hover:bg-pink-50 dark:text-pink-600 dark:hover:bg-pink-950/25"
            @click="onLogout"
          >
            <span class="material-symbols-outlined text-lg">logout</span>
            {{ t('nav.logout') }}
          </button>
        </div>
      </aside>
    </div>
  </Teleport>
</template>
