<script setup lang="ts">
import { ref, watch, computed, nextTick, onMounted, onUnmounted } from 'vue'
import { useI18n } from '../i18n'
import { fetchMentionUsersPage, type SuggestUserRow } from '../composables/useUserSuggestSearch'
import { displayInitials } from '../utils/displayInitials'
import AvatarDisc from './AvatarDisc.vue'
import PinovaModal from './ui/PinovaModal.vue'
import PinovaButton from './ui/PinovaButton.vue'

type InviteDisambiguationRow = { username: string; display_name: string }

const props = defineProps<{
  modelValue: boolean
  title: string
  message: string
  inputPlaceholder: string
  /** Plusieurs comptes avec le même nom affiché — choix explicite (pseudo sous le nom). */
  disambiguationRows?: InviteDisambiguationRow[] | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
  (e: 'pick', username: string): void
}>()

const { t } = useI18n()

const searchQuery = ref('')
const results = ref<SuggestUserRow[]>([])
const loading = ref(false)
const nextUrl = ref<string | null>(null)
const page = ref(1)
const selectedIndex = ref(0)
const listEl = ref<HTMLElement | null>(null)
const inputRef = ref<HTMLInputElement | null>(null)

let debounceTimer: ReturnType<typeof setTimeout> | null = null

const PAGE_SIZE = 12

const hasNext = computed(() => !!nextUrl.value)

function close() {
  emit('update:modelValue', false)
}

async function loadUsers(reset: boolean) {
  if (loading.value) return
  if (!reset && !hasNext.value) return
  loading.value = true
  if (reset) {
    page.value = 1
    nextUrl.value = null
    results.value = []
    selectedIndex.value = 0
  }
  try {
    const { users, nextUrl: n } = await fetchMentionUsersPage(searchQuery.value.trim(), page.value, PAGE_SIZE)
    if (reset) {
      results.value = users
    } else {
      const seen = new Set(results.value.map((r) => r.username))
      for (const u of users) {
        if (!seen.has(u.username)) {
          seen.add(u.username)
          results.value.push(u)
        }
      }
    }
    nextUrl.value = n
    if (n) page.value += 1
    selectedIndex.value = Math.min(selectedIndex.value, Math.max(0, results.value.length - 1))
  } finally {
    loading.value = false
  }
}

function scheduleSearch() {
  if (debounceTimer) clearTimeout(debounceTimer)
  debounceTimer = setTimeout(() => {
    void loadUsers(true)
  }, 200)
}

watch(
  () => props.modelValue,
  (open) => {
    if (!open) {
      searchQuery.value = ''
      results.value = []
      nextUrl.value = null
      selectedIndex.value = 0
      return
    }
    searchQuery.value = ''
    nextTick(() => {
      inputRef.value?.focus()
      void loadUsers(true)
    })
  },
)

watch(searchQuery, () => {
  if (!props.modelValue) return
  scheduleSearch()
})

function relationLabel(rel: string) {
  if (rel === 'mutual') return t('userSuggest.relation.mutual')
  if (rel === 'following') return t('userSuggest.relation.following')
  if (rel === 'follower') return t('userSuggest.relation.follower')
  if (rel === 'often_viewed') return t('userSuggest.relation.oftenViewed')
  return ''
}

function pickUser(username: string) {
  emit('pick', username)
}

function onKeydown(e: KeyboardEvent) {
  if (!props.modelValue) return
  /* Escape : géré par PinovaModal — on n'intercepte plus pour éviter le double-handling. */
  if (!results.value.length && e.key !== 'Tab') return
  if (e.key === 'ArrowDown') {
    e.preventDefault()
    selectedIndex.value = Math.min(results.value.length - 1, selectedIndex.value + 1)
    scrollIntoViewSelected()
    return
  }
  if (e.key === 'ArrowUp') {
    e.preventDefault()
    selectedIndex.value = Math.max(0, selectedIndex.value - 1)
    scrollIntoViewSelected()
    return
  }
  if (e.key === 'Enter') {
    e.preventDefault()
    const row = results.value[selectedIndex.value]
    if (row) pickUser(row.username)
  }
}

function scrollIntoViewSelected() {
  nextTick(() => {
    const root = listEl.value
    if (!root) return
    const row = root.querySelector<HTMLElement>(`[data-row-index="${selectedIndex.value}"]`)
    row?.scrollIntoView({ block: 'nearest' })
  })
}

function onListScroll(ev: Event) {
  const el = ev.target as HTMLElement
  if (!el || loading.value || !hasNext.value) return
  const nearBottom = el.scrollTop + el.clientHeight >= el.scrollHeight - 24
  if (nearBottom) void loadUsers(false)
}

