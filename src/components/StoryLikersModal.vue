<script setup lang="ts">
import { ref, watch } from 'vue'
import { RouterLink } from 'vue-router'
import { usePins } from '../composables/usePins'
import { DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { displayInitials } from '../utils/displayInitials'
import AvatarDisc from './AvatarDisc.vue'
import type { PinLikerEntry } from '../types'

const props = defineProps<{
  modelValue: boolean
  pinSlug: string | null
}>()

const emit = defineEmits<{
  (e: 'update:modelValue', v: boolean): void
}>()

const { fetchPinLikers } = usePins()
const { t, currentLang } = useI18n()

const loading = ref(false)
const errorMsg = ref('')
const likers = ref<PinLikerEntry[]>([])
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
  () => [props.modelValue, props.pinSlug] as const,
  async ([open, slug]) => {
    if (!open || !slug) return
    loading.value = true
    errorMsg.value = ''
    likers.value = []
    total.value = 0
    try {
      const data = await fetchPinLikers(slug)
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
  <Teleport to="body">
    <div
      v-if="modelValue && pinSlug"
      class="fixed inset-0 z-[200] flex items-end sm:items-center justify-center px-4 py-10 sm:p-6 bg-black/55 backdrop-blur-sm"
      role="dialog"
      aria-modal="true"
      @click.self="close"
    >
      <div
        class="w-full max-w-md rounded-2xl bg-white shadow-2xl overflow-hidden flex flex-col max-h-[min(70vh,520px)] border border-neutral-100"
        @click.stop
      >
        <div class="flex items-center justify-between gap-2 px-4 py-3 border-b border-neutral-100">
          <h2 class="text-sm font-semibold text-neutral-900">
            {{ t('story.likers.title', { count: total }) }}
          </h2>
          <button
            type="button"
            class="p-2 rounded-full hover:bg-neutral-100 text-neutral-600 transition"
            :aria-label="t('story.likers.close')"
            @click="close"
          >
            <span class="material-symbols-outlined text-[22px]">close</span>
          </button>
        </div>

        <div class="flex-1 min-h-0 overflow-y-auto px-3 py-2">
          <p v-if="loading" class="text-sm text-neutral-500 text-center py-8">{{ t('story.likers.loading') }}</p>
          <p v-else-if="errorMsg" class="text-sm text-red-600 text-center py-6">{{ errorMsg }}</p>
          <p v-else-if="!likers.length" class="text-sm text-neutral-500 text-center py-8">{{ t('story.likers.empty') }}</p>
          <ul v-else class="divide-y divide-neutral-100">
            <li v-for="row in likers" :key="row.username">
              <RouterLink
                :to="`/profile/${encodeURIComponent(row.username)}`"
                class="flex items-center gap-3 py-3 px-1 hover:bg-neutral-50 rounded-xl transition"
                @click="close"
              >
                <AvatarDisc
                  :color="row.avatar_url ? undefined : (row.avatar_color || DEFAULT_AVATAR_COLOR_CLASS)"
                  frame-class="relative h-10 w-10 text-xs ring-2 ring-neutral-100 shrink-0"
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
                  <p class="text-sm font-semibold text-neutral-900 truncate">{{ row.display_name }}</p>
                  <p class="text-xs text-neutral-500 truncate">@{{ row.username }}</p>
                </div>
                <span class="text-[10px] text-neutral-400 shrink-0 tabular-nums">{{ formatWhen(row.liked_at) }}</span>
              </RouterLink>
            </li>
          </ul>
        </div>
      </div>
    </div>
  </Teleport>
</template>
