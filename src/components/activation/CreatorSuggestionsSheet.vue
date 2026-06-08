<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import api from '../../api/index'
import AvatarDisc from '../AvatarDisc.vue'
import PinovaModal from '../ui/PinovaModal.vue'
import PinovaButton from '../ui/PinovaButton.vue'
import { useI18n } from '../../i18n'
import { useAuth } from '../../composables/useAuth'
import { useActivationFunnel } from '../../composables/useActivationFunnel'
import { trackEvent, trackOnce } from '../../lib/analytics'
import { closeCreatorSuggestions } from '../../composables/useActivationMoments'
import { getFullMediaUrl } from '../../composables/usePins'

type CreatorRow = {
  username: string
  display_name?: string
  avatar?: string | null
  avatar_color?: string
  followers_count?: number
  reason?: string
}

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{ 'update:open': [boolean] }>()

const { t } = useI18n()
const { currentUser } = useAuth()
const { addMilestones } = useActivationFunnel()

const rows = ref<CreatorRow[]>([])
const loading = ref(false)
const following = ref<Record<string, boolean>>({})
const followedCount = ref(0)

const goal = 3

async function loadSuggestions() {
  loading.value = true
  try {
    const interests = currentUser.value?.interests ?? []
    const country = currentUser.value?.countryCode ?? ''
    const { data } = await api.get<{ results: CreatorRow[] }>('users/follow-suggestions/', {
      params: {
        interests: JSON.stringify(interests),
        country_code: country,
      },
    })
    rows.value = Array.isArray(data.results) ? data.results.slice(0, 12) : []
  } catch {
    rows.value = []
  } finally {
    loading.value = false
  }
}

watch(
  () => props.open,
  (v) => {
    if (!v) return
    trackOnce('creator_suggestions_opened', { surface: 'web' })
    void loadSuggestions()
  },
)

onMounted(() => {
  if (props.open) void loadSuggestions()
})

const canFinish = computed(() => followedCount.value >= goal)

async function followRow(row: CreatorRow) {
  if (following.value[row.username]) return
  following.value[row.username] = true
  try {
    await api.post(`profiles/${row.username}/follow/`)
    followedCount.value += 1
    trackEvent('creator_followed_after_first_pin', { username: row.username })
    if (followedCount.value >= goal) {
      await addMilestones('creator_discovery_done', 'first_follow_obtained')
      trackEvent('creator_level_progressed', { level: 1, milestone: 'creator_discovery_done' })
    }
  } catch {
  } finally {
    following.value[row.username] = false
  }
}

function skip() {
  emit('update:open', false)
  closeCreatorSuggestions()
}

async function done() {
  if (followedCount.value > 0) {
    await addMilestones('creator_discovery_done')
  }
  emit('update:open', false)
  closeCreatorSuggestions()
}
</script>

<template>
  <PinovaModal
    :open="open"
    presentation="tallSheet"
    :title="t('activation.suggestions.title')"
    :subtitle="t('activation.suggestions.subtitle', { goal })"
    handle
    @update:open="emit('update:open', $event)"
  >
    <p v-if="loading" class="text-sm text-neutral-500 py-6 text-center">{{ t('common.loading') }}</p>
    <ul v-else class="space-y-2 pb-2">
      <li
        v-for="row in rows"
        :key="row.username"
        class="flex items-center gap-3 rounded-2xl border border-neutral-200 dark:border-neutral-700 px-3 py-2.5"
      >
        <AvatarDisc
          :color="row.avatar_color"
          frame-class="w-10 h-10 text-xs"
          text-class="text-white"
          :has-image="!!row.avatar"
        >
          <img
            v-if="row.avatar"
            :src="getFullMediaUrl(row.avatar)"
            alt=""
            class="w-full h-full object-cover"
          />
          <span v-else>{{ row.username.slice(0, 2).toUpperCase() }}</span>
        </AvatarDisc>
        <div class="min-w-0 flex-1">
          <p class="text-sm font-semibold truncate">{{ row.display_name || row.username }}</p>
          <p class="text-xs text-neutral-500 truncate">@{{ row.username }}</p>
          <p v-if="row.followers_count != null" class="text-[11px] text-neutral-400">
            {{ t('activation.suggestions.followers', { count: row.followers_count }) }}
          </p>
        </div>
        <PinovaButton
          variant="secondary"
          size="sm"
          :loading="!!following[row.username]"
          @click="followRow(row)"
        >
          {{ t('pin.follow') }}
        </PinovaButton>
      </li>
    </ul>

    <template #footer>
      <div class="flex flex-col gap-2 w-full">
        <p class="text-center text-xs text-neutral-500">
          {{ t('activation.suggestions.progress', { count: followedCount, goal }) }}
        </p>
        <PinovaButton v-if="canFinish" variant="primary" block @click="done">
          {{ t('activation.suggestions.done') }}
        </PinovaButton>
        <PinovaButton variant="secondary" block @click="skip">
          {{ t('activation.suggestions.skip') }}
        </PinovaButton>
      </div>
    </template>
  </PinovaModal>
</template>
