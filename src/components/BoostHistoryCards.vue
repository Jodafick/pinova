<script setup lang="ts">
import { computed } from 'vue'
import { useI18n } from '../i18n'
import type { BoostHistoryRow } from '../composables/usePromoteHub'
import OfflineImg from './OfflineImg.vue'

const props = defineProps<{
  rows: BoostHistoryRow[]
  pinImageBySlug?: Record<string, string>
}>()

const emit = defineEmits<{ (e: 'boost-again', slug: string): void }>()

const { t } = useI18n()

function statusClass(status: string) {
  if (status === 'active') return 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-300'
  if (status === 'expired') return 'bg-neutral-100 text-neutral-600 dark:bg-neutral-800 dark:text-neutral-400'
  if (status === 'pending') return 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300'
  return 'bg-neutral-100 text-neutral-600'
}

function statusLabel(status: string) {
  const key = `promote.boost.status.${status}` as const
  const translated = t(key)
  return translated !== key ? translated : status
}

function formatDate(iso: string | null) {
  if (!iso) return '—'
  try {
    return new Intl.DateTimeFormat(undefined, { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }).format(new Date(iso))
  } catch {
    return iso
  }
}

const sorted = computed(() => [...props.rows].sort((a, b) => (b.starts_at || '').localeCompare(a.starts_at || '')))
</script>

<template>
  <section class="boost-history space-y-3">
    <div class="flex items-center justify-between">
      <h3 class="text-sm font-bold">{{ t('promote.boost.historyTitle') }}</h3>
      <span class="text-[10px] text-neutral-500">{{ rows.length }}</span>
    </div>

    <p v-if="!rows.length" class="rounded-2xl border border-dashed app-divider-subtle px-4 py-8 text-center text-sm text-neutral-500">
      {{ t('promote.boost.historyEmpty') }}
    </p>

    <div v-else class="space-y-2">
      <article
        v-for="row in sorted"
        :key="row.id"
        class="flex gap-3 rounded-2xl border app-divider-subtle p-3 bg-white/80 dark:bg-neutral-900/60 shadow-sm"
      >
        <div class="h-14 w-11 shrink-0 rounded-xl overflow-hidden bg-neutral-100 dark:bg-neutral-800">
          <OfflineImg
            v-if="pinImageBySlug?.[row.pin_slug]"
            :src="pinImageBySlug[row.pin_slug]"
            :alt="row.pin_title"
            class="w-full h-full object-cover"
          />
          <div v-else class="h-full w-full grid place-items-center text-neutral-300">
            <PinovaIcon name="image" class="text-xl" />
          </div>
        </div>
        <div class="min-w-0 flex-1">
          <div class="flex items-start justify-between gap-2">
            <p class="text-sm font-semibold truncate">{{ row.pin_title || row.pin_slug }}</p>
            <span class="shrink-0 rounded-full px-2 py-0.5 text-[9px] font-bold uppercase" :class="statusClass(row.status)">
              {{ statusLabel(row.status) }}
            </span>
          </div>
          <p class="text-xs text-neutral-500 mt-0.5">{{ row.package_label }}</p>
          <p class="text-[10px] text-neutral-400 mt-1">
            {{ formatDate(row.starts_at) }}
            <span v-if="row.ends_at"> → {{ formatDate(row.ends_at) }}</span>
          </p>
          <button
            v-if="row.status === 'expired' || row.status === 'canceled'"
            type="button"
            class="mt-2 text-xs font-bold text-pink-700"
            @click="emit('boost-again', row.pin_slug)"
          >
            {{ t('promote.boost.again') }} →
          </button>
        </div>
      </article>
    </div>
  </section>
</template>
