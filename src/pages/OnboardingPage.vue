<script setup lang="ts">
import { computed, onMounted, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n, type LangCode } from '../i18n'
import LanguagePickerPanel from '../components/LanguagePickerPanel.vue'
import { useCountryCities } from '../composables/useCountryCities'
import api from '../api/index'
import {
  REFERENCE_COUNTRIES,
  REFERENCE_INTERESTS,
  countryLabel,
  cityLabel,
  interestLabel,
  detectBrowserTimezone,
  type InterestRef,
} from '../data/reference'
import { fetchReferenceInterests } from '../lib/fetchReferenceInterests'
import { useAppearance } from '../composables/useAppearance'
import { fetchMentionUsersPage, type SuggestUserRow } from '../composables/useUserSuggestSearch'
import AvatarDisc from '../components/AvatarDisc.vue'
import { getFullMediaUrl } from '../composables/usePins'

import SearchableSelect from '../components/SearchableSelect.vue'
import PinovaButton from '../components/ui/PinovaButton.vue'
import BirthDatePicker from '../components/BirthDatePicker.vue'
import { getStoredReferralCode, clearStoredReferralCode } from '../composables/useReferralIntent'
import { isFeatureEnabled } from '../lib/featureFlags'
import { resetAppShellVisualState } from '../utils/resetAppShellVisualState'
import {
  trackOnboardingStarted,
  trackOnboardingStepViewed,
  trackOnboardingStepCompleted,
  trackOnboardingStepSkipped,
  trackOnboardingCompleted,
  type OnboardingFlowVersion,
} from '../lib/onboardingAnalytics'

const MIN_INTERESTS = 2

const onboardingV2 = isFeatureEnabled('onboarding_v2')
const flowVersion: OnboardingFlowVersion = onboardingV2 ? 'v2' : 'v1'
const STEPS = onboardingV2
  ? (['interests', 'location', 'creators'] as const)
  : (['welcome', 'language', 'interests', 'location', 'creators'] as const)

type CreatorRow = SuggestUserRow & { reason?: string }

const router = useRouter()
const { currentUser, fetchCurrentUser } = useAuth()
const { t, currentLang, setLang } = useI18n()
const { isDark } = useAppearance()
const onboardingIsDark = computed(() => isDark.value)

const stepIndex = ref(0)
const step = computed(() => STEPS[stepIndex.value] ?? STEPS[0])
const skippedLocation = ref(false)
const progress = computed(() => ((stepIndex.value + 1) / STEPS.length) * 100)

const selectedLang = ref<LangCode>((currentLang.value as LangCode) || 'fr')
const interestOptions = ref<InterestRef[]>([...REFERENCE_INTERESTS])
const selectedInterests = ref<string[]>([])
const countryCode = ref(currentUser.value?.countryCode || '')
const cityId = ref('')
const { cities: loadedCities, loading: citiesLoading } = useCountryCities(countryCode)
const birthDate = ref(
  currentUser.value?.birthDate ? String(currentUser.value.birthDate).slice(0, 10) : '',
)
const referralCode = ref(getStoredReferralCode())
const followedCreators = ref<string[]>([])
const creatorSearch = ref('')
const creatorSuggestions = ref<CreatorRow[]>([])
const creatorSearchRows = ref<CreatorRow[]>([])
const creatorsLoading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

let creatorSearchTimer: ReturnType<typeof setTimeout> | null = null

onMounted(() => {
  trackOnboardingStarted(flowVersion)
  trackOnboardingStepViewed(step.value, stepIndex.value, flowVersion)
  void fetchReferenceInterests(selectedLang.value).then((rows) => {
    interestOptions.value = rows
  })
})

watch(selectedLang, (lang) => {
  void fetchReferenceInterests(lang, true).then((rows) => {
    interestOptions.value = rows
  })
})

watch(countryCode, () => {
  cityId.value = ''
})

function mapFollowSuggestion(raw: Record<string, unknown>): CreatorRow {
  const username = String(raw.username ?? '')
  return {
    username,
    name: String(raw.display_name ?? username),
    avatarColor: String(raw.avatar_color || DEFAULT_AVATAR_COLOR_CLASS),
    avatarUrl: getFullMediaUrl((raw.avatar as string | null | undefined) ?? '') || '',
    relation: String(raw.reason ?? ''),
    reason: String(raw.reason ?? ''),
  }
}