onMounted(() => window.addEventListener('keydown', onKeydown))
onUnmounted(() => window.removeEventListener('keydown', onKeydown))
</script>

<template>
  <PinovaModal
    :open="modelValue"
    presentation="tallSheet"
    presentation-lg="center"
    :title="title"
    :subtitle="message"
    :max-width="480"
    @update:open="(v: boolean) => emit('update:modelValue', v)"
    @opened="() => inputRef?.focus()"
  >
    <div class="px-4 pt-2 pb-2">
      <div class="app-input-surface flex items-center gap-2 rounded-2xl px-3 py-2.5 transition">
        <PinovaIcon name="person_search" class="text-neutral-400 text-xl" />
        <input
          ref="inputRef"
          v-model="searchQuery"
          type="search"
          autocomplete="off"
          class="flex-1 min-w-0 bg-transparent text-sm outline-none text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400"
          :placeholder="inputPlaceholder"
        />
      </div>
      <p class="mt-2 text-[11px] text-neutral-400 text-center">
        {{ t('modal.prompt.hint') }}
      </p>
    </div>

    <div
      ref="listEl"
      class="min-h-[200px] max-h-[min(320px,50vh)] overflow-y-auto px-3 py-2"
      role="listbox"
      :aria-activedescendant="results[selectedIndex] ? `invite-pick-${selectedIndex}` : undefined"
      @scroll="onListScroll"
    >
      <div
        v-if="disambiguationRows && disambiguationRows.length"
        class="mb-3 px-2 py-2 rounded-2xl bg-pink-50/90 dark:bg-pink-950/35 border border-pink-200/70 dark:border-pink-800/60"
      >
        <p class="text-[11px] font-semibold text-pink-700 dark:text-pink-600 leading-snug mb-2">
          {{ t('userSuggest.disambiguationHint') }}
        </p>
        <button
          v-for="row in disambiguationRows"
          :key="`dis-${row.username}`"
          type="button"
          class="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-left transition border border-transparent app-menu-item mb-1 last:mb-0"
          @click="pickUser(row.username)"
        >
          <AvatarDisc
            color="bg-pink-700 dark:bg-pink-600"
            frame-class="w-10 h-10 text-xs"
            text-class="text-white"
            :has-image="false"
          >
            <span class="avatar-text">{{ displayInitials(row.display_name || row.username) }}</span>
          </AvatarDisc>
          <div class="flex-1 min-w-0">
            <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">
              {{ row.display_name || row.username }}
            </p>
            <p class="text-xs text-neutral-500 truncate">@{{ row.username }}</p>
          </div>
        </button>
      </div>
      <div v-if="loading && results.length === 0" class="flex justify-center py-12">
        <span class="w-8 h-8 border-2 border-pink-700 dark:border-pink-600 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      </div>
      <p v-else-if="!loading && results.length === 0" class="text-center text-sm text-neutral-500 py-10 px-4">
        {{ t('userSuggest.empty') }}
      </p>
      <button
        v-for="(user, idx) in results"
        :id="`invite-pick-${idx}`"
        :key="user.username"
        type="button"
        role="option"
        :data-row-index="idx"
        class="w-full flex items-center gap-3 px-3 py-2.5 rounded-2xl text-left transition border border-transparent app-menu-item"
        :class="idx === selectedIndex ? 'is-active ring-1 ring-pink-300/70 dark:ring-pink-600/45 shadow-sm' : ''"
        @click="pickUser(user.username)"
        @mouseenter="selectedIndex = idx"
      >
        <AvatarDisc
          :color="user.avatarColor"
          frame-class="w-10 h-10 text-xs"
          text-class="text-white"
          :has-image="!!user.avatarUrl"
        >
          <img v-if="user.avatarUrl" :src="user.avatarUrl" alt="" class="w-full h-full object-cover" />
          <span v-else class="avatar-text">{{ displayInitials(user.name) }}</span>
        </AvatarDisc>
        <div class="flex-1 min-w-0">
          <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{{ user.name }}</p>
          <p class="text-xs text-neutral-500 truncate">@{{ user.username }}</p>
          <p v-if="relationLabel(user.relation)" class="text-[10px] font-semibold text-pink-700 mt-0.5 truncate">
            {{ relationLabel(user.relation) }}
          </p>
        </div>
      </button>
      <div v-if="loading && results.length > 0" class="flex justify-center py-3">
        <span class="w-5 h-5 border-2 border-pink-700 border-t-transparent rounded-full animate-spin" aria-hidden="true" />
      </div>
    </div>

    <template #footer>
      <div class="flex justify-end gap-2 px-2">
        <PinovaButton variant="secondary" size="sm" @click="close">
          {{ t('common.cancel') }}
        </PinovaButton>
      </div>
    </template>
  </PinovaModal>
</template>
