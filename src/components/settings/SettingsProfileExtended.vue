<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from '../../i18n'
import api from '../../api/index'
import SearchableSelect from '../SearchableSelect.vue'
import {
  REFERENCE_INTERESTS,
  REFERENCE_ACCENT_COLORS,
  interestLabel,
  accentLabel,
  detectBrowserTimezone,
  type InterestRef,
} from '../../data/reference'
import { fetchReferenceInterests } from '../../lib/fetchReferenceInterests'
import { useAppearance, applyAccentColor, syncAppearanceFromProfile } from '../../composables/useAppearance'
import { profileExtendedToApiPayload } from '../../utils/mapProfileExtended'
import FotoceButton from '../ui/FotoceButton.vue'

const props = defineProps<{ section: 'social' | 'personalization' | 'presence' }>()

const { currentUser, fetchCurrentUser } = useAuth()
const { t, currentLang } = useI18n()
const { preference, setPreference } = useAppearance()

const selectedInterests = ref<string[]>([])
const interestOptions = ref<InterestRef[]>([...REFERENCE_INTERESTS])
const presenceStatus = ref('available')
const allowAiTranslation = ref(true)
const accentColor = ref('rose')
const dateFormat = ref('auto')
const timezone = ref('')
const saving = ref(false)
const saved = ref(false)

const saveButtonLabel = computed(() => {
  if (saving.value) return t('common.saving')
  if (saved.value) return t('common.savedCheck')
  return t('common.save')
})

const presenceOptions = computed(() => [
  { value: 'available', label: t('profile.presence.available') },
  { value: 'busy', label: t('profile.presence.busy') },
  { value: 'invisible', label: t('profile.presence.invisible') },
])

watch(
  currentUser,
  (u) => {
    if (!u) return
    selectedInterests.value = [...(u.interests || [])]
    presenceStatus.value = u.presenceStatus || 'available'
    allowAiTranslation.value = u.allowAiTranslation ?? true
    accentColor.value = u.accentColor || 'rose'
    dateFormat.value = u.dateFormat || 'auto'
    timezone.value = u.timezone || detectBrowserTimezone()
  },
  { immediate: true },
)

onMounted(() => {
  void fetchReferenceInterests(currentLang.value).then((rows) => {
    interestOptions.value = rows
  })
})

watch(currentLang, (lang) => {
  void fetchReferenceInterests(lang, true).then((rows) => {
    interestOptions.value = rows
  })
})

async function save() {
  if (!currentUser.value) return
  saving.value = true
  saved.value = false
  try {
    const form = new FormData()
    Object.entries(
      profileExtendedToApiPayload({
        interests: selectedInterests.value,
        presenceStatus: presenceStatus.value as 'available' | 'busy' | 'invisible',
        allowAiTranslation: allowAiTranslation.value,
        accentColor: accentColor.value,
        dateFormat: dateFormat.value,
        timezone: timezone.value,
        themeMode: preference.value,
      }),
    ).forEach(([k, v]) => {
      if (Array.isArray(v)) form.append(k, JSON.stringify(v))
      else if (typeof v === 'boolean') form.append(k, v ? 'true' : 'false')
      else form.append(k, String(v))
    })
    form.append('theme_mode', preference.value)
    await api.patch('me/', form, { headers: { 'Content-Type': 'multipart/form-data' } })
    applyAccentColor(accentColor.value)
    syncAppearanceFromProfile(preference.value)
    await fetchCurrentUser({ force: true })
    saved.value = true
  } finally {
    saving.value = false
  }
}

function toggleInterest(slug: string) {
  const s = new Set(selectedInterests.value)
  if (s.has(slug)) s.delete(slug)
  else s.add(slug)
  selectedInterests.value = [...s]
}
</script>

<template>
  <div v-if="section === 'social'" class="space-y-4">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.profileExtended.socialDiscovery') }}</h3>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in interestOptions"
        :key="item.slug"
        type="button"
        class="rounded-full px-3 py-1.5 text-sm border transition-colors"
        :class="
          selectedInterests.includes(item.slug)
            ? 'bg-pink-700 dark:bg-pink-600 text-white border-pink-700 dark:border-pink-600'
            : 'border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:border-pink-400 dark:hover:border-pink-600'
        "
        @click="toggleInterest(item.slug)"
      >
        {{ interestLabel(item, currentLang) }}
      </button>
    </div>
    <FotoceButton variant="primary" size="sm" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </FotoceButton>
  </div>

  <div v-else-if="section === 'personalization'" class="space-y-4">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.nav.personalization') }}</h3>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="m in (['light', 'dark', 'system'] as const)"
        :key="m"
        type="button"
        class="rounded-xl px-4 py-2 border text-sm transition-colors"
        :class="
          preference === m
            ? 'border-pink-700 dark:border-pink-600 bg-pink-50 dark:bg-pink-950/40 text-pink-800 dark:text-pink-300 font-semibold'
            : 'border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:border-pink-400 dark:hover:border-pink-600'
        "
        @click="setPreference(m)"
      >
        {{ t(`onboarding.theme.${m}`) }}
      </button>
    </div>
    <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.personalization.accent') }}</p>
    <div class="flex flex-wrap gap-3">
      <button
        v-for="ac in REFERENCE_ACCENT_COLORS"
        :key="ac.id"
        type="button"
        class="h-10 w-10 rounded-full ring-2 ring-offset-2 ring-offset-white dark:ring-offset-neutral-900"
        :class="accentColor === ac.id ? 'ring-pink-700 dark:ring-pink-500' : 'ring-transparent'"
        :style="{ backgroundColor: ac.hex }"
        :title="accentLabel(ac, currentLang)"
        @click="accentColor = ac.id"
      />
    </div>
    <label class="flex items-center gap-3 text-sm text-neutral-700 dark:text-neutral-200 cursor-pointer">
      <input v-model="allowAiTranslation" type="checkbox" class="rounded border-neutral-300 dark:border-neutral-600 text-pink-700 focus:ring-pink-700 dark:bg-neutral-900" />
      <span>{{ t('settings.personalization.autoTranslate') }}</span>
    </label>
    <FotoceButton variant="primary" size="sm" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </FotoceButton>
  </div>

  <div v-else-if="section === 'presence'" class="space-y-4">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.nav.presence') }}</h3>
    <SearchableSelect
      v-model="presenceStatus"
      :options="presenceOptions"
      :placeholder="t('profile.presence.available')"
    />
    <FotoceButton variant="primary" size="sm" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </FotoceButton>
  </div>
</template>
