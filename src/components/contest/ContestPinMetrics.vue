<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    likes?: number
    views?: number
    shares?: number
    saves?: number
    comments?: number
    variant?: 'row' | 'grid' | 'podium'
    /** Hors top 3 : icônes neutres (pas de couleurs par métrique). */
    neutralIcons?: boolean
  }>(),
  {
    likes: 0,
    views: 0,
    shares: 0,
    saves: 0,
    comments: 0,
    variant: 'row',
    neutralIcons: false,
  },
)

/** Métriques d’engagement : Font Awesome uniquement. */
const metrics = computed(() =>
  [
    {
      key: 'likes',
      value: props.likes ?? 0,
      icon: 'fa-heart',
      tone: 'text-rose-500 dark:text-rose-400',
    },
    {
      key: 'views',
      value: props.views ?? 0,
      icon: 'fa-eye',
      tone: 'text-sky-600 dark:text-sky-400',
    },
    {
      key: 'shares',
      value: props.shares ?? 0,
      icon: 'fa-share-nodes',
      tone: 'text-violet-600 dark:text-violet-400',
    },
    {
      key: 'saves',
      value: props.saves ?? 0,
      icon: 'fa-bookmark',
      tone: 'text-amber-600 dark:text-amber-400',
    },
    {
      key: 'comments',
      value: props.comments ?? 0,
      icon: 'fa-comment',
      tone: 'text-emerald-600 dark:text-emerald-400',
    },
  ] as const,
)

const wrapClass = computed(() => {
  if (props.variant === 'podium') {
    return 'flex flex-wrap items-center justify-center gap-x-1.5 gap-y-1 lg:gap-x-2 min-w-0 max-w-full'
  }
  if (props.variant === 'grid') {
    return 'flex flex-wrap items-center justify-center gap-x-0 gap-y-1 min-w-0 w-full pt-1.5 mt-1 border-t border-neutral-200/65 dark:border-neutral-700/55'
  }
  return 'flex flex-nowrap items-center gap-1 min-w-0 lg:gap-1.5'
})

function chipClass() {
  if (props.variant === 'podium') {
    return 'inline-flex items-center gap-0.5 shrink-0 leading-none text-neutral-600 dark:text-[rgba(240,237,232,0.5)] text-[11px] lg:text-[10px]'
  }
  if (props.variant === 'grid') {
    return 'flex basis-[30%] grow-0 min-w-[2.25rem] max-w-[33%] justify-center items-center gap-0.5 text-[9px] font-bold tabular-nums text-neutral-600 dark:text-neutral-400'
  }
  return 'inline-flex items-center gap-0.5 px-1 py-0.5 lg:px-1.5 rounded-md bg-neutral-100 dark:bg-neutral-800 shrink-0 min-w-0 text-[10px] font-semibold text-neutral-600 dark:text-neutral-300'
}

function iconToneClass(m: { tone: string }) {
  if (props.neutralIcons) return 'text-neutral-500 dark:text-neutral-400'
  if (props.variant === 'podium') return `${m.tone} opacity-[0.88] dark:opacity-100`
  return m.tone
}
</script>

<template>
  <div :class="wrapClass">
    <span v-for="m in metrics" :key="m.key" :class="chipClass()">
      <i
        class="fa-solid leading-none shrink-0"
        :class="[
          m.icon,
          variant === 'grid' ? 'text-[11px]' : 'text-[12px]',
          iconToneClass(m),
        ]"
        aria-hidden="true"
      />
      <span class="tabular-nums truncate min-w-0">{{ m.value }}</span>
    </span>
  </div>
</template>
