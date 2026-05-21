<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth, DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { useI18n, type LangCode } from '../i18n'
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
import { getFullMediaUrl } from '../composables/usePins'

const STEPS = ['welcome', 'language', 'interests', 'location', 'theme', 'creators', 'done'] as const

type CreatorRow = SuggestUserRow & { reason?: string }

const router = useRouter()
const { currentUser, fetchCurrentUser } = useAuth()
const { t, currentLang, setLang } = useI18n()
const { setPreference } = useAppearance()

const stepIndex = ref(0)
const step = computed(() => STEPS[stepIndex.value] ?? 'welcome')
const progress = computed(() => ((stepIndex.value + 1) / STEPS.length) * 100)

const selectedLang = ref<LangCode>((currentLang.value as LangCode) || 'fr')
const selectedInterests = ref<string[]>([])
const countryCode = ref(currentUser.value?.countryCode || '')
const cityId = ref('')
const themePref = ref<'light' | 'dark' | 'system'>('system')
const accentId = ref('rose')
const followedCreators = ref<string[]>([])
const creatorSearch = ref('')
const creatorSuggestions = ref<CreatorRow[]>([])
const creatorSearchRows = ref<CreatorRow[]>([])
const creatorsLoading = ref(false)
const saving = ref(false)
const errorMsg = ref('')

