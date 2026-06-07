<script setup lang="ts">
import { ref, watch } from 'vue'
import { useI18n } from '../i18n'
import api from '../api/index'
import PinovaButton from '../components/ui/PinovaButton.vue'

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
      ring: 'ring-emerald-200/80 dark:ring-emerald-500/35',
      iconBg: 'bg-emerald-500/15 dark:bg-emerald-500/22 text-emerald-700 dark:text-emerald-300',
      gradient: 'from-emerald-50/90 via-white to-sky-50/50 dark:from-emerald-950/25 dark:via-neutral-900 dark:to-sky-950/20',
    }
  }
  if (slug === 'contact') {
    return {
      icon: 'mail' as const,
      ring: 'ring-pink-200/80 dark:ring-pink-600/35',
      iconBg: 'bg-pink-700/15 dark:bg-pink-600/15 dark:bg-pink-600/22 text-pink-700 dark:text-pink-600',
      gradient: 'from-pink-50/90 via-white to-neutral-50/80 dark:from-pink-950/25 dark:via-neutral-900 dark:to-neutral-900',
    }
  }
  return {
    icon: 'contract' as const,
    ring: 'ring-violet-200/80 dark:ring-violet-500/35',
    iconBg: 'bg-violet-500/15 dark:bg-violet-500/22 text-violet-700 dark:text-violet-300',
    gradient: 'from-violet-50/90 via-white to-amber-50/40 dark:from-violet-950/25 dark:via-neutral-900 dark:to-amber-950/15',
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
  <div class="min-h-[60vh] w-full min-w-0 max-w-3xl mx-auto px-4 py-10 sm:py-14 pb-24">
    <nav class="mb-8 max-lg:hidden flex items-center gap-2 text-sm">
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 text-neutral-500 hover:text-pink-800 font-medium transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        {{ t('legal.backHome') }}
      </router-link>
    </nav>

    <header class="mb-10 text-center sm:text-left">
      <div
        class="inline-flex items-center gap-2 rounded-full border border-pink-200/80 bg-pink-50/80 px-3 py-1 text-[11px] font-bold uppercase tracking-wider text-pink-700 mb-4"
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
      class="app-skeleton-wave w-full min-w-0 app-card rounded-3xl p-8 animate-pulse space-y-6"
      aria-hidden="true"
    >
      <div class="h-28 rounded-2xl bg-neutral-100" />
      <div class="h-28 rounded-2xl bg-neutral-100" />
      <div class="h-40 rounded-2xl bg-neutral-50" />
      <p class="sr-only">{{ t('common.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="app-card rounded-3xl p-10 text-center"
    >
      <span class="material-symbols-outlined text-red-400 text-[44px] mb-3 inline-block">cloud_off</span>
      <p class="text-red-900/90 font-medium text-sm">{{ t('faq.loadError') }}</p>
      <PinovaButton
        variant="secondary"
        class="mt-5 text-sm border-red-300/80 dark:border-red-700/70 text-red-800 dark:text-red-300 hover:bg-red-50 dark:hover:bg-red-900/30"
        @click="load()"
      >
        {{ t('legal.retry') }}
      </PinovaButton>
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
            class="app-card app-card-hover group relative flex flex-col rounded-2xl bg-gradient-to-br p-5 ring-1 ring-black/[0.03] transition hover:-translate-y-0.5"
            :class="[cardVisual(card.slug).gradient, cardVisual(card.slug).ring]"
          >
            <div class="flex items-start gap-3 mb-3">
              <div
                class="flex h-11 w-11 shrink-0 items-center justify-center rounded-xl ring-1 ring-black/[0.05] dark:ring-white/[0.08]"
                :class="cardVisual(card.slug).iconBg"
              >
                <span class="material-symbols-outlined text-[22px]">{{ cardVisual(card.slug).icon }}</span>
              </div>
              <div class="min-w-0 flex-1">
                <h3 class="font-bold text-neutral-900 dark:text-neutral-100 text-sm leading-snug group-hover:text-pink-800 dark:group-hover:text-pink-600 transition-colors">
                  {{ card.title }}
                </h3>
              </div>
              <span
                class="material-symbols-outlined text-neutral-300 dark:text-neutral-600 group-hover:text-pink-800 dark:group-hover:text-pink-600 text-xl shrink-0"
                aria-hidden="true"
              >
                chevron_right
              </span>
            </div>
            <p class="text-xs app-text-muted leading-relaxed line-clamp-4 flex-1">
              {{ card.excerpt }}
            </p>
            <p
              v-if="card.slug === 'contact' && card.contact_email"
              class="mt-3 text-[11px] font-semibold text-pink-700 dark:text-pink-600 truncate"
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

        <div v-if="!items.length" class="app-card-soft rounded-2xl border-dashed p-8 text-center text-sm app-text-muted">
          {{ t('faq.empty') }}
        </div>

        <ul v-else class="space-y-3">
          <li
            v-for="row in items"
            :key="row.id"
            class="app-card rounded-2xl overflow-hidden transition-all duration-200"
            :class="openId === row.id ? 'ring-1 ring-pink-300/80 dark:ring-pink-600/40 border-pink-200/80 dark:border-pink-700/60' : ''"
          >
            <button
              type="button"
              class="app-list-item w-full flex items-center gap-3 text-left px-4 py-4 sm:px-5 transition-colors"
              :class="openId === row.id ? 'is-active bg-pink-50/80 dark:bg-pink-950/30' : ''"
              :aria-expanded="openId === row.id"
              @click="toggle(row.id)"
            >
              <span
                class="flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-pink-700/10 dark:bg-pink-600/10 dark:bg-pink-600/20 text-pink-700 dark:text-pink-600 transition-colors"
                aria-hidden="true"
              >
                <span class="material-symbols-outlined text-[20px]">help</span>
              </span>
              <span class="flex-1 min-w-0 font-semibold text-neutral-900 dark:text-neutral-100 text-sm sm:text-[15px] leading-snug">
                {{ row.question }}
              </span>
              <span
                class="material-symbols-outlined text-neutral-400 dark:text-neutral-500 shrink-0 transition-all duration-200"
                :class="{ 'rotate-180 text-pink-700 dark:text-pink-600': openId === row.id }"
              >
                expand_more
              </span>
            </button>
            <Transition
              enter-active-class="transition-all duration-200 ease-out"
              enter-from-class="opacity-0 -translate-y-1"
              enter-to-class="opacity-100 translate-y-0"
              leave-active-class="transition-all duration-150 ease-in"
              leave-from-class="opacity-100 translate-y-0"
              leave-to-class="opacity-0 -translate-y-1"
            >
              <div
                v-if="openId === row.id"
                class="px-4 pb-4 sm:px-5 sm:pb-5 pt-0 border-t app-divider-subtle"
              >
                <p class="text-sm text-neutral-700 dark:text-neutral-200 leading-relaxed whitespace-pre-wrap pt-4">
                  {{ row.answer }}
                </p>
                <router-link
                  v-if="row.related_legal_slug"
                  :to="legalHref(row.related_legal_slug)"
                  class="mt-4 inline-flex items-center gap-1.5 text-xs font-bold text-pink-700 hover:text-pink-800 dark:text-pink-600 dark:hover:text-pink-600 dark:hover:opacity-80 transition-colors"
                >
                  {{ relatedLabel(row.related_legal_slug) }}
                  <span class="material-symbols-outlined text-[16px]">arrow_forward</span>
                </router-link>
              </div>
            </Transition>
          </li>
        </ul>
      </section>
    </template>
  </div>
</template>
