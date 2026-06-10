<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div class="flex flex-wrap items-center justify-center gap-2 pt-2">
    <PinovaIcon :name="t('checkout.trust.fedapay')" class="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300" />
    <PinovaIcon :name="t('checkout.trust.refund')" class="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300" />
    <PinovaIcon :name="t('checkout.trust.support')" class="inline-flex items-center gap-1 rounded-full border border-neutral-200/80 dark:border-neutral-700 bg-neutral-50/90 dark:bg-neutral-900/60 px-2.5 py-1 text-[10px] font-bold uppercase tracking-wide text-neutral-600 dark:text-neutral-300" />
  </div>
</template>
