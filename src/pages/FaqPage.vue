<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '../i18n'
import api from '../api'

const { t, currentLang } = useI18n()

type LegalCard = {
  slug: string
  title: string
  excerpt: string
  updated_at?: string | null
  contact_email?: string
}

type FaqItem = {
  id: number
  question: string
  answer: string
  related_legal_slug?: string | null
}

const loading = ref(true)
const error = ref('')
const items = ref<FaqItem[]>([])
const legalCards = ref<LegalCard[]>([])
const openId = ref<number | null>(null)

function legalHref(slug: string) {
  if (slug === 'contact') return '/contact'
  return `/legal/${slug}`
}

function cardVisual(slug: string) {
  if (slug === 'privacy') {
    return {
      icon: 'privacy_tip' as const,
      ring: 'ring-emerald-200/80',
      iconBg: 'bg-emerald-500/15 text-emerald-700',
      gradient: 'from-emerald-50/90 via-white to-sky-50/50',
    }
  }
  if (slug === 'contact') {
    return {
      icon: 'mail' as const,
      ring: 'ring-pink-200/80',
      iconBg: 'bg-pink-500/15 text-pink-700',
      gradient: 'from-pink-50/90 via-white to-neutral-50/80',
    }
  }
  return {
    icon: 'contract' as const,
    ring: 'ring-violet-200/80',
    iconBg: 'bg-violet-500/15 text-violet-700',
    gradient: 'from-violet-50/90 via-white to-amber-50/40',
  }
}

function relatedLabel(slug: string | null | undefined) {
  if (slug === 'privacy') return t('legal.badgePrivacy')
  if (slug === 'terms') return t('legal.badgeTerms')
  if (slug === 'contact') return t('app.footer.contact')
  return t('faq.openDoc')
}

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('faq/', { params: { lang: currentLang.value } })
    items.value = Array.isArray(res.data?.items) ? res.data.items : []
    legalCards.value = Array.isArray(res.data?.legal_cards) ? res.data.legal_cards : []
  } catch {
    error.value = 'load'
    items.value = []
    legalCards.value = []
  } finally {
    loading.value = false
  }
}

function toggle(id: number) {
  openId.value = openId.value === id ? null : id
}

watch(currentLang, load, { immediate: true })
</script>

<template>
  <div class="min-h-[60vh] max-w-3xl mx-auto px-4 py-10 sm:py-14 pb-24">
    <nav class="mb-8 flex items-center gap-2 text-sm">
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 text-neutral-500 hover:text-pink-600 font-medium transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        {{ t('legal.backHome') }}
      </router-link>
    </nav>

    <header class="mb-10 text-center sm:text-left">
      <div
        class="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-pink-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-pink-800 mb-4"
      >
        <span class="material-symbols-outlined text-[16px]">quiz</span>
        {{ t('nav.faq') }}
      </div>
      <h1 class="text-3xl sm:text-4xl font-bold text-neutral-900 tracking-tight text-balance">
        {{ t('faq.title') }}
      </h1>
      <p class="mt-3 text-neutral-600 text-sm sm:text-base max-w-2xl mx-auto sm:mx-0 leading-relaxed">
        {{ t('faq.subtitle') }}
      </p>
    </header>

    <div
      v-if="loading"
      class="rounded-3xl border border-neutral-100 bg-white p-8 shadow-sm animate-pulse space-y-6"
      aria-hidden="true"
    >
      <div class="h-28 rounded-2xl bg-neutral-100" />
      <div class="h-28 rounded-2xl bg-neutral-100" />
      <div class="h-40 rounded-2xl bg-neutral-50" />
      <p class="sr-only">{{ t('common.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="rounded-3xl border border-red-200/90 bg-gradient-to-br from-red-50 to-white p-10 text-center shadow-sm"
    >
      <span class="material-symbols-outlined text-red-400 text-[44px] mb-3 inline-block">cloud_off</span>
      <p class="text-red-900/90 font-medium text-sm">{{ t('faq.loadError') }}</p>
      <button
        type="button"
        class="mt-5 inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-red-300/80 bg-white text-red-800 text-sm font-semibold hover:bg-red-50 transition-colors"
        @click="load()"
      >
        {{ t('legal.retry') }}
      </button>
    </div>

    <template v-else>
      <section v-if="legalCards.length" class="mb-12">
        <h2 class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">
          {{ t('faq.sectionLegal') }}
        </h2>
        <div class="grid gap-4 sm:grid-cols-3">
          <router-link
            v-for="card in legalCards"
            :key="card.slug"
            :to="legalHref(card.slug)"
            class="group relative flex flex-col rounded-2xl border border-neutral-100/90 bg-gradient-to-br p-5 shadow-[0_16px_40px_-18px_rgba(15,23,42,0.12)] ring-1 ring-black/[0.03] transition hover:shadow-lg hover:-translate-y-0.5"
            :class="[cardVisual(card.slug).gradient, cardVisual(card.slug).ring]"
          >
            <div class="flex items-start gap-3 mb-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.05]"
                :class="cardVisual(card.slug).iconBg"
              >
                <span class="material-symbols-outlined text-[22px]">{{ cardVisual(card.slug).icon }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="font-bold text-neutral-900 text-sm leading-snug group-hover:text-pink-700 transition-colors">
                  {{ card.title }}
                </h3>
              </div>
              <span
                class="material-symbols-outlined text-neutral-300 group-hover:text-pink-500 text-xl shrink-0"
                aria-hidden="true"
              >
                chevron_right
              </span>
            </div>
            <p class="text-xs text-neutral-600 leading-relaxed line-clamp-4 flex-1">
              {{ card.excerpt }}
            </p>
            <p
              v-if="card.slug === 'contact' && card.contact_email"
              class="mt-3 text-[11px] font-semibold text-pink-700 truncate"
            >
              {{ card.contact_email }}
            </p>
          </router-link>
        </div>
      </section>

      <section>
        <h2 class="text-xs font-bold uppercase tracking-wider text-neutral-500 mb-4">
          {{ t('faq.sectionQuestions') }}
        </h2>

        <div v-if="!items.length" class="rounded-2xl border border-dashed border-neutral-200 bg-neutral-50/60 p-8 text-center text-sm text-neutral-600">
          {{ t('faq.empty') }}
        </div>

        <ul v-else class="space-y-3">
          <li
            v-for="row in items"
            :key="row.id"
            class="rounded-2xl border border-neutral-100 bg-white shadow-sm overflow-hidden"
          >
            <button
              type="button"
              class="w-full flex items-center gap-3 text-left px-4 py-4 sm:px-5 hover:bg-neutral-50/80 transition-colors"
              :aria-expanded="openId === row.id"
              @click="toggle(row.id)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-500/10 text-pink-600"
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[20px]">help</span>
              </span>
              <span class="flex-1 min-w-0 font-semibold text-neutral-900 text-sm sm:text-[15px] leading-snug">
                {{ row.question }}
              </span>
              <span
                class="material-symbols-outlined text-neutral-400 shrink-0 transition-transform duration-200"
                :class="{ 'rotate-180': openId === row.id }"
              >
                expand_more
              </span>
            </button>
            <div
              v-show="openId === row.id"
              class="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t border-neutral-100/80"
            >
              <p class="text-sm text-neutral-700 leading-relaxed whitespace-pre-wrap pt-4">
                {{ row.answer }}
              </p>
              <router-link
                v-if="row.related_legal_slug"
                :to="legalHref(row.related_legal_slug)"
                class="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-pink-600 hover:text-pink-700"
              >
                {{ relatedLabel(row.related_legal_slug) }}
                <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
              </router-link>
            </div>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
