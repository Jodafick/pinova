<script setup lang="ts">
import { computed, watch } from 'vue'
import SearchableSelect from '../SearchableSelect.vue'
import {
  REFERENCE_COUNTRIES,
  REFERENCE_GENDERS,
  REFERENCE_PRONOUNS,
  countryLabel,
  cityLabel,
  genderLabel,
  pronounLabel,
} from '../../data/reference'
import { useCountryCities } from '../../composables/useCountryCities'
import { useI18n } from '../../i18n'

const firstName = defineModel<string>('firstName', { required: true })
const lastName = defineModel<string>('lastName', { required: true })
const jobTitle = defineModel<string>('jobTitle', { required: true })
const school = defineModel<string>('school', { required: true })
const company = defineModel<string>('company', { required: true })
const website = defineModel<string>('website', { required: true })
const gender = defineModel<string>('gender', { required: true })
const pronouns = defineModel<string>('pronouns', { required: true })
const favoriteQuote = defineModel<string>('favoriteQuote', { required: true })
const countryCode = defineModel<string>('countryCode', { required: true })
const cityId = defineModel<string>('cityId', { required: true })

const { t, currentLang } = useI18n()
const { cities: cityOptions, loading: citiesLoading } = useCountryCities(countryCode)

const countrySelectOptions = computed(() =>
  REFERENCE_COUNTRIES.map((c) => ({
    value: c.code,
    label: `${c.flag} ${countryLabel(c, currentLang.value)}`,
    searchText: `${c.code} ${c.nameFr} ${c.nameEn} ${c.nameFon ?? ''}`,
  })),
)

const citySelectOptions = computed(() =>
  cityOptions.value.map((city) => ({
    value: city.id,
    label: cityLabel(city, currentLang.value),
    searchText: cityLabel(city, currentLang.value),
  })),
)

const genderSelectOptions = computed(() =>
  REFERENCE_GENDERS.filter((g) => g.id).map((g) => ({
    value: g.id,
    label: genderLabel(g, currentLang.value),
    searchText: `${g.nameFr} ${g.nameEn}`,
  })),
)

const pronounSelectOptions = computed(() =>
  REFERENCE_PRONOUNS.filter((p) => p.id).map((p) => ({
    value: p.id,
    label: pronounLabel(p, currentLang.value),
    searchText: `${p.nameFr} ${p.nameEn}`,
  })),
)

const fieldClass =
  'w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition'

const labelClass = 'block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5'

watch(countryCode, () => {
  cityId.value = ''
})
</script>

<template>
  <div class="space-y-5 pt-1">
    <div>
      <p :class="labelClass">{{ t('settings.profile.groupLegalName') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <input v-model="firstName" type="text" autocomplete="given-name" :class="fieldClass" :placeholder="t('profile.field.firstName')" />
        <input v-model="lastName" type="text" autocomplete="family-name" :class="fieldClass" :placeholder="t('profile.field.lastName')" />
      </div>
      <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{{ t('settings.profile.legalNameHint') }}</p>
    </div>

    <div>
      <p :class="labelClass">{{ t('settings.profile.groupBackground') }}</p>
      <div class="space-y-4">
        <input v-model="jobTitle" type="text" :class="fieldClass" :placeholder="t('profile.field.jobTitle')" />
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <input v-model="school" type="text" :class="fieldClass" :placeholder="t('profile.field.school')" />
          <input v-model="company" type="text" :class="fieldClass" :placeholder="t('profile.field.company')" />
        </div>
        <input v-model="website" type="url" :class="fieldClass" :placeholder="t('profile.field.website')" />
      </div>
    </div>

    <div>
      <p :class="labelClass">{{ t('settings.profile.groupPersonal') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SearchableSelect
          v-model="gender"
          :options="genderSelectOptions"
          :placeholder="t('profile.field.gender')"
          :search-placeholder="t('onboarding.profileSearch')"
        />
        <SearchableSelect
          v-model="pronouns"
          :options="pronounSelectOptions"
          :placeholder="t('profile.field.pronouns')"
          :search-placeholder="t('onboarding.profileSearch')"
        />
      </div>
    </div>

    <div>
      <p :class="labelClass">{{ t('settings.profile.groupLocation') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <SearchableSelect
          v-model="countryCode"
          :options="countrySelectOptions"
          :placeholder="t('onboarding.countryPlaceholder')"
          :search-placeholder="t('onboarding.countrySearch')"
        />
        <SearchableSelect
          v-if="citySelectOptions.length || citiesLoading"
          v-model="cityId"
          :options="citySelectOptions"
          :placeholder="citiesLoading ? t('onboarding.cityLoading') : t('onboarding.cityPlaceholder')"
          :search-placeholder="t('onboarding.citySearch')"
          :disabled="citiesLoading"
        />
      </div>
    </div>

    <div>
      <label :class="labelClass">{{ t('profile.field.favoriteQuote') }}</label>
      <input v-model="favoriteQuote" type="text" :class="fieldClass" :placeholder="t('profile.field.favoriteQuote')" />
    </div>
  </div>
</template>
