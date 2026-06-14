<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()

const badges = [
  { icon: 'lock', key: 'checkout.trust.fedapay' },
  { icon: 'replay', key: 'checkout.trust.refund' },
  { icon: 'support_agent', key: 'checkout.trust.support' },
] as const
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
    <span
      v-for="badge in badges"
      :key="badge.key"
      class="inline-flex items-center gap-1.5 rounded-full border border-neutral-200/80 bg-neutral-50/90 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:border-neutral-700 dark:bg-neutral-900/60 dark:text-neutral-300"
    >
      <PinovaIcon :name="badge.icon" class="text-sm shrink-0" aria-hidden="true" />
      {{ t(badge.key) }}
    </span>
  </div>
</template>
