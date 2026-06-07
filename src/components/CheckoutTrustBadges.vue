<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
    <span
      class="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
    >
      <span class="material-symbols-outlined text-sm text-emerald-600">verified_user</span>
      {{ t('checkout.trust.fedapay') }}
    </span>
    <span
      class="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
    >
      <span class="material-symbols-outlined text-sm text-sky-600">replay</span>
      {{ t('checkout.trust.refund') }}
    </span>
    <span
      class="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300"
    >
      <span class="material-symbols-outlined text-sm text-pink-600">support_agent</span>
      {{ t('checkout.trust.support') }}
    </span>
  </div>
</template>
