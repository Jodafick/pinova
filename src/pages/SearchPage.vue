<script setup lang="ts">
import { computed, onActivated, onMounted, onUnmounted, ref, watch } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { useI18n } from '../i18n'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import {
  fetchHeaderSearch,
  type HeaderSearchUser,
  type HeaderSearchBoard,
} from '../composables/useHeaderSearch'
import { usePins } from '../composables/usePins'
import type { Pin } from '../types'
import AvatarDisc from '../components/AvatarDisc.vue'
import AppMobilePageHeader from '../components/AppMobilePageHeader.vue'
import HeaderMobileSearchField from '../components/HeaderMobileSearchField.vue'

const { t } = useI18n()
const route = useRoute()
const router = useRouter()
const { isAuthenticated } = useAuth()
const { trackSearchInteraction } = usePins()

const queryParam = computed(() => {
  const raw = route.query.q
  return typeof raw === 'string' ? raw : ''
})

const inputValue = ref(queryParam.value)
const inputRef = ref<HTMLInputElement | null>(null)

const pins = ref<Pin[]>([])
const users = ref<HeaderSearchUser[]>([])
const boards = ref<HeaderSearchBoard[]>([])
const recommended = ref<Pin[]>([])
const loading = ref(false)
/** Vrai dès qu'au moins une recherche a été soumise (vue empty vs vue prompt). */
const hasSubmitted = ref(false)
const lastFetchedQuery = ref<string | null>(null)

const trimmedQuery = computed(() => inputValue.value.trim())
const hasResults = computed(
  () => pins.value.length + users.value.length + boards.value.length > 0,
)
const showRecommended = computed(() => !hasSubmitted.value && recommended.value.length > 0)

/*
 * Recherche manuelle uniquement : pas de debounce automatique sur la frappe.
 * La requête réseau ne part qu'au submit du formulaire (Enter ou bouton) afin
 * d'éviter de spammer l'API et de donner à l'utilisateur le contrôle complet.
 */
async function runSearch(q: string) {
  loading.value = true
  hasSubmitted.value = true
  try {
    const r = await fetchHeaderSearch(q, 18)
    pins.value = r.pins
    users.value = r.users
    boards.value = r.boards
    recommended.value = r.recommendedPins
    lastFetchedQuery.value = q
    if (isAuthenticated.value && q.length >= 2) {
      void trackSearchInteraction(q)
    }
  } catch (err) {
    console.error('SearchPage: search error', err)
    pins.value = []
    users.value = []
    boards.value = []
  } finally {
    loading.value = false
  }
}

function syncUrl(q: string) {
  const current = typeof route.query.q === 'string' ? route.query.q : ''
  if (current === q) return
  router.replace({
    path: '/search',
    query: q ? { q } : {},
  })
}

function submit() {
  const q = trimmedQuery.value
  syncUrl(q)
  void runSearch(q)
}

function clearInput() {
  inputValue.value = ''
  syncUrl('')
  // Effacement = on revient à la vue d'invitation (pas de fetch automatique).
  pins.value = []
  users.value = []
  boards.value = []
  hasSubmitted.value = false
  inputRef.value?.focus()
}

function gotoExplore() {
  const q = trimmedQuery.value
  router.push(q ? { path: '/explore', query: { q } } : { path: '/explore' })
}

function openPin(slug: string) {
  router.push({ path: `/pin/${encodeURIComponent(slug)}` })
}

function openUser(username: string) {
  router.push(`/profile/${encodeURIComponent(username)}`)
}

function openBoard(b: HeaderSearchBoard) {
  router.push(`/profile/${encodeURIComponent(b.ownerUsername)}/board/${b.id}`)
}

onMounted(() => {
  // Si l'URL contient déjà ?q=, on lance UNE fois la recherche (deep-link).
  if (queryParam.value.trim()) {
    void runSearch(queryParam.value.trim())
  }
  // Autofocus champ recherche (input 16px : iOS ne zoome pas).
  requestAnimationFrame(() => inputRef.value?.focus())
})

onActivated(() => {
  // Sur réactivation, on relance la recherche uniquement si l'URL a changé
  // (par ex. après une nouvelle navigation vers /search?q=…).
  const q = queryParam.value.trim()
  if (q && lastFetchedQuery.value !== q) {
    inputValue.value = q
    void runSearch(q)
  }
})

onUnmounted(() => {
  /* rien à nettoyer : plus de timers, plus de listeners. */
})

watch(queryParam, (q) => {
  if (q !== inputValue.value) inputValue.value = q
})

function goBack() {
  const historyLen = typeof window !== 'undefined' ? window.history.length : 0
  if (historyLen > 1) router.back()
  else router.push('/')
}
</script>

