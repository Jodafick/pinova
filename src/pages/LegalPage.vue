<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../i18n'
import api from '../api'
import { CONTACT_EMAIL as FALLBACK_EMAIL } from '../env'

const route = useRoute()
const { t, currentLang } = useI18n()

const slug = computed(() => String(route.params.slug || ''))
const loading = ref(true)
const error = ref('')
const title = ref('')
const body = ref('')
const updatedAt = ref<string | null>(null)
const contactEmail = ref('')

const mailtoLegalContact = computed(() => {
  if (slug.value !== 'contact') return ''
  const email = contactEmail.value.trim() || FALLBACK_EMAIL
  return `mailto:${email}?subject=${encodeURIComponent('Pinova')}`
})

/** Paragraphes : découpage sur lignes vides pour un rendu plus aéré que `pre-wrap`. */
const bodyParagraphs = computed(() => {
  const raw = body.value.replace(/\r\n/g, '\n').trim()
  if (!raw) return []
  return raw
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean)
})

const formattedUpdatedAt = computed(() => {
  const iso = updatedAt.value
  if (!iso) return ''
  const d = new Date(String(iso))
  if (Number.isNaN(d.getTime())) return String(iso)
  try {
    return new Intl.DateTimeFormat(currentLang.value || 'fr', {
      dateStyle: 'long',
    }).format(d)
  } catch {
    return d.toLocaleDateString()
  }
})

const isSectionHeading = (para: string) => /^\d+\.\s+\S/.test(para.trim())

const isHeroLine = (para: string) => {
  const p = para.trim()
  if (p.length > 140 || !p.includes('—')) return false
  return /^[A-ZÀÉÈÊËÎÏÔÛÜÇ0-9]/.test(p) && !/^\d+\./.test(p)
}

const docVisual = computed(() => {
  if (slug.value === 'privacy') {
    return {
      badge: t('legal.badgePrivacy'),
      icon: 'privacy_tip',
      articleClass:
        'from-emerald-50 via-white to-sky-50/70 dark:from-emerald-950/25 dark:via-neutral-900 dark:to-sky-950/20',
      badgeClass: 'bg-emerald-100 text-emerald-900 border-emerald-200/80',
      iconBg: 'bg-emerald-500/15 text-emerald-700',
    }
  }
  if (slug.value === 'contact') {
    return {
      badge: t('app.footer.contact'),
      icon: 'mail',
      articleClass: 'from-pink-50 via-white to-neutral-50/90 dark:from-pink-950/25 dark:via-neutral-900 dark:to-neutral-900',
      badgeClass: 'bg-pink-100 text-pink-900 border-pink-200/80',
      iconBg: 'bg-pink-700/15 dark:bg-pink-600/15 text-pink-700',
    }
  }
  return {
    badge: t('legal.badgeTerms'),
    icon: 'contract',
    articleClass: 'from-violet-50 via-white to-amber-50/65 dark:from-violet-950/20 dark:via-neutral-900 dark:to-amber-950/15',
    badgeClass: 'bg-violet-100 text-violet-900 border-violet-200/80',
    iconBg: 'bg-violet-500/15 text-violet-700',
  }
})

async function load() {
  const s = slug.value
  if (s !== 'privacy' && s !== 'terms' && s !== 'contact') {
    error.value = 'invalid'
    loading.value = false
    return
  }
  loading.value = true
  error.value = ''
  try {
    const res = await api.get(`legal/${s}/`, { params: { lang: currentLang.value } })
    title.value = res.data?.title || ''
    body.value = res.data?.body || ''
    updatedAt.value = res.data?.updated_at || null
    contactEmail.value =
      typeof res.data?.contact_email === 'string' ? res.data.contact_email : ''
  } catch {
    error.value = 'load'
  } finally {
    loading.value = false
  }
}