function creatorReasonLabel(reason: string | undefined): string {
  if (reason === 'shared_interests' || reason === 'preferred_topic') {
    return t('onboarding.creatorsReason.shared')
  }
  if (reason === 'near_you') return t('onboarding.creatorsReason.near')
  return t('onboarding.creatorsReason.popular')
}

async function loadCreatorSuggestions() {
  creatorsLoading.value = true
  try {
    const params: Record<string, string> = {}
    if (selectedInterests.value.length) {
      params.interests = JSON.stringify(selectedInterests.value)
    }
    if (countryCode.value) params.country_code = countryCode.value
    const { data } = await api.get<{ results?: Record<string, unknown>[] }>('users/follow-suggestions/', {
      params,
    })
    let rows = (data?.results ?? []).map(mapFollowSuggestion)
    if (!rows.length) {
      const { users } = await fetchMentionUsersPage('', 1, 16)
      rows = users.map((u) => ({ ...u, reason: 'popular' }))
    }
    creatorSuggestions.value = rows
  } catch {
    try {
      const { users } = await fetchMentionUsersPage('', 1, 16)
      creatorSuggestions.value = users.map((u) => ({ ...u, reason: 'popular' }))
    } catch {
      creatorSuggestions.value = []
    }
  } finally {
    creatorsLoading.value = false
  }
}

watch(creatorSearch, (q) => {
  if (creatorSearchTimer) clearTimeout(creatorSearchTimer)
  const trimmed = q.trim()
  if (trimmed.length < 2) {
    creatorSearchRows.value = []
    return
  }
  creatorSearchTimer = setTimeout(async () => {
    try {
      const { users } = await fetchMentionUsersPage(trimmed, 1, 12)
      creatorSearchRows.value = users
    } catch {
      creatorSearchRows.value = []
    }
  }, 280)
})

watch(step, (s) => {
  trackOnboardingStepViewed(s, stepIndex.value, flowVersion)
  if (s === 'creators' && !creatorSuggestions.value.length) {
    void loadCreatorSuggestions()
  }
})

watch([selectedInterests, countryCode], () => {
  if (step.value === 'creators') void loadCreatorSuggestions()
})

const displayedCreators = computed(() => {
  if (creatorSearch.value.trim().length >= 2) return creatorSearchRows.value
  return creatorSuggestions.value
})

function nextStep() {
  trackOnboardingStepCompleted(step.value, stepIndex.value, flowVersion)
  if (stepIndex.value < STEPS.length - 1) stepIndex.value += 1
}

function prevStep() {
  if (stepIndex.value > 0) stepIndex.value -= 1
}

async function pickLanguage(code: LangCode) {
  selectedLang.value = code
  await setLang(code)
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
  const rows = loadedCities.value
  return Array.isArray(rows) ? rows : []
})

const selectedCityName = computed(() => {
  const c = cityOptions.value.find((x) => x.id === cityId.value)
  return c ? cityLabel(c, selectedLang.value) : ''
})

const countrySelectOptions = computed(() =>
  REFERENCE_COUNTRIES.map((c) => ({
    value: c.code,
    label: `${c.flag} ${countryLabel(c, selectedLang.value)}`,
    searchText: `${c.code} ${c.nameFr} ${c.nameEn} ${c.nameFon ?? ''}`,
  })),
)

const citySelectOptions = computed(() =>
  cityOptions.value.map((city) => ({
    value: city.id,
    label: cityLabel(city, selectedLang.value),
    searchText: cityLabel(city, selectedLang.value),
  })),
)

function isValidBirthDate(raw: string): boolean {
  const value = raw.trim().slice(0, 10)
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false
  const d = new Date(`${value}T12:00:00`)
  if (Number.isNaN(d.getTime())) return false
  return d.getTime() < Date.now()
}

const canContinue = computed(() => {
  if (step.value === 'interests') return selectedInterests.value.length >= MIN_INTERESTS
  if (step.value === 'location') {
    if (onboardingV2) return true
    return !!countryCode.value && isValidBirthDate(birthDate.value)
  }
  return true
})

const canSkipLocation = computed(() => onboardingV2 && step.value === 'location')
const canSkipLater = computed(() => !onboardingV2 && stepIndex.value >= 2)
const primaryCtaLabel = computed(() => {
  if (step.value === 'creators') {
    return onboardingV2 ? t('onboarding.commencer') : t('onboarding.enterPinova')
  }
  return t('onboarding.continue')
})

