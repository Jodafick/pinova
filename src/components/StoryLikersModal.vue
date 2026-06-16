<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { useFotos } from '../composables/useFotos'
import { DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { displayInitials } from '../utils/displayInitials'
import AvatarDisc from './AvatarDisc.vue'
import FotoceModal from './ui/FotoceModal.vue'
import type { FotoLikerEntry } from '../types'

const props = defineProps<{
  modelValue: boolean
  fotoSlug: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const { fetchFotoLikers } = useFotos()
const { t, currentLang } = useI18n()

const loading = ref(false)
const errorMsg = ref('')
const likers = ref<FotoLikerEntry[]>([])
const total = ref(0)

function formatWhen(iso: string) {
  try {
    return new Intl.DateTimeFormat(currentLang.value || 'fr', {
      dateStyle: 'short',
      timeStyle: 'short',
    }).format(new Date(iso))
  } catch {
    return iso
  }
}

watch(
  () => [props.modelValue, props.fotoSlug] as const,
  async ([open, slug]) => {
    if (!open || !slug) return
    loading.value = true
    errorMsg.value = ''
    likers.value = []
    total.value = 0
    try {
      const data = await fetchFotoLikers(slug)
      likers.value = data.likers
      total.value = data.count
    } catch {
      errorMsg.value = t('story.likers.loadError')
    } finally {
      loading.value = false
    }
  },
)

function close() {
  emit('update:modelValue', false)
}
</script>

<template>
  <FotoceModal
    :open="modelValue && !!fotoSlug"
    presentation="bottomSheet"
    :title="t('story.likers.title', { count: total })"
    @update:open="(v: boolean) => emit('update:modelValue', v)"
  >
    <div class="px-3 py-2 max-h-[min(60vh,420px)] overflow-y-auto">
      <p v-if="loading" class="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">{{ t('story.likers.loading') }}</p>
      <p v-else-if="errorMsg" class="text-sm text-red-600 text-center py-6">{{ errorMsg }}</p>
      <p v-else-if="!likers.length" class="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">{{ t('story.likers.empty') }}</p>
      <ul v-else class="divide-y divide-neutral-100 dark:divide-neutral-800">
        <li v-for="row in likers" :key="row.username">
          <RouterLink
            :to="`/profile/${encodeURIComponent(row.username)}`"
            class="flex items-center gap-3 py-3 px-2 hover:bg-white/90 dark:hover:bg-neutral-800/60 rounded-2xl transition ring-1 ring-transparent hover:ring-neutral-200/70"
            @click="close"
          >
            <AvatarDisc
              :color="row.avatar_url ? undefined : (row.avatar_color || DEFAULT_AVATAR_COLOR_CLASS)"
              frame-class="relative h-10 w-10 text-xs ring-2 ring-neutral-100 dark:ring-neutral-700 shrink-0"
              text-class="text-white"
              :has-image="!!row.avatar_url"
            >
              <img
                v-if="row.avatar_url"
                :src="row.avatar_url"
                alt=""
                class="h-full w-full object-cover"
                draggable="false"
              />
              <span v-else>{{ displayInitials(row.display_name) }}</span>
            </AvatarDisc>
            <div class="min-w-0 flex-1">
              <p class="text-sm font-semibold text-neutral-900 dark:text-neutral-100 truncate">{{ row.display_name }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 truncate">@{{ row.username }}</p>
            </div>
            <span class="text-[10px] text-neutral-400 shrink-0 tabular-nums">{{ formatWhen(row.liked_at) }}</span>
          </RouterLink>
        </li>
      </ul>
    </div>
  </FotoceModal>
</template>
