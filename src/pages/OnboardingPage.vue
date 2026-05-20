<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n, type AppLang } from '../i18n'
import api from '../api'
import {
  REFERENCE_COUNTRIES,
  REFERENCE_INTERESTS,
  REFERENCE_ACCENT_COLORS,
  countryLabel,
  cityLabel,
  interestLabel,
  accentLabel,
  citiesForCountry,
  detectBrowserTimezone,
} from '../data/reference'
import { useAppearance, applyAccentColor, syncAppearanceFromProfile } from '../composables/useAppearance'
import { fetchMentionUsersPage, type SuggestUserRow } from '../composables/useUserSuggestSearch'
import AvatarDisc from '../components/AvatarDisc.vue'

const STEPS = ['welcome', 'language', 'interests', 'location', 'theme', 'creators', 'done'] as const
type StepId = (typeof STEPS)[number]

const router = useRouter()
const { currentUser, fetchCurrentUser } = useAuth()
const { t, currentLang, setLang } = useI18n()
const { setPreference } = useAppearance()

const stepIndex = ref(0)
const step = computed(() => STEPS[stepIndex.value] ?? 'welcome')
const progress = computed(() => ((stepIndex.value + 1) / STEPS.length) * 100)

const selectedLang = ref<AppLang>((currentLang.value as AppLang) || 'fr')
const selectedInterests = ref<string[]>([])
const countryCode = ref(currentUser.value?.countryCode || '')
const cityId = ref('')
const themePref = ref<'light' | 'dark' | 'system'>('system')
const accentId = ref('rose')
const followedCreators = ref<string[]>([])
const creatorSearch = ref('')
const creatorRows = ref<SuggestUserRow[]>([])
const saving = ref(false)
const errorMsg = ref('')

watch(countryCode, () => {
  cityId.value = ''
})

watch(creatorSearch, async (q) => {
  if (q.trim().length < 2) {
    creatorRows.value = []
    return
  }
  try {
    const { users } = await fetchMentionUsersPage(q.trim(), 1, 12)
    creatorRows.value = users
  } catch {
    creatorRows.value = []
  }
})

function nextStep() {
  if (stepIndex.value < STEPS.length - 1) stepIndex.value += 1
}

function prevStep() {
  if (stepIndex.value > 0) stepIndex.value -= 1
}

function toggleInterest(slug: string) {
  const set = new Set(selectedInterests.value)
  if (set.has(slug)) set.delete(slug)
  else set.add(slug)
  selectedInterests.value = [...set]
}

function toggleCreator(username: string) {
  const set = new Set(followedCreators.value)
  if (set.has(username)) set.delete(username)
  else if (set.size < 12) set.add(username)
  followedCreators.value = [...set]
}

const cityOptions = computed(() => {
  if (!countryCode.value) return []
  return citiesForCountry(countryCode.value)
})

const selectedCityName = computed(() => {
  const c = cityOptions.value.find((x) => x.id === cityId.value)
  return c ? cityLabel(c, selectedLang.value) : ''
})

const canContinue = computed(() => {
  if (step.value === 'interests') return selectedInterests.value.length >= 3
  if (step.value === 'location') return !!countryCode.value
  return true
})