async function finishOnboarding(opts?: { deferred?: boolean }) {
  saving.value = true
  errorMsg.value = ''
  try {
    setLang(selectedLang.value)

    const country = REFERENCE_COUNTRIES.find((c) => c.code === countryCode.value)
    const formData = new FormData()
    formData.append('preferred_language', selectedLang.value)
    formData.append(
      'preferred_currency',
      country?.currency || currentUser.value?.preferredCurrency || 'XOF',
    )
    if (countryCode.value) formData.append('country_code', countryCode.value)
    if (selectedCityName.value) formData.append('city', selectedCityName.value)
    if (!onboardingV2) {
      const bd = birthDate.value.trim().slice(0, 10)
      if (isValidBirthDate(bd)) formData.append('birth_date', bd)
    }
    const refCode = (
      referralCode.value.trim() || getStoredReferralCode() || ''
    )
      .toUpperCase()
      .replace(/[^A-Z0-9]/g, '')
      .slice(0, 16)
    if (refCode) formData.append('referral_code', refCode)
    formData.append('interests', JSON.stringify(selectedInterests.value))
    formData.append('followed_onboarding_creators', JSON.stringify(followedCreators.value))
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
    trackOnboardingStepCompleted(step.value, stepIndex.value, flowVersion)
    trackOnboardingCompleted(flowVersion, {
      interestsCount: selectedInterests.value.length,
      followedCreatorsCount: followedCreators.value.length,
      skippedLocation: skippedLocation.value,
      deferred: !!opts?.deferred,
    })
    if (refCode) clearStoredReferralCode()
    resetAppShellVisualState({ resetOverflow: true })
    await router.replace({ name: 'home' })
  } catch {
    errorMsg.value = t('onboarding.errorSave')
  } finally {
    saving.value = false
  }
}

function onPrimaryAction() {
  if (step.value === 'creators') {
    void finishOnboarding()
    return
  }
  if (!canContinue.value) return
  nextStep()
}

function onSkipLocation() {
  skippedLocation.value = true
  trackOnboardingStepSkipped('location', stepIndex.value, flowVersion)
  trackOnboardingStepCompleted('location', stepIndex.value, flowVersion, { skipped: true })
  if (stepIndex.value < STEPS.length - 1) stepIndex.value += 1
}

function onSkipLater() {
  void finishOnboarding({ deferred: true })
}
</script>

