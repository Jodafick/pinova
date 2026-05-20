<script setup lang="ts">
import { ref, watch, computed } from 'vue'
import { useAuth } from '../../composables/useAuth'
import { useI18n } from '../../i18n'
import api from '../../api'
import {
  REFERENCE_COUNTRIES,
  REFERENCE_INTERESTS,
  REFERENCE_ACCENT_COLORS,
  REFERENCE_GENDERS,
  REFERENCE_PRONOUNS,
  countryLabel,
  citiesForCountry,
  cityLabel,
  interestLabel,
  genderLabel,
  pronounLabel,
  accentLabel,
  detectBrowserTimezone,
} from '../../data/reference'
import { useAppearance, applyAccentColor, syncAppearanceFromProfile } from '../../composables/useAppearance'
import { profileExtendedToApiPayload } from '../../utils/mapProfileExtended'

const props = defineProps<{ section: 'social' | 'personalization' | 'presence' | 'identity' }>()

const { currentUser, fetchCurrentUser } = useAuth()
const { t, currentLang } = useI18n()
const { preference, setPreference } = useAppearance()

const firstName = ref('')
const lastName = ref('')
const city = ref('')
const countryCode = ref('')
const cityId = ref('')
const jobTitle = ref('')
const school = ref('')
const company = ref('')
const website = ref('')
const gender = ref('')
const pronouns = ref('')
const favoriteQuote = ref('')
const selectedInterests = ref<string[]>([])
const presenceStatus = ref('available')
const allowAiTranslation = ref(true)
const accentColor = ref('rose')
const dateFormat = ref('auto')
const timezone = ref('')
const saving = ref(false)
const saved = ref(false)

const cityOptions = computed(() => citiesForCountry(countryCode.value))

const saveButtonLabel = computed(() => {
  if (saving.value) return t('common.saving')
  if (saved.value) return t('common.savedCheck')
  return t('common.save')
})

watch(
  currentUser,
  (u) => {
    if (!u) return
    firstName.value = u.firstName || ''
    lastName.value = u.lastName || ''
    city.value = u.city || ''
    countryCode.value = u.countryCode || ''
    jobTitle.value = u.jobTitle || ''
    school.value = u.school || ''
    company.value = u.company || ''
    website.value = u.website || ''
    gender.value = u.gender || ''
    pronouns.value = u.pronouns || ''
    favoriteQuote.value = u.favoriteQuote || ''
    selectedInterests.value = [...(u.interests || [])]
    presenceStatus.value = u.presenceStatus || 'available'
    allowAiTranslation.value = u.allowAiTranslation ?? true
    accentColor.value = u.accentColor || 'rose'
    dateFormat.value = u.dateFormat || 'auto'
    timezone.value = u.timezone || detectBrowserTimezone()
  },
  { immediate: true },
)

async function save() {
  if (!currentUser.value) return
  saving.value = true
  saved.value = false
  try {
    const pickedCity = cityOptions.value.find((c) => c.id === cityId.value)
    const cityName = pickedCity ? cityLabel(pickedCity, currentLang.value) : city.value
    const country = REFERENCE_COUNTRIES.find((c) => c.code === countryCode.value)
    const form = new FormData()
    Object.entries(
      profileExtendedToApiPayload({
        firstName: firstName.value,
        lastName: lastName.value,
        city: cityName,
        jobTitle: jobTitle.value,
        school: school.value,
        company: company.value,
        website: website.value,
        gender: gender.value,
        pronouns: pronouns.value,
        favoriteQuote: favoriteQuote.value,
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
    if (countryCode.value) form.append('country_code', countryCode.value)
    if (country?.currency) form.append('preferred_currency', country.currency)
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
  <div v-if="section === 'identity'" class="space-y-4">
    <h3 class="text-lg font-semibold text-neutral-900 dark:text-white">{{ t('settings.profileExtended.identity') }}</h3>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block">
        <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.firstName') }}</span>
        <input v-model="firstName" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
      </label>
      <label class="block">
        <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.lastName') }}</span>
        <input v-model="lastName" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
      </label>
    </div>
    <label class="block">
      <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.jobTitle') }}</span>
      <input v-model="jobTitle" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
    </label>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block">
        <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.school') }}</span>
        <input v-model="school" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
      </label>
      <label class="block">
        <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.company') }}</span>
        <input v-model="company" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
      </label>
    </div>
    <label class="block">
      <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.website') }}</span>
      <input v-model="website" type="url" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
    </label>
    <div class="grid grid-cols-1 md:grid-cols-2 gap-3">
      <label class="block">
        <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.gender') }}</span>
        <select v-model="gender" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900">
          <option v-for="g in REFERENCE_GENDERS" :key="g.id" :value="g.id">{{ genderLabel(g, currentLang) }}</option>
        </select>
      </label>
      <label class="block">
        <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.pronouns') }}</span>
        <select v-model="pronouns" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900">
          <option v-for="p in REFERENCE_PRONOUNS" :key="p.id" :value="p.id">{{ pronounLabel(p, currentLang) }}</option>
        </select>
      </label>
    </div>
    <label class="block">
      <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('profile.field.favoriteQuote') }}</span>
      <input v-model="favoriteQuote" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900" />
    </label>
    <label class="block">
      <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('onboarding.countryLabel') }}</span>
      <select v-model="countryCode" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900">
        <option value="">{{ t('common.selectEmpty') }}</option>
        <option v-for="c in REFERENCE_COUNTRIES" :key="c.code" :value="c.code">
          {{ c.flag }} {{ countryLabel(c, currentLang) }}
        </option>
      </select>
    </label>
    <label v-if="cityOptions.length" class="block">
      <span class="text-sm text-neutral-600 dark:text-neutral-400">{{ t('onboarding.cityLabel') }}</span>
      <select v-model="cityId" class="mt-1 w-full rounded-xl border px-3 py-2 dark:bg-neutral-900">
        <option value="">{{ t('common.selectEmpty') }}</option>
        <option v-for="ct in cityOptions" :key="ct.id" :value="ct.id">{{ cityLabel(ct, currentLang) }}</option>
      </select>
    </label>
    <button type="button" class="rounded-xl bg-rose-500 text-white px-5 py-2.5 font-medium" :disabled="saving" @click="save">
      {{ saveButtonLabel }}
    </button>
  </div>

  <div v-else-if="section === 'social'" class="space-y-4">
    <h3 class="text-lg font-semibold">{{ t('settings.profileExtended.socialDiscovery') }}</h3>
    <div class="flex flex-wrap gap-2">
      <button
        v-for="item in REFERENCE_INTERESTS"
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
