<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
defineProps<{ compact?: boolean }>()
</script>

<template>
  <section
    id="trust-center"
    class="rounded-3xl border app-divider-subtle bg-neutral-50/80 dark:bg-neutral-900/40 p-6 space-y-4"
    :class="compact ? 'p-4 space-y-3' : ''"
  >
    <div>
      <p class="text-[10px] font-bold uppercase tracking-widest text-pink-600">{{ t('trust.center.kicker') }}</p>
      <h2 class="text-lg font-black text-neutral-900 dark:text-neutral-50">{{ t('trust.center.title') }}</h2>
      <p class="text-sm text-neutral-500 mt-1">{{ t('trust.center.subtitle') }}</p>
    </div>
    <ul class="space-y-3">
      <li class="flex gap-3">
        <PinovaIcon name="verified_user" class="text-pink-600 text-xl shrink-0" />
        <div>
          <p class="text-sm font-bold">{{ t('premium.trust.planLimits') }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('premium.trust.planLimits.desc') }}</p>
        </div>
      </li>
      <li class="flex gap-3">
        <PinovaIcon name="shield" class="text-pink-600 text-xl shrink-0" />
        <div>
          <p class="text-sm font-bold">{{ t('premium.trust.noTracking') }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('premium.trust.noTracking.desc') }}</p>
        </div>
      </li>
      <li class="flex gap-3">
        <PinovaIcon name="block" class="text-pink-600 text-xl shrink-0" />
        <div>
          <p class="text-sm font-bold">{{ t('premium.trust.noAds') }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('premium.trust.noAds.desc') }}</p>
        </div>
      </li>
      <li class="flex gap-3">
        <PinovaIcon name="groups" class="text-pink-600 text-xl shrink-0" />
        <div>
          <p class="text-sm font-bold">{{ t('premium.trust.creators') }}</p>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('premium.trust.creators.desc') }}</p>
        </div>
      </li>
    </ul>
    <p class="text-xs text-neutral-500 border-t app-divider-subtle pt-3">{{ t('trust.center.referralPending') }}</p>
  </section>
</template>