<template>
  <div class="w-full min-w-0 px-3 sm:px-6 lg:px-10 xl:px-16 py-4 sm:py-8">
    <AppMobilePageHeader class="lg:hidden" @back="goBack">
      <template #center>
        <HeaderMobileSearchField
          class="w-full min-w-0"
          v-model="inputValue"
          :disabled="loading"
          @submit="submit"
          @clear="clearInput"
        />
      </template>
      <template #trailing>
        <button
          type="button"
          class="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-pink-700 dark:bg-pink-600 text-white shadow-md shadow-pink-700/25 transition hover:bg-pink-800 dark:hover:opacity-90 active:scale-95 disabled:opacity-55 sm:h-11 sm:min-w-[6.25rem] sm:gap-1.5 sm:px-3"
          :aria-label="t('common.search')"
          :disabled="loading || !trimmedQuery"
          @click="submit"
        >
          <PinovaIcon v-if="loading" name="progress_activity" spin class="animate-spin text-[22px] leading-none" aria-hidden="true" />
          <template v-else>
            <PinovaIcon name="search" class="text-[22px] leading-none sm:hidden" aria-hidden="true" />
            <span class="hidden text-sm font-semibold sm:inline">{{ t('common.search') }}</span>
          </template>
        </button>
      </template>
    </AppMobilePageHeader>

    <div class="max-w-3xl mx-auto">
      <header class="mb-5 sm:mb-6 max-lg:hidden">
        <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 dark:text-neutral-100 mb-3">
          {{ t('common.search') }}
        </h1>
        <form class="flex items-stretch gap-2" role="search" @submit.prevent="submit">
          <div
            class="flex flex-1 items-center gap-2 rounded-full border border-neutral-200 bg-white px-4 py-2.5 transition focus-within:border-transparent focus-within:ring-2 focus-within:ring-pink-700 dark:focus-within:ring-pink-600 dark:border-neutral-700 dark:bg-neutral-900"
          >
            <PinovaIcon name="search" class="text-lg text-neutral-400 dark:text-neutral-500" />
            <input
              ref="inputRef"
              v-model="inputValue"
              type="search"
              inputmode="search"
              enterkeyhint="search"
              autocomplete="off"
              autocorrect="off"
              spellcheck="false"
              :placeholder="t('header.search.placeholder')"
              class="min-w-0 flex-1 border-0 bg-transparent text-base text-neutral-900 shadow-none outline-none placeholder:text-neutral-400 focus:ring-0 dark:text-neutral-100"
            />
            <button
              v-if="inputValue"
              type="button"
              class="flex h-7 w-7 shrink-0 items-center justify-center rounded-full text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
              :aria-label="t('common.cancel')"
              @click="clearInput"
            >
              <PinovaIcon name="close" class="text-base" />
            </button>
          </div>
          <button
            type="submit"
            class="flex shrink-0 items-center justify-center gap-1.5 rounded-full bg-pink-700 dark:bg-pink-600 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-pink-800 dark:hover:opacity-90 disabled:opacity-60 sm:px-5"
            :disabled="loading || !trimmedQuery"
          >
            <PinovaIcon v-if="loading" name="progress_activity" spin class="animate-spin text-base leading-none" aria-hidden="true" />
            <PinovaIcon v-else name="search" class="text-base leading-none sm:hidden" aria-hidden="true" />
            <span class="hidden sm:inline">{{ t('common.search') }}</span>
          </button>
        </form>
      </header>

      <div v-if="loading && !hasResults && hasSubmitted" class="flex justify-center py-12">
        <span class="w-8 h-8 border-2 border-pink-700 dark:border-pink-600 border-t-transparent rounded-full animate-spin" />
      </div>

      <template v-else>
        <section
          v-if="users.length"
          aria-labelledby="search-users-heading"
          class="mb-7"
        >
          <h2 id="search-users-heading" class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
            {{ t('header.search.sectionUsers') }}
          </h2>
          <ul class="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <li
              v-for="u in users"
              :key="`user-${u.username}`"
              class="rounded-2xl border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-pink-200 dark:hover:border-pink-800 transition"
            >
              <button
                type="button"
                class="w-full flex items-center gap-3 p-3 text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600 rounded-2xl"
                @click="openUser(u.username)"
              >
                <AvatarDisc
                  :color="u.avatarColor || DEFAULT_AVATAR_COLOR_CLASS"
                  frame-class="w-10 h-10 text-xs shrink-0"
                  text-class="text-white"
                  :has-image="!!u.avatarUrl"
                >
                  <img v-if="u.avatarUrl" :src="u.avatarUrl" alt="" class="w-full h-full object-cover" />
                  <span v-else>{{ (u.displayName || u.username || '?').slice(0, 1).toUpperCase() }}</span>
                </AvatarDisc>
                <div class="min-w-0 flex-1">
                  <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{{ u.displayName }}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{{ u.username }}</p>
                </div>
              </button>
            </li>
          </ul>
        </section>

        <section
          v-if="boards.length"
          aria-labelledby="search-boards-heading"
          class="mb-7"
        >
          <h2 id="search-boards-heading" class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
            {{ t('header.search.sectionBoards') }}
          </h2>
          <ul class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <li
              v-for="b in boards"
              :key="`board-${b.id}`"
              class="rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-pink-200 dark:hover:border-pink-800 transition"
            >
              <button
                type="button"
                class="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600"
                @click="openBoard(b)"
              >
                <div class="aspect-[4/3] grid grid-cols-2 grid-rows-2 gap-px bg-neutral-200 dark:bg-neutral-700">
                  <template v-if="b.previewImages && b.previewImages.length">
                    <img
                      v-for="(src, pi) in b.previewImages.slice(0, 4)"
                      :key="`${b.id}-${pi}`"
                      :src="src"
                      alt=""
                      class="w-full h-full min-h-0 object-cover bg-neutral-100 dark:bg-neutral-800"
                    />
                  </template>
                  <div
                    v-else-if="b.coverImageUrl"
                    class="col-span-2 row-span-2"
                  >
                    <img :src="b.coverImageUrl" :alt="b.name" class="w-full h-full object-cover bg-neutral-100 dark:bg-neutral-800" />
                  </div>
                  <div
                    v-else
                    class="col-span-2 row-span-2 flex items-center justify-center bg-gradient-to-br from-pink-100 to-neutral-100 dark:from-pink-950/50 dark:to-neutral-900"
                  >
                    <PinovaIcon name="collections" class="text-3xl text-pink-700 dark:text-pink-600 opacity-90" />
                  </div>
                </div>
                <div class="p-3">
                  <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{{ b.name }}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{{ b.ownerUsername }}</p>
                  <p class="text-[11px] font-semibold text-pink-700 dark:text-pink-600 mt-1">
                    {{ t('header.search.boardPinsCount', { count: b.pinCount }) }}
                  </p>
                </div>
              </button>
            </li>
          </ul>
        </section>

        <section
          v-if="pins.length"
          aria-labelledby="search-pins-heading"
          class="mb-7"
        >
          <h2 id="search-pins-heading" class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
            {{ t('header.search.sectionPins') }}
          </h2>
          <ul class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <li
              v-for="pin in pins"
              :key="`pin-${pin.id}`"
              class="rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900 hover:border-pink-200 dark:hover:border-pink-800 transition"
            >
              <button
                type="button"
                class="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600"
                @click="openPin(pin.slug)"
              >
                <div class="aspect-[3/4] bg-neutral-100 dark:bg-neutral-800">
                  <img
                    v-if="pin.imageUrl"
                    :src="pin.imageUrl"
                    :alt="pin.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="p-3">
                  <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">{{ pin.title }}</p>
                  <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate mt-0.5">@{{ pin.username }}</p>
                </div>
              </button>
            </li>
          </ul>
        </section>

        <section
          v-if="showRecommended"
          aria-labelledby="search-reco-heading"
          class="mb-7"
        >
          <h2 id="search-reco-heading" class="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400 mb-2">
            {{ t('header.search.sectionForYou') }}
          </h2>
          <ul class="grid grid-cols-2 sm:grid-cols-3 gap-3">
            <li
              v-for="pin in recommended"
              :key="`reco-${pin.id}`"
              class="rounded-2xl overflow-hidden border border-neutral-200/70 dark:border-neutral-800 bg-white dark:bg-neutral-900"
            >
              <button
                type="button"
                class="w-full text-left focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600"
                @click="openPin(pin.slug)"
              >
                <div class="aspect-[3/4] bg-neutral-100 dark:bg-neutral-800">
                  <img
                    v-if="pin.imageUrl"
                    :src="pin.imageUrl"
                    :alt="pin.title"
                    class="w-full h-full object-cover"
                    loading="lazy"
                  />
                </div>
                <div class="p-3">
                  <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 line-clamp-2">{{ pin.title }}</p>
                  <p class="text-[11px] text-pink-700 dark:text-pink-600 font-semibold mt-0.5">
                    {{ t('header.search.forYouBadge') }}
                  </p>
                </div>
              </button>
            </li>
          </ul>
        </section>

        <!-- Aucun résultat : on a soumis une recherche mais rien n'est revenu. -->
        <div
          v-if="!loading && hasSubmitted && !hasResults"
          class="rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 p-8 text-center"
        >
          <PinovaIcon name="search_off" class="text-4xl text-neutral-300 dark:text-neutral-600 mb-2" />
          <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1">
            {{ t('header.search.empty') }}
          </p>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            {{ t('search.tryOther') }}
          </p>
          <button
            type="button"
            class="px-4 py-2 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-sm font-semibold hover:bg-pink-800 dark:hover:opacity-90 transition"
            @click="gotoExplore"
          >
            {{ t('header.search.openExplore') }}
          </button>
        </div>

        <!-- État initial : on n'a encore rien soumis ; on invite l'utilisateur à taper. -->
        <div
          v-else-if="!loading && !hasSubmitted && !showRecommended"
          class="rounded-2xl border border-dashed border-neutral-200 dark:border-neutral-700 bg-white/50 dark:bg-neutral-900/40 p-8 text-center"
        >
          <PinovaIcon name="search" class="text-4xl text-neutral-300 dark:text-neutral-600 mb-2" />
          <p class="text-sm text-neutral-600 dark:text-neutral-300">
            {{ t('search.promptHint') }}
          </p>
        </div>
      </template>
    </div>
  </div>
</template>
