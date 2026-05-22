<script setup lang="ts">
import { ref, watch, computed, onMounted } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from '../../i18n'
import api from '../../api'
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
    <h3 class="text-lg font-semibold">{{ t('settings.profileExtended.socialDiscovery') }}</h3>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in interestOptions"
        :key="item.slug"
        type="button"
        class="rounded-full px-3 py-1.5 text-sm border"
        :class="selectedInterests.includes(item.slug) ? 'bg-rose-500 text-white border-rose-500' : 'border-neutral-300 dark:border-neutral-600'"
        @click="toggleInterest(item.slug)"
      >
        {{ interestLabel(item, currentLang) }}
      </button>
    </div>
    <button type="button" class="rounded-xl bg-rose-500 text-white px-5 py-2.5" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </button>
  </div>

  <div v-else-if="section === 'personalization'" class="space-y-4">
    <h3 class="text-lg font-semibold">{{ t('settings.nav.personalization') }}</h3>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="m in (['light', 'dark', 'system'] as const)"
        :key="m"
        type="button"
        class="rounded-xl px-4 py-2 border"
        :class="preference === m ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30' : ''"
        @click="setPreference(m)"
      >
        {{ t(`onboarding.theme.${m}`) }}
      </button>
    </div>
    <p class="text-sm font-medium">{{ t('settings.personalization.accent') }}</p>
    <div class="flex flex-wrap gap-3">
      <button
        v-for="ac in REFERENCE_ACCENT_COLORS"
        :key="ac.id"
        type="button"
        class="h-10 w-10 rounded-full ring-2 ring-offset-2"
        :class="accentColor === ac.id ? 'ring-rose-500' : 'ring-transparent'"
        :style="{ backgroundColor: ac.hex }"
        :title="accentLabel(ac, currentLang)"
        @click="accentColor = ac.id"
      />
    </div>
    <label class="flex items-center gap-3">
      <input v-model="allowAiTranslation" type="checkbox" class="rounded" />
      <span>{{ t('settings.personalization.autoTranslate') }}</span>
    </label>
    <button type="button" class="rounded-xl bg-rose-500 text-white px-5 py-2.5" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </button>
  </div>

  <div v-else-if="section === 'presence'" class="space-y-4">
    <h3 class="text-lg font-semibold">{{ t('settings.nav.presence') }}</h3>
    <select v-model="presenceStatus" class="w-full rounded-xl border px-3 py-2 dark:bg-neutral-900">
      <option value="available">{{ t('profile.presence.available') }}</option>
      <option value="busy">{{ t('profile.presence.busy') }}</option>
      <option value="invisible">{{ t('profile.presence.invisible') }}</option>
    </select>
    <button type="button" class="rounded-xl bg-rose-500 text-white px-5 py-2.5" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </button>
  </div>
</template>