<template>
  <div class="onboarding-root" :class="{ 'onboarding-root--dark': onboardingIsDark }">
    <div class="onboarding-ambient" aria-hidden="true">
      <div class="onboarding-orb onboarding-orb--rose" />
      <div class="onboarding-orb onboarding-orb--violet" />
      <div class="onboarding-orb onboarding-orb--amber" />
    </div>

    <div class="onboarding-progress-wrap" data-testid="onboarding-progress">
      <div class="onboarding-progress-track">
        <div class="onboarding-progress-fill" :style="{ width: `${progress}%` }" />
      </div>
      <span class="onboarding-step-badge">
        {{ t('onboarding.stepOf', { current: stepIndex + 1, total: STEPS.length }) }}
      </span>
    </div>

    <div class="onboarding-shell">
      <main class="onboarding-main">
        <section v-if="step === 'welcome'" class="onboarding-panel onboarding-panel--hero">
          <div class="onboarding-hero-top">
            <div class="onboarding-hero-icon">
              <img src="/logo.png" alt="" class="onboarding-hero-logo" />
            </div>
            <h1 class="onboarding-title onboarding-title--welcome font-auth-title font-auth-title--black">
              {{ t('onboarding.welcomeTitle') }}
            </h1>
            <p class="onboarding-lead onboarding-lead--center">{{ t('onboarding.welcomeSubtitle') }}</p>
          </div>
          <ul class="onboarding-bullets">
            <li>
              <PinovaIcon name="auto_awesome" class="onboarding-bullet-icon onboarding-bullet-icon--rose" />
              {{ t('onboarding.welcomeBullet1') }}
            </li>
            <li>
              <PinovaIcon name="groups" class="onboarding-bullet-icon onboarding-bullet-icon--violet" />
              {{ t('onboarding.welcomeBullet2') }}
            </li>
            <li>
              <PinovaIcon name="tune" class="onboarding-bullet-icon onboarding-bullet-icon--emerald" />
              {{ t('onboarding.welcomeBullet3') }}
            </li>
          </ul>
        </section>

        <section v-else-if="step === 'language'" class="onboarding-panel onboarding-panel--compact">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.languageTitle') }}</h2>
          <p class="onboarding-lead">{{ t('onboarding.languageHint') }}</p>
          <div class="mt-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden bg-white/60 dark:bg-neutral-900/40">
            <LanguagePickerPanel
              v-model="selectedLang"
              compact
              @select="pickLanguage"
            />
          </div>
        </section>

        <section v-else-if="step === 'interests'" class="onboarding-panel onboarding-panel--scroll">
          <h2 class="onboarding-title onboarding-title--sm">
            {{ onboardingV2 ? t('onboarding.interestsLangTitle') : t('onboarding.interestsTitle') }}
          </h2>
          <p class="onboarding-lead">
            {{ onboardingV2 ? t('onboarding.interestsLangHint') : t('onboarding.interestsHint') }}
            <span class="font-semibold text-rose-600 dark:text-rose-400">({{ selectedInterests.length }}/{{ MIN_INTERESTS }}+)</span>
          </p>
          <template v-if="onboardingV2">
            <p class="onboarding-label mt-4">{{ t('onboarding.languageTitle') }}</p>
            <div class="mb-4 rounded-2xl border border-neutral-200/80 dark:border-neutral-700/80 overflow-hidden bg-white/60 dark:bg-neutral-900/40">
              <LanguagePickerPanel
                v-model="selectedLang"
                compact
                @select="pickLanguage"
              />
            </div>
          </template>
          <div class="onboarding-interest-grid">
            <button
              v-for="item in interestOptions"
              :key="item.slug"
              type="button"
              class="onboarding-chip"
              :data-testid="`onboarding-interest-${item.slug}`"
              :class="{ 'onboarding-chip--active': selectedInterests.includes(item.slug) }"
              @click="toggleInterest(item.slug)"
            >
              <PinovaIcon :name="item.icon" class="text-[18px] shrink-0" />
              <span class="truncate">{{ interestLabel(item, selectedLang) }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="step === 'location'" class="onboarding-panel onboarding-panel--compact">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.locationTitle') }}</h2>
          <p class="onboarding-lead">
            {{ onboardingV2 ? t('onboarding.locationHintOptional') : t('onboarding.locationHint') }}
          </p>
          <label class="onboarding-label">{{ t('onboarding.countryLabel') }}</label>
          <SearchableSelect
            v-model="countryCode"
            variant="glass"
            :options="countrySelectOptions"
            :placeholder="t('onboarding.countryPlaceholder')"
            :search-placeholder="t('onboarding.countrySearch')"
          />
          <template v-if="citySelectOptions.length || citiesLoading">
            <label class="onboarding-label mt-5">{{ t('onboarding.cityLabel') }}</label>
            <SearchableSelect
              v-model="cityId"
              variant="glass"
              :options="citySelectOptions"
              :placeholder="citiesLoading ? t('onboarding.cityLoading') : t('onboarding.cityPlaceholder')"
              :search-placeholder="t('onboarding.citySearch')"
              :disabled="citiesLoading"
            />
          </template>
          <template v-if="!onboardingV2">
            <label class="onboarding-label mt-5">{{ t('onboarding.birthdateLabel') }}</label>
            <p class="text-xs text-neutral-500 mb-2">{{ t('onboarding.birthdateHint') }}</p>
            <BirthDatePicker v-model="birthDate" variant="onboarding" :dark="onboardingIsDark" />
          </template>
        </section>

        <section v-else-if="step === 'creators'" class="onboarding-panel onboarding-panel--creators">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.creatorsTitle') }}</h2>
          <p class="onboarding-lead">{{ t('onboarding.creatorsHint') }}</p>

          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-rose-600/90 dark:text-rose-400">
            {{ t('onboarding.creatorsSuggestions') }}
          </p>

          <div v-if="creatorsLoading" class="onboarding-creators-loading">
            <PinovaIcon name="progress_activity" spin class="animate-spin text-rose-500" />
            {{ t('onboarding.creatorsLoading') }}
          </div>

          <ul v-else-if="displayedCreators.length" class="onboarding-creator-list">
            <li
              v-for="u in displayedCreators"
              :key="u.username"
              class="onboarding-creator-row"
              :class="{ 'onboarding-creator-row--active': followedCreators.includes(u.username) }"
              @click="toggleCreator(u.username)"
            >
              <AvatarDisc
                :color="u.avatarColor"
                frame-class="w-11 h-11 text-sm"
                text-class="text-white"
                :has-image="!!u.avatarUrl"
              >
                <img v-if="u.avatarUrl" :src="u.avatarUrl" class="w-full h-full object-cover" alt="" />
                <span v-else class="font-bold">{{ u.name?.slice(0, 1) }}</span>
              </AvatarDisc>
              <div class="min-w-0 flex-1">
                <p class="font-semibold truncate text-neutral-900 dark:text-white">{{ u.name || u.username }}</p>
                <p class="text-xs text-neutral-500 truncate">@{{ u.username }}</p>
                <p v-if="u.reason && creatorSearch.trim().length < 2" class="text-[11px] text-rose-600/80 dark:text-rose-400/90 mt-0.5">
                  {{ creatorReasonLabel(u.reason) }}
                </p>
              </div>
              <PinovaIcon name="check_circle" class="text-rose-500 shrink-0" />
              <PinovaIcon name="add_circle" class="text-neutral-300 dark:text-neutral-600 shrink-0" />
            </li>
          </ul>

          <p v-else class="onboarding-creators-empty">{{ t('onboarding.creatorsEmpty') }}</p>

          <label class="onboarding-label mt-5">{{ t('onboarding.creatorsSearch') }}</label>
          <input
            v-model="creatorSearch"
            type="search"
            autocomplete="off"
            class="onboarding-select"
          />
        </section>

        <section v-else class="onboarding-panel onboarding-panel--done">
          <div class="onboarding-done-badge">
            <PinovaIcon name="celebration" class="text-white text-4xl" />
          </div>
          <h2 class="onboarding-title onboarding-title--welcome font-auth-title font-auth-title--black text-center">
            {{ t('onboarding.doneTitle') }}
          </h2>
          <p class="onboarding-lead onboarding-lead--center">{{ t('onboarding.doneSubtitle') }}</p>
        </section>

        <p v-if="errorMsg" class="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{{ errorMsg }}</p>
      </main>

      <footer
        class="onboarding-footer"
        :class="{ 'onboarding-footer--solo': stepIndex === 0 }"
      >
        <button
          v-if="stepIndex > 0"
          type="button"
          class="onboarding-btn onboarding-btn--ghost onboarding-btn--back"
          @click="prevStep"
        >
          {{ t('onboarding.back') }}
        </button>
        <button
          v-if="canSkipLocation"
          type="button"
          class="onboarding-btn onboarding-btn--ghost"
          :disabled="saving"
          @click="onSkipLocation"
        >
          {{ t('onboarding.skip') }}
        </button>
        <button
          v-if="canSkipLater"
          type="button"
          class="onboarding-btn onboarding-btn--ghost"
          :disabled="saving"
          @click="onSkipLater"
        >
          {{ t('onboarding.skipLater') }}
        </button>
        <div class="onboarding-btn--next flex-1 min-w-0">
          <PinovaButton
            data-testid="onboarding-continue"
            variant="primary"
            block
            :loading="saving"
            :disabled="(!canContinue && step !== 'creators') || saving"
            @click="onPrimaryAction"
          >
            {{ primaryCtaLabel }}
          </PinovaButton>
        </div>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.onboarding-root {
  position: relative;
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(145deg, #fff5f7 0%, #faf5ff 42%, #f0f9ff 100%);
}

.onboarding-root.onboarding-root--dark,
:global(html.dark) .onboarding-root {
  background: linear-gradient(160deg, #0a0a0b 0%, #17121f 45%, #0f1419 100%);
  color-scheme: dark;
}

.onboarding-ambient {
  pointer-events: none;
  position: absolute;
  inset: 0;
  overflow: hidden;
}

.onboarding-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  opacity: 0.62;
  animation: onboarding-float 14s ease-in-out infinite;
}

.onboarding-orb--rose {
  width: min(420px, 70vw);
  height: min(420px, 70vw);
  top: -12%;
  left: -8%;
  background: radial-gradient(circle, rgba(244, 63, 94, 0.45), transparent 70%);
}

.onboarding-orb--violet {
  width: min(380px, 65vw);
  height: min(380px, 65vw);
  top: 28%;
  right: -18%;
  background: radial-gradient(circle, rgba(139, 92, 246, 0.4), transparent 70%);
  animation-delay: -4s;
}

.onboarding-orb--amber {
  width: min(300px, 55vw);
  height: min(300px, 55vw);
  bottom: 8%;
  left: 20%;
  background: radial-gradient(circle, rgba(251, 191, 36, 0.28), transparent 70%);
  animation-delay: -7s;
}

@keyframes onboarding-float {
  0%,
  100% {
    transform: translate(0, 0) scale(1);
  }
  50% {
    transform: translate(12px, -18px) scale(1.04);
  }
}

.onboarding-progress-wrap {
  position: relative;
  z-index: 2;
  padding-top: max(0.75rem, env(safe-area-inset-top, 0px), var(--pinova-pwa-extra-top-inset, 0px));
  padding-left: max(1rem, env(safe-area-inset-left, 0px));
  padding-right: max(1rem, env(safe-area-inset-right, 0px));
}

.onboarding-progress-track {
  height: 4px;
  border-radius: 9999px;
  background: rgba(0, 0, 0, 0.06);
  overflow: hidden;
}

.onboarding-root--dark .onboarding-progress-track,
:global(html.dark) .onboarding-progress-track {
  background: rgba(255, 255, 255, 0.08);
}

.onboarding-progress-fill {
  height: 100%;
  border-radius: inherit;
  background: linear-gradient(90deg, #f43f5e, #a855f7, #6366f1);
  transition: width 0.45s cubic-bezier(0.22, 1, 0.36, 1);
}

.onboarding-step-badge {
  display: inline-block;
  margin-top: 0.5rem;
  font-size: 0.7rem;
  font-weight: 700;
  letter-spacing: 0.06em;
  text-transform: uppercase;
  color: rgba(82, 82, 91, 0.85);
}

.onboarding-root--dark .onboarding-step-badge,
:global(html.dark) .onboarding-step-badge {
  color: rgba(212, 212, 216, 0.75);
}

.onboarding-shell {
  position: relative;
  z-index: 1;
  flex: 1;
  display: flex;
  flex-direction: column;
  max-width: 42rem;
  width: 100%;
  margin: 0 auto;
  padding: 0 1rem 0;
  min-height: 0;
}

.onboarding-main {
  flex: 1 1 auto;
  min-height: 0;
  overflow-x: hidden;
  overflow-y: auto;
  -webkit-overflow-scrolling: touch;
  overscroll-behavior: contain;
  display: flex;
  flex-direction: column;
  padding: 1rem 0 0.5rem;
}

.onboarding-panel {
  flex: 0 0 auto;
  min-height: 0;
  padding: 1rem 1.15rem 1.25rem;
  border-radius: 1.35rem;
  background: rgba(255, 255, 255, 0.62);
  border: 1px solid rgba(255, 255, 255, 0.75);
  box-shadow:
    0 24px 60px -28px rgba(190, 24, 93, 0.22),
    0 0 0 1px rgba(255, 255, 255, 0.4) inset;
  backdrop-filter: blur(20px) saturate(1.35);
  -webkit-backdrop-filter: blur(20px) saturate(1.35);
}

.onboarding-root--dark .onboarding-panel,
:global(html.dark) .onboarding-panel {
  background: rgba(23, 23, 23, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 28px 70px -32px rgba(0, 0, 0, 0.65);
}

.onboarding-panel--hero {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  align-items: stretch;
  justify-content: flex-start;
}

.onboarding-panel--done {
  flex: 1 1 auto;
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  text-align: center;
}

.onboarding-panel--compact {
  flex: 0 0 auto;
  align-self: stretch;
}

.onboarding-panel--scroll,
.onboarding-panel--creators {
  flex: 0 0 auto;
}

.onboarding-panel--profile {
  flex: 0 0 auto;
}

.onboarding-field-stack {
  display: flex;
  flex-wrap: wrap;
  gap: 1rem 0.85rem;
  margin-top: 1.15rem;
}

.onboarding-field-group {
  display: flex;
  flex-direction: column;
  gap: 0.35rem;
  min-width: 0;
}

.onboarding-field-group--half {
  flex: 1 1 calc(50% - 0.45rem);
}

.onboarding-field-group--full {
  flex: 1 1 100%;
}

@media (max-width: 520px) {
  .onboarding-field-group--half {
    flex: 1 1 100%;
  }
}

.onboarding-select--field {
  margin-top: 0;
}

.onboarding-hero-top {
  display: flex;
  flex-direction: column;
  align-items: center;
  text-align: center;
}

.onboarding-hero-icon {
  width: 5.25rem;
  height: 5.25rem;
  border-radius: 9999px;
  overflow: hidden;
  border: 2.5px solid rgba(244, 63, 94, 0.35);
  background: rgba(244, 63, 94, 0.08);
  box-shadow: 0 12px 32px -12px rgba(244, 63, 94, 0.35);
  margin-bottom: 1.15rem;
}

.onboarding-root--dark .onboarding-hero-icon,
:global(html.dark) .onboarding-hero-icon {
  border-color: rgba(251, 113, 133, 0.45);
  background: rgba(244, 63, 94, 0.14);
}

.onboarding-hero-logo {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.onboarding-panel--scroll {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.onboarding-panel--creators {
  display: flex;
  flex-direction: column;
  min-height: 0;
}

.onboarding-title {
  font-size: clamp(1.75rem, 5vw, 2.35rem);
  font-weight: 800;
  letter-spacing: -0.03em;
  line-height: 1.12;
  color: #18181b;
}

.onboarding-root--dark .onboarding-title,
:global(html.dark) .onboarding-title {
  color: #fafafa;
}

.onboarding-title--sm {
  font-size: clamp(1.45rem, 4vw, 1.85rem);
}

.onboarding-title--welcome {
  font-size: clamp(2rem, 6vw, 2.75rem);
  letter-spacing: 0.01em;
}

.onboarding-lead {
  margin-top: 0.65rem;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #52525b;
}

.onboarding-lead--center {
  text-align: center;
  max-width: 28rem;
  margin-left: auto;
  margin-right: auto;
}

.onboarding-root--dark .onboarding-lead,
:global(html.dark) .onboarding-lead {
  color: #a1a1aa;
}

.onboarding-bullets {
  margin-top: 2.25rem;
  display: flex;
  flex-direction: column;
  gap: 1.35rem;
  font-size: 0.92rem;
  color: #3f3f46;
}

.onboarding-root--dark .onboarding-bullets,
:global(html.dark) .onboarding-bullets {
  color: #d4d4d8;
}

.onboarding-bullets li {
  display: flex;
  align-items: center;
  gap: 0.75rem;
}

.onboarding-bullet-icon {
  display: grid;
  place-items: center;
  width: 2.25rem;
  height: 2.25rem;
  border-radius: 0.75rem;
  font-size: 1.15rem;
}

.onboarding-bullet-icon--rose {
  background: rgba(244, 63, 94, 0.12);
  color: #e11d48;
}

.onboarding-bullet-icon--violet {
  background: rgba(139, 92, 246, 0.12);
  color: #7c3aed;
}

.onboarding-bullet-icon--emerald {
  background: rgba(16, 185, 129, 0.12);
  color: #059669;
}

.onboarding-chip {
  display: inline-flex;
  align-items: center;
  gap: 0.5rem;
  border-radius: 1rem;
  border: 1.5px solid rgba(0, 0, 0, 0.07);
  background: rgba(255, 255, 255, 0.55);
  padding: 0.65rem 0.85rem;
  font-size: 0.875rem;
  color: #27272a;
  transition: transform 0.15s ease, border-color 0.15s ease, box-shadow 0.15s ease;
  backdrop-filter: blur(8px);
}

.onboarding-root--dark .onboarding-chip,
:global(html.dark) .onboarding-chip {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(38, 38, 38, 0.5);
  color: #e4e4e7;
}

.onboarding-chip--lg {
  padding: 1rem 1.1rem;
  justify-content: center;
}

.onboarding-theme-chip {
  display: inline-flex;
  flex-direction: column;
  align-items: center;
  gap: 0.35rem;
  min-width: 6.5rem;
}

.onboarding-chip--active {
  border-color: #e11d48;
  background: linear-gradient(135deg, #fb7185, #e11d48);
  color: #fff;
  box-shadow: 0 10px 28px -10px rgba(225, 29, 72, 0.55);
  transform: translateY(-1px);
  font-weight: 700;
}

.onboarding-chip--active .pinova-icon {
  color: #fff;
}

.onboarding-root--dark .onboarding-chip--active,
:global(html.dark) .onboarding-chip--active {
  border-color: #fb7185;
  background: linear-gradient(135deg, #fb7185, #be123c);
  color: #fff;
  box-shadow: 0 12px 32px -12px rgba(251, 113, 133, 0.45);
}

.onboarding-interest-grid {
  margin-top: 1.25rem;
  flex: 1;
  min-height: 0;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  align-content: start;
  overflow-y: auto;
  padding-right: 0.15rem;
}

@media (min-width: 640px) {
  .onboarding-interest-grid {
    grid-template-columns: repeat(3, minmax(0, 1fr));
  }
}

.onboarding-label {
  display: block;
  font-size: 0.8rem;
  font-weight: 700;
  color: #52525b;
}

.onboarding-root--dark .onboarding-label,
:global(html.dark) .onboarding-label {
  color: #a1a1aa;
}

.onboarding-select {
  margin-top: 0.45rem;
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: #ffffff;
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  color: #18181b;
}

.onboarding-root--dark .onboarding-select,
:global(html.dark) .onboarding-select {
  border-color: rgba(255, 255, 255, 0.1);
  background: #262626;
  color: #fafafa;
}

.onboarding-creators-loading {
  margin-top: 1rem;
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  padding: 2rem 0;
  font-size: 0.875rem;
  color: #71717a;
}

.onboarding-root--dark .onboarding-creators-loading,
:global(html.dark) .onboarding-creators-loading {
  color: #a1a1aa;
}

.onboarding-creator-list {
  margin-top: 0.75rem;
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  gap: 0.5rem;
  padding-right: 0.1rem;
}

.onboarding-creator-row {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  padding: 0.65rem 0.75rem;
  border-radius: 1rem;
  border: 1px solid rgba(0, 0, 0, 0.06);
  background: rgba(255, 255, 255, 0.45);
  cursor: pointer;
  transition: border-color 0.15s ease, background 0.15s ease;
  backdrop-filter: blur(8px);
}

.onboarding-root--dark .onboarding-creator-row,
:global(html.dark) .onboarding-creator-row {
  border-color: rgba(255, 255, 255, 0.08);
  background: rgba(38, 38, 38, 0.4);
}

.onboarding-creator-row--active {
  border-color: rgba(244, 63, 94, 0.45);
  background: rgba(244, 63, 94, 0.08);
}

.onboarding-creators-empty {
  margin-top: 1rem;
  text-align: center;
  font-size: 0.875rem;
  color: #71717a;
  padding: 1.5rem 0;
}

.onboarding-root--dark .onboarding-creators-empty,
:global(html.dark) .onboarding-creators-empty {
  color: #a1a1aa;
}

.onboarding-done-badge {
  margin: 0 auto 1.5rem;
  width: 5rem;
  height: 5rem;
  border-radius: 9999px;
  display: grid;
  place-items: center;
  background: linear-gradient(135deg, #f43f5e, #8b5cf6);
  box-shadow: 0 20px 50px -12px rgba(244, 63, 94, 0.55);
}

.onboarding-footer {
  flex: 0 0 auto;
  display: flex;
  flex-direction: row;
  flex-wrap: nowrap;
  align-items: center;
  gap: 0.65rem;
  padding: 0.85rem 0 max(1rem, calc(0.85rem + env(safe-area-inset-bottom, 0px)));
  background: transparent;
  backdrop-filter: none;
  -webkit-backdrop-filter: none;
}

.onboarding-footer--solo {
  justify-content: stretch;
}

.onboarding-btn--back {
  flex: 0 0 auto;
  white-space: nowrap;
}

.onboarding-btn--next {
  flex: 1 1 auto;
  min-width: 0;
}

.onboarding-root--dark .onboarding-footer,
:global(html.dark) .onboarding-footer {
  background: transparent;
}

.onboarding-btn {
  border-radius: 9999px;
  padding: 0.85rem 1.35rem;
  font-size: 0.9rem;
  font-weight: 700;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.onboarding-btn:active:not(:disabled) {
  transform: scale(0.98);
}

.onboarding-btn--ghost {
  color: #52525b;
  background: transparent;
  border: 1px solid rgba(0, 0, 0, 0.08);
}

.onboarding-root--dark .onboarding-btn--ghost,
:global(html.dark) .onboarding-btn--ghost {
  color: #d4d4d8;
  background: transparent;
  border-color: rgba(255, 255, 255, 0.12);
}

.onboarding-btn--primary {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  min-width: 9.5rem;
  min-height: 2.85rem;
  color: #fff;
  background: linear-gradient(105deg, #f43f5e 0%, #a855f7 55%, #6366f1 100%);
  box-shadow: 0 14px 36px -10px rgba(244, 63, 94, 0.55);
}

.onboarding-btn-spinner {
  width: 1.25rem;
  height: 1.25rem;
  border: 2px solid rgba(255, 255, 255, 0.35);
  border-top-color: #fff;
  border-radius: 9999px;
  animation: onboarding-btn-spin 0.65s linear infinite;
}

@keyframes onboarding-btn-spin {
  to {
    transform: rotate(360deg);
  }
}

.onboarding-btn--primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