watch([slug, currentLang], load, { immediate: true })
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

    <!-- Skeleton -->
    <div
      v-if="loading"
      class="app-skeleton-wave w-full min-w-0 app-card rounded-3xl p-8 sm:p-10 animate-pulse"
      aria-hidden="true"
    >
      <div class="flex flex-wrap items-start gap-4 mb-10">
        <div class="h-14 w-14 rounded-2xl bg-neutral-200 shrink-0" />
        <div class="flex-1 min-w-0 space-y-3 pt-1">
          <div class="h-5 w-24 rounded-full bg-neutral-200/90" />
          <div class="h-9 sm:h-10 w-4/5 max-w-md rounded-xl bg-neutral-200" />
          <div class="h-4 w-40 rounded-lg bg-neutral-100" />
        </div>
      </div>
      <div class="space-y-4">
        <div class="h-4 rounded-lg bg-neutral-100 w-full" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[94%]" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[88%]" />
        <div class="h-4 rounded-lg bg-neutral-50 w-full mt-8" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[92%]" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[78%]" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[85%]" />
        <div class="h-4 rounded-lg bg-neutral-50 w-full mt-8" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[90%]" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[70%]" />
      </div>
      <p class="sr-only">{{ t('app.loading') }}</p>
    </div>

    <!-- Erreur slug -->
    <div
      v-else-if="error === 'invalid'"
      class="app-card-soft rounded-3xl p-10 sm:p-12 text-center"
    >
      <span
        class="material-symbols-outlined text-neutral-400 text-[48px] mb-4 inline-block"
        aria-hidden="true"
      >
        error
      </span>
      <p class="text-neutral-700 font-medium">{{ t('legal.invalid') }}</p>
      <router-link
        to="/"
        class="mt-6 app-btn app-btn-primary text-sm"
      >
        {{ t('legal.backHome') }}
      </router-link>
    </div>

    <!-- Erreur chargement -->
    <div
      v-else-if="error"
      class="app-card rounded-3xl p-10 sm:p-12 text-center border-rose-300/70"
    >
      <span
        class="material-symbols-outlined text-red-400 text-[44px] mb-4 inline-block"
        aria-hidden="true"
      >
        cloud_off
      </span>
      <p class="text-red-900/90 font-medium text-sm">{{ t('legal.loadError') }}</p>
      <button
        type="button"
        class="mt-6 app-btn app-btn-secondary text-sm border-rose-300 text-rose-700 dark:text-rose-300"
        @click="load()"
      >
        {{ t('legal.retry') }}
      </button>
    </div>

    <!-- Document -->
    <article
      v-else
      class="app-card relative rounded-3xl bg-gradient-to-br overflow-hidden ring-1 ring-black/[0.04]"
      :class="docVisual.articleClass"
    >
      <div class="relative p-8 sm:p-11 lg:p-12">
        <header class="flex flex-wrap items-start gap-5 pb-9 mb-2 border-b app-divider-subtle">
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/[0.05]"
            :class="docVisual.iconBg"
          >
            <span class="material-symbols-outlined text-[28px]">{{ docVisual.icon }}</span>
          </div>
          <div class="min-w-0 flex-1 pt-0.5 space-y-3">
            <span
              class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider"
              :class="[docVisual.badgeClass, 'dark:bg-neutral-800/80 dark:text-neutral-100 dark:border-neutral-700']"
            >
              {{ docVisual.badge }}
            </span>
            <h1 class="text-2xl sm:text-3xl lg:text-[2rem] font-bold text-neutral-900 dark:text-neutral-100 tracking-tight text-balance">
              {{ title }}
            </h1>
            <p v-if="formattedUpdatedAt" class="text-xs sm:text-sm text-neutral-500 dark:text-neutral-300 font-medium">
              {{ t('legal.updatedAt') }}
              <time :datetime="updatedAt ?? undefined">{{ formattedUpdatedAt }}</time>
            </p>
          </div>
        </header>

        <div class="legal-prose mt-10 space-y-0">
          <template v-for="(para, i) in bodyParagraphs" :key="i">
            <h2
              v-if="isSectionHeading(para)"
              class="text-base sm:text-lg font-bold text-neutral-900 dark:text-neutral-100 mt-10 mb-3 first:mt-0 scroll-mt-24"
            >
              {{ para }}
            </h2>
            <p
              v-else
              class="mb-5 text-[15px] sm:text-base text-neutral-700 dark:text-neutral-200 leading-[1.75] text-pretty whitespace-pre-wrap"
              :class="{
                'text-neutral-900 dark:text-neutral-100 font-semibold tracking-tight mb-6 text-[17px] sm:text-xl': i === 0 && isHeroLine(para),
                'border-l-[3px] border-pink-300/90 dark:border-pink-600/70 pl-4 py-0.5 my-6 text-neutral-600 dark:text-neutral-300 italic text-sm bg-pink-50/40 dark:bg-pink-950/25 rounded-r-lg rounded-l-none':
                  para.includes('⚠️') || para.toLowerCase().includes('attention'),
              }"
            >
              {{ para }}
            </p>
          </template>
        </div>

        <div
          v-if="slug === 'contact'"
          class="mt-10 pt-8 border-t app-divider-subtle"
        >
          <a
            :href="mailtoLegalContact"
            class="app-btn app-btn-primary inline-flex items-center justify-center gap-2 px-6 py-3.5 text-sm shadow-md"
          >
            <span class="material-symbols-outlined text-xl">outgoing_mail</span>
            {{ t('contact.emailCta') }}
          </a>
          <p class="mt-3 text-sm text-pink-700 dark:text-pink-600 font-medium break-all">
            {{ contactEmail.trim() || FALLBACK_EMAIL }}
          </p>
        </div>
      </div>
    </article>
  </div>
</template>
