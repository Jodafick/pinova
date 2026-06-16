<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'

import api from '../api/index'
import { useI18n } from '../i18n'
import type { ReferralLeaderboardHttpDto, ReferralMeDto } from '../types/referral'

const { t } = useI18n()

const me = ref<ReferralMeDto | null>(null)
const leaderboard = ref<ReferralLeaderboardHttpDto | null>(null)
const refereeCount = ref(0)
const loading = ref(true)
const copyHint = ref('')
const error = ref('')

const linkWeb = computed(() => me.value?.link_web || '')
const myCode = computed(() => me.value?.my_code || '')

const qrSrc = computed(() => {
  if (!linkWeb.value) return ''
  const enc = encodeURIComponent(linkWeb.value)
  return `https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${enc}`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const [meRes, lbRes, refRes] = await Promise.all([
      api.get<ReferralMeDto>('referrals/me/'),
      api.get<ReferralLeaderboardHttpDto>('referrals/leaderboard/', { params: { limit: 5 } }),
      api.get<{ results: unknown[] }>('referrals/my-referees/'),
    ])
    me.value = meRes.data
    leaderboard.value = lbRes.data
    refereeCount.value = Array.isArray(refRes.data?.results) ? refRes.data.results.length : 0
  } catch {
    error.value = t('referral.error.load')
  } finally {
    loading.value = false
  }
}

onMounted(() => {
  void load()
})

const viewerScore = computed(() => leaderboard.value?.viewer?.row?.total_score ?? null)
const viewerRank = computed(() => leaderboard.value?.viewer?.rank ?? null)

async function copyText(text: string, msgKey: 'link' | 'code') {
  try {
    await navigator.clipboard.writeText(text)
    copyHint.value = msgKey === 'link' ? t('referral.invite.copiedLink') : t('referral.invite.copiedCode')
    setTimeout(() => {
      copyHint.value = ''
    }, 2200)
  } catch {
    copyHint.value = t('referral.invite.copyFail')
  }
}

function shareNative() {
  const url = linkWeb.value
  if (!url) return
  const payload = { title: 'Fotoce', text: t('referral.invite.shareText', { code: myCode.value }), url }
  if (navigator.share) {
    void navigator.share(payload).catch(() => undefined)
  } else {
    void copyText(url, 'link')
  }
}
</script>

<template>
  <div class="w-full min-w-0 max-w-lg mx-auto px-4 py-8 space-y-6">
    <div>
      <h1 class="text-2xl font-bold text-neutral-900 dark:text-white">{{ t('referral.invite.title') }}</h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-400 mt-1">{{ t('referral.invite.subtitle') }}</p>
    </div>

    <div v-if="loading" class="h-40 rounded-2xl bg-neutral-200 dark:bg-neutral-800 animate-pulse" />
    <p v-else-if="error" class="text-sm text-red-600">{{ error }}</p>

    <template v-else>
      <div class="grid grid-cols-2 gap-3">
        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <p class="text-[10px] uppercase text-neutral-500 font-semibold">{{ t('referral.invite.stats.referees') }}</p>
          <p class="text-2xl font-bold text-pink-700">{{ refereeCount }}</p>
        </div>
        <div class="rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <p class="text-[10px] uppercase text-neutral-500 font-semibold">{{ t('referral.invite.stats.rank') }}</p>
          <p class="text-2xl font-bold text-neutral-900 dark:text-white">
            {{ viewerRank != null ? `#${viewerRank}` : '—' }}
          </p>
        </div>
        <div class="col-span-2 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-4">
          <p class="text-[10px] uppercase text-neutral-500 font-semibold">{{ t('referral.invite.stats.score') }}</p>
          <p class="text-2xl font-bold text-violet-600 dark:text-violet-400">
            {{ viewerScore != null ? viewerScore.toFixed(1) : '—' }}
          </p>
        </div>
      </div>

      <div class="rounded-2xl border border-pink-200/70 dark:border-pink-900/50 bg-gradient-to-br from-pink-50 to-white dark:from-pink-950/30 dark:to-neutral-900 p-6 space-y-4">
        <div>
          <p class="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{{ t('referral.invite.codeLabel') }}</p>
          <p class="text-3xl font-mono font-bold tracking-widest text-pink-700 dark:text-pink-600 mt-1">{{ myCode }}</p>
        </div>
        <div class="flex flex-wrap gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full bg-pink-700 dark:bg-pink-600 text-white px-4 py-2 text-sm font-semibold hover:bg-pink-800 dark:hover:opacity-90 transition"
            @click="shareNative"
          >
            <i class="fa-solid fa-share-nodes text-lg" aria-hidden="true" />
            {{ t('referral.invite.share') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            @click="copyText(myCode, 'code')"
          >
            <i class="fa-solid fa-copy text-lg" aria-hidden="true" />
            {{ t('referral.invite.copyCode') }}
          </button>
          <button
            type="button"
            class="inline-flex items-center gap-2 rounded-full border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm font-medium hover:bg-neutral-100 dark:hover:bg-neutral-800 transition"
            @click="copyText(linkWeb, 'link')"
          >
            <i class="fa-solid fa-link text-lg" aria-hidden="true" />
            {{ t('referral.invite.copyLink') }}
          </button>
        </div>
        <p v-if="copyHint" class="text-xs text-emerald-600 dark:text-emerald-400">{{ copyHint }}</p>
        <p class="text-xs text-neutral-500 break-all">{{ linkWeb }}</p>
      </div>

      <div class="flex flex-col sm:flex-row items-center gap-6 rounded-2xl border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 p-6">
        <div class="shrink-0 rounded-xl overflow-hidden border border-neutral-200 dark:border-neutral-700 bg-white p-2">
          <img v-if="qrSrc" :src="qrSrc" alt="" width="200" height="200" class="block" loading="lazy" />
        </div>
        <div class="text-sm text-neutral-600 dark:text-neutral-400">
          <p class="font-semibold text-neutral-900 dark:text-white mb-1">{{ t('referral.invite.qrTitle') }}</p>
          <p>{{ t('referral.invite.qrHelp') }}</p>
        </div>
      </div>

      <router-link
        to="/referrals/contest"
        class="block text-center text-sm font-medium text-pink-700 hover:underline"
      >
        {{ t('referral.invite.seeContest') }}
      </router-link>
    </template>
  </div>
</template>
