<script setup lang="ts">
import { computed, ref } from 'vue'
import { useI18n } from '../i18n'

const { t } = useI18n()

defineProps<{
  creator: string
  creatorAvatar: string
  certifiedAt?: string
  hash?: string
}>()

const open = ref(false)

const chain = computed(() => [
  {
    type: 'creation',
    user: 'sarah_design',
    label: t('provenance.step.creation'),
    date: '12/01/2026',
    avatar: 'bg-pink-500',
    verified: true,
  },
  {
    type: 'remix',
    user: 'mohamed',
    label: t('provenance.step.remix'),
    date: '03/03/2026',
    avatar: 'bg-blue-500',
    verified: true,
  },
  {
    type: 'repin',
    user: 'lea_archi',
    label: t('provenance.step.repin'),
    date: '18/04/2026',
    avatar: 'bg-amber-500',
    verified: true,
  },
])
</script>

<template>
  <div class="border border-neutral-100 rounded-2xl overflow-hidden bg-gradient-to-br from-emerald-50/50 via-white to-blue-50/50">
    <button
      class="w-full px-4 py-3 flex items-center justify-between gap-3 hover:bg-white/40 transition"
      @click="open = !open"
    >
      <div class="flex items-center gap-3 min-w-0">
        <div class="w-9 h-9 rounded-full bg-emerald-500 flex items-center justify-center shrink-0">
          <span class="material-symbols-outlined text-white text-lg fill-1">verified</span>
        </div>
        <div class="text-left min-w-0">
          <p class="text-sm font-bold text-neutral-900 flex items-center gap-1.5">
            {{ t('provenance.title') }}
            <span class="material-symbols-outlined text-xs text-emerald-600">lock</span>
          </p>
          <p class="text-[11px] text-neutral-500 truncate">
            {{ t('provenance.subtitle') }}
          </p>
        </div>
      </div>
      <span
        class="material-symbols-outlined text-neutral-400 transition-transform"
        :class="{ 'rotate-180': open }"
      >expand_more</span>
    </button>

    <div v-if="open" class="px-4 pb-4">
      <div class="bg-white rounded-xl p-4 border border-neutral-100">
        <!-- Creator -->
        <div class="flex items-start gap-3 pb-3 border-b border-neutral-50">
          <div class="w-10 h-10 rounded-full flex items-center justify-center text-sm font-bold text-white shrink-0" :class="creatorAvatar">
            {{ creator[0] }}
          </div>
          <div class="flex-1 min-w-0">
            <div class="flex items-center gap-1.5">
              <p class="text-sm font-bold text-neutral-900">{{ creator }}</p>
              <span class="material-symbols-outlined text-base text-emerald-600 fill-1">verified</span>
            </div>
            <p class="text-xs text-neutral-500">{{ t('provenance.creator') }}</p>
            <p class="text-[10px] text-neutral-400 mt-1">{{ t('provenance.certifiedOn', { date: certifiedAt || '12/01/2026' }) }}</p>
          </div>
        </div>

        <!-- Chain -->
        <div class="pt-3">
          <p class="text-[11px] uppercase tracking-wider text-neutral-400 font-semibold mb-3">
            {{ t('provenance.history') }}
          </p>
          <div class="relative">
            <div class="absolute left-3.5 top-2 bottom-2 w-px bg-neutral-200"></div>
            <div v-for="(step, i) in chain" :key="i" class="relative flex items-start gap-3 pb-3 last:pb-0">
              <div
                class="w-7 h-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white shrink-0 ring-4 ring-white relative z-10"
                :class="step.avatar"
              >
                {{ step.user[0].toUpperCase() }}
              </div>
              <div class="flex-1 min-w-0 pt-0.5">
                <div class="flex items-center gap-1.5 flex-wrap">
                  <span class="text-xs font-semibold text-neutral-800">@{{ step.user }}</span>
                  <span
                    class="text-[9px] uppercase tracking-wide px-1.5 py-0.5 rounded font-bold"
                    :class="step.type === 'creation' ? 'bg-pink-100 text-pink-700' : step.type === 'remix' ? 'bg-purple-100 text-purple-700' : 'bg-blue-100 text-blue-700'"
                  >{{ step.label }}</span>
                  <span v-if="step.verified" class="material-symbols-outlined text-xs text-emerald-600 fill-1">verified</span>
                </div>
                <p class="text-[11px] text-neutral-500">{{ step.date }}</p>
              </div>
            </div>
          </div>
        </div>

        <!-- Hash -->
        <div class="mt-4 pt-3 border-t border-neutral-50">
          <p class="text-[10px] uppercase tracking-wider text-neutral-400 font-semibold mb-1">
            {{ t('provenance.hash') }}
          </p>
          <div class="flex items-center gap-2 bg-neutral-50 rounded-lg px-3 py-2 font-mono text-[10px] text-neutral-600">
            <span class="material-symbols-outlined text-sm">tag</span>
            <span class="truncate flex-1">{{ hash || '0x7f4a8b...c9e2d1' }}</span>
            <button class="text-neutral-400 hover:text-neutral-700">
              <span class="material-symbols-outlined text-sm">content_copy</span>
            </button>
          </div>
          <p class="text-[10px] text-neutral-400 mt-2">
            {{ t('provenance.hash.note') }}
          </p>
        </div>
      </div>
    </div>
  </div>
</template>
