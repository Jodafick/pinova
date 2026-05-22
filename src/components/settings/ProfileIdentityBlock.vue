<script setup lang="ts">
import { computed, watch } from 'vue'
import {
  REFERENCE_COUNTRIES,
  REFERENCE_GENDERS,
  REFERENCE_PRONOUNS,
  countryLabel,
  citiesForCountry,
  cityLabel,
  genderLabel,
  pronounLabel,
} from '../../data/reference'
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

const cityOptions = computed(() => citiesForCountry(countryCode.value))

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
        <select v-model="gender" :class="fieldClass">
          <option value="">{{ t('profile.field.gender') }}</option>
          <option v-for="g in REFERENCE_GENDERS.filter((x) => x.id)" :key="g.id" :value="g.id">
            {{ genderLabel(g, currentLang) }}
          </option>
        </select>
        <select v-model="pronouns" :class="fieldClass">
          <option value="">{{ t('profile.field.pronouns') }}</option>
          <option v-for="p in REFERENCE_PRONOUNS.filter((x) => x.id)" :key="p.id" :value="p.id">
            {{ pronounLabel(p, currentLang) }}
          </option>
        </select>
      </div>
    </div>

    <div>
      <p :class="labelClass">{{ t('settings.profile.groupLocation') }}</p>
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <select v-model="countryCode" :class="fieldClass">
          <option value="">{{ t('onboarding.countryPlaceholder') }}</option>
          <option v-for="c in REFERENCE_COUNTRIES" :key="c.code" :value="c.code">
            {{ c.flag }} {{ countryLabel(c, currentLang) }}
          </option>
        </select>
        <select v-if="cityOptions.length" v-model="cityId" :class="fieldClass">
          <option value="">{{ t('onboarding.cityPlaceholder') }}</option>
          <option v-for="ct in cityOptions" :key="ct.id" :value="ct.id">
            {{ cityLabel(ct, currentLang) }}
          </option>
        </select>
      </div>
    </div>

    <div>
      <label :class="labelClass">{{ t('profile.field.favoriteQuote') }}</label>
      <input v-model="favoriteQuote" type="text" :class="fieldClass" :placeholder="t('profile.field.favoriteQuote')" />
    </div>
  </div>
</template>
