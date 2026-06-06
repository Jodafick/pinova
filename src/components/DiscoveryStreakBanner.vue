<script setup lang="ts">
import { useI18n } from '../i18n'
import type { DiscoveryStreak } from '../composables/useDiscoveryStreak'

const props = defineProps<{
  streak: DiscoveryStreak | null
}>()

const { t } = useI18n()
</script>

<template>
  <div
    v-if="props.streak && props.streak.count >= 1"
    class="mx-3 mb-2 flex items-start gap-2.5 rounded-2xl border border-pink-200/80 bg-pink-50/90 px-3.5 py-2.5 dark:border-pink-900/50 dark:bg-pink-950/30"
  >
    <span class="material-symbols-outlined text-pink-700 text-[20px]">explore</span>
    <div class="min-w-0 flex-1">
      <p class="text-sm font-extrabold text-pink-800 dark:text-pink-200">
        {{ props.streak.paused
          ? t('discovery.streak.paused', { count: props.streak.count, best: props.streak.best })
          : t('discovery.streak.active', { count: props.streak.count }) }}
      </p>
      <p class="text-[11px] text-pink-900/70 dark:text-pink-100/70 mt-0.5">{{ t('discovery.streak.hint') }}</p>
    </div>
  </div>
</template>
