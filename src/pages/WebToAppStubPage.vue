<script setup lang="ts">
import { useI18n } from '../i18n'

const { t } = useI18n()
</script>

<template>
  <div class="min-h-[50vh] flex flex-col items-center justify-center p-8 text-center text-neutral-600 dark:text-neutral-300">
    <p class="text-sm font-medium">{{ t('mobile.redirecting.desc') }}</p>
    <p class="text-xs mt-3 opacity-80">{{ t('mobile.error.notInstalled') }}</p>
  </div>
</template>