async function finishOnboarding() {
  saving.value = true
  errorMsg.value = ''
  try {
    setLang(selectedLang.value)
    setPreference(themePref.value)
    applyAccentColor(accentId.value)

    const country = REFERENCE_COUNTRIES.find((c) => c.code === countryCode.value)
    const formData = new FormData()
    formData.append('preferred_language', selectedLang.value)
    formData.append('preferred_currency', country?.currency || currentUser.value?.preferredCurrency || 'XOF')
    formData.append('country_code', countryCode.value)
    if (selectedCityName.value) formData.append('city', selectedCityName.value)
    formData.append('interests', JSON.stringify(selectedInterests.value))
    formData.append('followed_onboarding_creators', JSON.stringify(followedCreators.value))
    formData.append('theme_mode', themePref.value)
    formData.append('accent_color', accentId.value)
    formData.append('timezone', detectBrowserTimezone())
    formData.append('complete_onboarding', 'true')

    await api.patch('me/', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    for (const uname of followedCreators.value) {
      try {
        await api.post(`profiles/${uname}/follow/`)
      } catch {
        /* ignore */
      }
    }
    await fetchCurrentUser({ force: true })
    syncAppearanceFromProfile(themePref.value)
    await router.replace({ name: 'home' })
  } catch {
    errorMsg.value = t('onboarding.errorSave')
  } finally {
    saving.value = false
  }
}

function onPrimaryAction() {
  if (step.value === 'done') {
    void finishOnboarding()
    return
  }
  if (!canContinue.value) return
  nextStep()
}
</script>

<template>
  <div
    class="onboarding-root min-h-[100dvh] flex flex-col bg-gradient-to-br from-rose-50 via-white to-violet-50 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-950"
  >
    <div class="h-1 bg-neutral-200/80 dark:bg-neutral-800">
      <div
        class="h-full bg-gradient-to-r from-rose-500 to-violet-500 transition-all duration-500 ease-out"
        :style="{ width: `${progress}%` }"
      />
    </div>

    <div class="flex-1 flex flex-col max-w-3xl mx-auto w-full px-4 sm:px-8 py-6 md:py-10">
      <header class="flex items-center justify-between mb-6 md:mb-10">
        <div class="flex items-center gap-2">
          <img src="/logo.png" alt="Pinova" class="h-9 w-9 rounded-xl shadow-sm" />
          <span class="font-bold text-lg tracking-tight text-neutral-900 dark:text-white">Pinova</span>
        </div>
        <span class="text-xs font-medium text-neutral-500 dark:text-neutral-400 tabular-nums">
          {{ stepIndex + 1 }} / {{ STEPS.length }}
        </span>
      </header>

      <main class="flex-1 flex flex-col">
        <!-- Welcome -->
        <section v-if="step === 'welcome'" class="flex-1 flex flex-col justify-center animate-in fade-in">
          <h1 class="text-3xl md:text-5xl font-bold text-neutral-900 dark:text-white leading-tight">
            {{ t('onboarding.welcomeTitle') }}
          </h1>
          <p class="mt-4 text-base md:text-lg text-neutral-600 dark:text-neutral-300 max-w-xl">
            {{ t('onboarding.welcomeSubtitle') }}
          </p>
          <ul class="mt-8 space-y-3 text-sm md:text-base text-neutral-700 dark:text-neutral-300">
            <li class="flex items-center gap-3">
              <span class="material-symbols-outlined text-rose-500">auto_awesome</span>
              {{ t('onboarding.welcomeBullet1') }}
            </li>
            <li class="flex items-center gap-3">
              <span class="material-symbols-outlined text-violet-500">groups</span>
              {{ t('onboarding.welcomeBullet2') }}
            </li>
            <li class="flex items-center gap-3">
              <span class="material-symbols-outlined text-emerald-500">tune</span>
              {{ t('onboarding.welcomeBullet3') }}
            </li>
          </ul>
        </section>

        <!-- Language -->
        <section v-else-if="step === 'language'" class="flex-1">
          <h2 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
            {{ t('onboarding.languageTitle') }}
          </h2>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">{{ t('onboarding.languageHint') }}</p>
          <div class="mt-8 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              v-for="opt in (['fr', 'en', 'fon'] as const)"
              :key="opt"
              type="button"
              class="rounded-2xl border-2 px-5 py-4 text-left transition-all"
              :class="
                selectedLang === opt
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/40 shadow-md'
                  : 'border-neutral-200 dark:border-neutral-700 hover:border-rose-300'
              "
              @click="selectedLang = opt"
            >
              <span class="font-semibold text-neutral-900 dark:text-white">{{ t(`onboarding.lang.${opt}`) }}</span>
            </button>
          </div>
        </section>

        <!-- Interests -->
        <section v-else-if="step === 'interests'" class="flex-1">
          <h2 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
            {{ t('onboarding.interestsTitle') }}
          </h2>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">
            {{ t('onboarding.interestsHint') }}
            <span class="font-medium text-rose-600 dark:text-rose-400">({{ selectedInterests.length }}/3+)</span>
          </p>
          <div class="mt-6 grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2 md:gap-3 max-h-[50vh] overflow-y-auto pr-1">
            <button
              v-for="item in REFERENCE_INTERESTS"
              :key="item.slug"
              type="button"
              class="flex items-center gap-2 rounded-xl border px-3 py-2.5 text-sm transition-all"
              :class="
                selectedInterests.includes(item.slug)
                  ? 'border-rose-500 bg-rose-500 text-white shadow'
                  : 'border-neutral-200 dark:border-neutral-700 bg-white/80 dark:bg-neutral-900/80 text-neutral-800 dark:text-neutral-200'
              "
              @click="toggleInterest(item.slug)"
            >
              <span class="material-symbols-outlined text-[18px]">{{ item.icon }}</span>
              <span class="truncate">{{ interestLabel(item, selectedLang) }}</span>
            </button>
          </div>
        </section>

        <!-- Location -->
        <section v-else-if="step === 'location'" class="flex-1">
          <h2 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
            {{ t('onboarding.locationTitle') }}
          </h2>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">{{ t('onboarding.locationHint') }}</p>
          <label class="block mt-6 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {{ t('onboarding.countryLabel') }}
          </label>
          <select
            v-model="countryCode"
            class="mt-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3 text-neutral-900 dark:text-white"
          >
            <option value="">{{ t('onboarding.countryPlaceholder') }}</option>
            <option
              v-for="c in REFERENCE_COUNTRIES"
              :key="c.code"
              :value="c.code"
            >
              {{ c.flag }} {{ countryLabel(c, selectedLang) }}
            </option>
          </select>
          <label
            v-if="cityOptions.length"
            class="block mt-5 text-sm font-medium text-neutral-700 dark:text-neutral-300"
          >
            {{ t('onboarding.cityLabel') }}
          </label>
          <select
            v-if="cityOptions.length"
            v-model="cityId"
            class="mt-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3"
          >
            <option value="">{{ t('onboarding.cityPlaceholder') }}</option>
            <option v-for="city in cityOptions" :key="city.id" :value="city.id">
              {{ cityLabel(city, selectedLang) }}
            </option>
          </select>
        </section>

        <!-- Theme -->
        <section v-else-if="step === 'theme'" class="flex-1">
          <h2 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
            {{ t('onboarding.themeTitle') }}
          </h2>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">{{ t('onboarding.themeHint') }}</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button
              v-for="m in (['light', 'dark', 'system'] as const)"
              :key="m"
              type="button"
              class="rounded-2xl border-2 px-5 py-3 capitalize font-medium transition-all"
              :class="
                themePref === m
                  ? 'border-rose-500 bg-rose-50 dark:bg-rose-950/30'
                  : 'border-neutral-200 dark:border-neutral-700'
              "
              @click="themePref = m"
            >
              {{ t(`onboarding.theme.${m}`) }}
            </button>
          </div>
          <p class="mt-8 text-sm font-medium text-neutral-700 dark:text-neutral-300">
            {{ t('onboarding.accentLabel') }}
          </p>
          <div class="mt-3 flex flex-wrap gap-3">
            <button
              v-for="ac in REFERENCE_ACCENT_COLORS"
              :key="ac.id"
              type="button"
              class="h-11 w-11 rounded-full ring-2 ring-offset-2 dark:ring-offset-neutral-900 transition-transform hover:scale-110"
              :class="accentId === ac.id ? 'ring-rose-500 scale-110' : 'ring-transparent'"
              :style="{ backgroundColor: ac.hex }"
              :title="accentLabel(ac, selectedLang)"
              @click="accentId = ac.id"
            />
          </div>
        </section>

        <!-- Creators -->
        <section v-else-if="step === 'creators'" class="flex-1 flex flex-col min-h-0">
          <h2 class="text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
            {{ t('onboarding.creatorsTitle') }}
          </h2>
          <p class="mt-2 text-neutral-600 dark:text-neutral-400">{{ t('onboarding.creatorsHint') }}</p>
          <input
            v-model="creatorSearch"
            type="search"
            class="mt-4 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 px-4 py-3"
            :placeholder="t('onboarding.creatorsSearch')"
          />
          <ul class="mt-4 flex-1 overflow-y-auto space-y-2 min-h-0">
            <li
              v-for="u in creatorRows"
              :key="u.username"
              class="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 cursor-pointer"
              :class="followedCreators.includes(u.username) ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-400' : ''"
              @click="toggleCreator(u.username)"
            >
              <AvatarDisc
                :display-name="u.display_name || u.username"
                :avatar-url="u.avatar_url"
                :avatar-color="u.avatar_color"
                size="sm"
              />
              <div class="flex-1 min-w-0">
                <p class="font-medium truncate text-neutral-900 dark:text-white">{{ u.display_name || u.username }}</p>
                <p class="text-xs text-neutral-500">@{{ u.username }}</p>
              </div>
              <span
                v-if="followedCreators.includes(u.username)"
                class="material-symbols-outlined text-rose-500"
              >check_circle</span>
            </li>
          </ul>
        </section>

        <!-- Done -->
        <section v-else class="flex-1 flex flex-col justify-center text-center">
          <div class="mx-auto h-20 w-20 rounded-full bg-gradient-to-br from-rose-500 to-violet-500 flex items-center justify-center shadow-lg">
            <span class="material-symbols-outlined text-white text-4xl">celebration</span>
          </div>
          <h2 class="mt-6 text-2xl md:text-3xl font-bold text-neutral-900 dark:text-white">
            {{ t('onboarding.doneTitle') }}
          </h2>
          <p class="mt-3 text-neutral-600 dark:text-neutral-400 max-w-md mx-auto">
            {{ t('onboarding.doneSubtitle') }}
          </p>
        </section>

        <p v-if="errorMsg" class="mt-4 text-sm text-red-600 dark:text-red-400">{{ errorMsg }}</p>
      </main>

      <footer class="mt-8 flex flex-col-reverse sm:flex-row gap-3 sm:justify-between pt-4 border-t border-neutral-200/80 dark:border-neutral-800">
        <button
          v-if="stepIndex > 0 && step !== 'done'"
          type="button"
          class="rounded-xl px-5 py-3 text-neutral-600 dark:text-neutral-400 font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800"
          @click="prevStep"
        >
          {{ t('onboarding.back') }}
        </button>
        <div class="flex-1" />
        <button
          v-if="step === 'creators'"
          type="button"
          class="rounded-xl px-5 py-3 text-neutral-500 font-medium"
          @click="nextStep"
        >
          {{ t('onboarding.skip') }}
        </button>
        <button
          type="button"
          class="rounded-xl bg-gradient-to-r from-rose-500 to-violet-600 text-white font-semibold px-8 py-3.5 shadow-lg disabled:opacity-50"
          :disabled="!canContinue || saving"
          @click="onPrimaryAction"
        >
          {{
            saving
              ? t('onboarding.saving')
              : step === 'done'
                ? t('onboarding.enterPinova')
                : t('onboarding.continue')
          }}
        </button>
      </footer>
    </div>
  </div>
</template>