let creatorSearchTimer: ReturnType<typeof setTimeout> | null = null

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
  <div class="onboarding-root">
    <div class="onboarding-ambient" aria-hidden="true">
      <div class="onboarding-orb onboarding-orb--rose" />
      <div class="onboarding-orb onboarding-orb--violet" />
      <div class="onboarding-orb onboarding-orb--amber" />
    </div>

    <div class="onboarding-progress-wrap">
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
          <div class="onboarding-hero-icon">
            <img src="/logo.png" alt="" class="h-14 w-14 rounded-2xl shadow-lg ring-2 ring-white/60" />
          </div>
          <h1 class="onboarding-title">{{ t('onboarding.welcomeTitle') }}</h1>
          <p class="onboarding-lead">{{ t('onboarding.welcomeSubtitle') }}</p>
          <ul class="onboarding-bullets">
            <li>
              <span class="onboarding-bullet-icon onboarding-bullet-icon--rose material-symbols-outlined">auto_awesome</span>
              {{ t('onboarding.welcomeBullet1') }}
            </li>
            <li>
              <span class="onboarding-bullet-icon onboarding-bullet-icon--violet material-symbols-outlined">groups</span>
              {{ t('onboarding.welcomeBullet2') }}
            </li>
            <li>
              <span class="onboarding-bullet-icon onboarding-bullet-icon--emerald material-symbols-outlined">tune</span>
              {{ t('onboarding.welcomeBullet3') }}
            </li>
          </ul>
        </section>

        <section v-else-if="step === 'language'" class="onboarding-panel">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.languageTitle') }}</h2>
          <p class="onboarding-lead">{{ t('onboarding.languageHint') }}</p>
          <div class="mt-6 grid grid-cols-1 sm:grid-cols-3 gap-3">
            <button
              v-for="opt in (['fr', 'en', 'fon'] as const)"
              :key="opt"
              type="button"
              class="onboarding-chip onboarding-chip--lg"
              :class="{ 'onboarding-chip--active': selectedLang === opt }"
              @click="selectedLang = opt"
            >
              <span class="font-semibold">{{ t(`onboarding.lang.${opt}`) }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="step === 'interests'" class="onboarding-panel onboarding-panel--scroll">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.interestsTitle') }}</h2>
          <p class="onboarding-lead">
            {{ t('onboarding.interestsHint') }}
            <span class="font-semibold text-rose-600 dark:text-rose-400">({{ selectedInterests.length }}/3+)</span>
          </p>
          <div class="onboarding-interest-grid">
            <button
              v-for="item in REFERENCE_INTERESTS"
              :key="item.slug"
              type="button"
              class="onboarding-chip"
              :class="{ 'onboarding-chip--active': selectedInterests.includes(item.slug) }"
              @click="toggleInterest(item.slug)"
            >
              <span class="material-symbols-outlined text-[18px] shrink-0">{{ item.icon }}</span>
              <span class="truncate">{{ interestLabel(item, selectedLang) }}</span>
            </button>
          </div>
        </section>

        <section v-else-if="step === 'location'" class="onboarding-panel">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.locationTitle') }}</h2>
          <p class="onboarding-lead">{{ t('onboarding.locationHint') }}</p>
          <label class="onboarding-label">{{ t('onboarding.countryLabel') }}</label>
          <select v-model="countryCode" class="onboarding-select">
            <option value="">{{ t('onboarding.countryPlaceholder') }}</option>
            <option v-for="c in REFERENCE_COUNTRIES" :key="c.code" :value="c.code">
              {{ c.flag }} {{ countryLabel(c, selectedLang) }}
            </option>
          </select>
          <template v-if="cityOptions.length">
            <label class="onboarding-label mt-5">{{ t('onboarding.cityLabel') }}</label>
            <select v-model="cityId" class="onboarding-select">
              <option value="">{{ t('onboarding.cityPlaceholder') }}</option>
              <option v-for="city in cityOptions" :key="city.id" :value="city.id">
                {{ cityLabel(city, selectedLang) }}
              </option>
            </select>
          </template>
        </section>

        <section v-else-if="step === 'theme'" class="onboarding-panel">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.themeTitle') }}</h2>
          <p class="onboarding-lead">{{ t('onboarding.themeHint') }}</p>
          <div class="mt-6 flex flex-wrap gap-3">
            <button
              v-for="m in (['light', 'dark', 'system'] as const)"
              :key="m"
              type="button"
              class="onboarding-chip onboarding-chip--lg capitalize"
              :class="{ 'onboarding-chip--active': themePref === m }"
              @click="themePref = m"
            >
              {{ t(`onboarding.theme.${m}`) }}
            </button>
          </div>
          <p class="onboarding-label mt-8">{{ t('onboarding.accentLabel') }}</p>
          <div class="mt-3 flex flex-wrap gap-3">
            <button
              v-for="ac in REFERENCE_ACCENT_COLORS"
              :key="ac.id"
              type="button"
              class="h-12 w-12 rounded-full ring-2 ring-offset-2 dark:ring-offset-neutral-900 transition-transform hover:scale-110"
              :class="accentId === ac.id ? 'ring-rose-500 scale-110' : 'ring-transparent'"
              :style="{ backgroundColor: ac.hex }"
              :title="accentLabel(ac, selectedLang)"
              @click="accentId = ac.id"
            />
          </div>
        </section>

        <section v-else-if="step === 'creators'" class="onboarding-panel onboarding-panel--creators">
          <h2 class="onboarding-title onboarding-title--sm">{{ t('onboarding.creatorsTitle') }}</h2>
          <p class="onboarding-lead">{{ t('onboarding.creatorsHint') }}</p>

          <p class="mt-4 text-xs font-bold uppercase tracking-wider text-rose-600/90 dark:text-rose-400">
            {{ t('onboarding.creatorsSuggestions') }}
          </p>

          <div v-if="creatorsLoading" class="onboarding-creators-loading">
            <span class="material-symbols-outlined animate-spin text-rose-500">progress_activity</span>
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
              <span
                v-if="followedCreators.includes(u.username)"
                class="material-symbols-outlined text-rose-500 shrink-0"
              >check_circle</span>
              <span v-else class="material-symbols-outlined text-neutral-300 dark:text-neutral-600 shrink-0">add_circle</span>
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

        <section v-else class="onboarding-panel onboarding-panel--hero">
          <div class="onboarding-done-badge">
            <span class="material-symbols-outlined text-white text-4xl">celebration</span>
          </div>
          <h2 class="onboarding-title text-center">{{ t('onboarding.doneTitle') }}</h2>
          <p class="onboarding-lead text-center max-w-md mx-auto">{{ t('onboarding.doneSubtitle') }}</p>
        </section>

        <p v-if="errorMsg" class="mt-4 text-sm text-red-600 dark:text-red-400 text-center">{{ errorMsg }}</p>
      </main>

      <footer class="onboarding-footer">
        <button
          v-if="stepIndex > 0 && step !== 'done'"
          type="button"
          class="onboarding-btn onboarding-btn--ghost"
          @click="prevStep"
        >
          {{ t('onboarding.back') }}
        </button>
        <div class="flex-1 min-w-2" />
        <button
          v-if="step === 'creators'"
          type="button"
          class="onboarding-btn onboarding-btn--ghost"
          @click="nextStep"
        >
          {{ t('onboarding.skip') }}
        </button>
        <button
          type="button"
          class="onboarding-btn onboarding-btn--primary"
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

<style scoped>
.onboarding-root {
  position: relative;
  min-height: 100dvh;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  background: linear-gradient(145deg, #fff5f7 0%, #faf5ff 42%, #f0f9ff 100%);
}

:global(.dark) .onboarding-root {
  background: linear-gradient(160deg, #0a0a0b 0%, #17121f 45%, #0f1419 100%);
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
  filter: blur(72px);
  opacity: 0.55;
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

:global(.dark) .onboarding-progress-track {
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

:global(.dark) .onboarding-step-badge {
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
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  padding: 1rem 0 0.5rem;
}

.onboarding-panel {
  flex: 1;
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

:global(.dark) .onboarding-panel {
  background: rgba(23, 23, 23, 0.55);
  border-color: rgba(255, 255, 255, 0.08);
  box-shadow: 0 28px 70px -32px rgba(0, 0, 0, 0.65);
}

.onboarding-panel--hero {
  display: flex;
  flex-direction: column;
  justify-content: center;
}

.onboarding-panel--scroll {
  display: flex;
  flex-direction: column;
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

:global(.dark) .onboarding-title {
  color: #fafafa;
}

.onboarding-title--sm {
  font-size: clamp(1.45rem, 4vw, 1.85rem);
}

.onboarding-lead {
  margin-top: 0.65rem;
  font-size: 0.95rem;
  line-height: 1.55;
  color: #52525b;
}

:global(.dark) .onboarding-lead {
  color: #a1a1aa;
}

.onboarding-bullets {
  margin-top: 2rem;
  display: flex;
  flex-direction: column;
  gap: 0.85rem;
  font-size: 0.92rem;
  color: #3f3f46;
}

:global(.dark) .onboarding-bullets {
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

:global(.dark) .onboarding-chip {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(38, 38, 38, 0.5);
  color: #e4e4e7;
}

.onboarding-chip--lg {
  padding: 1rem 1.1rem;
  justify-content: center;
}

.onboarding-chip--active {
  border-color: #f43f5e;
  background: linear-gradient(135deg, rgba(244, 63, 94, 0.14), rgba(168, 85, 247, 0.1));
  box-shadow: 0 8px 24px -8px rgba(244, 63, 94, 0.35);
  transform: translateY(-1px);
}

.onboarding-interest-grid {
  margin-top: 1.25rem;
  display: grid;
  grid-template-columns: repeat(2, minmax(0, 1fr));
  gap: 0.5rem;
  max-height: min(46vh, 360px);
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

:global(.dark) .onboarding-label {
  color: #a1a1aa;
}

.onboarding-select {
  margin-top: 0.45rem;
  width: 100%;
  border-radius: 0.9rem;
  border: 1px solid rgba(0, 0, 0, 0.08);
  background: rgba(255, 255, 255, 0.7);
  padding: 0.75rem 1rem;
  font-size: 0.95rem;
  color: #18181b;
  backdrop-filter: blur(10px);
}

:global(.dark) .onboarding-select {
  border-color: rgba(255, 255, 255, 0.1);
  background: rgba(23, 23, 23, 0.65);
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

:global(.dark) .onboarding-creator-row {
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
  flex-shrink: 0;
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 0.65rem;
  padding: 1rem 0 max(1.25rem, calc(0.85rem + env(safe-area-inset-bottom, 0px)));
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
  background: rgba(255, 255, 255, 0.45);
  border: 1px solid rgba(0, 0, 0, 0.06);
  backdrop-filter: blur(10px);
}

:global(.dark) .onboarding-btn--ghost {
  color: #d4d4d8;
  background: rgba(38, 38, 38, 0.45);
  border-color: rgba(255, 255, 255, 0.08);
}

.onboarding-btn--primary {
  color: #fff;
  background: linear-gradient(105deg, #f43f5e 0%, #a855f7 55%, #6366f1 100%);
  box-shadow: 0 14px 36px -10px rgba(244, 63, 94, 0.55);
}

.onboarding-btn--primary:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
</style>
