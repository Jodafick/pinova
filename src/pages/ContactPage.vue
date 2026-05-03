<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useI18n } from '../i18n'
import api from '../api'
import { CONTACT_EMAIL as FALLBACK_EMAIL } from '../env'

const { t, currentLang } = useI18n()

const loading = ref(true)
const error = ref('')
const title = ref('')
const body = ref('')
const contactEmail = ref('')
const updatedAt = ref<string | null>(null)

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

const mailtoHref = computed(() => {
  const email = contactEmail.value.trim() || FALLBACK_EMAIL
  const subject = encodeURIComponent('Pinova')
  return `mailto:${email}?subject=${subject}`
})

async function load() {
  loading.value = true
  error.value = ''
  try {
    const res = await api.get('legal/contact/', { params: { lang: currentLang.value } })
    title.value = res.data?.title || ''
    body.value = res.data?.body || ''
    contactEmail.value = (res.data?.contact_email as string) || ''
    updatedAt.value = res.data?.updated_at || null
  } catch {
    error.value = 'load'
    title.value = ''
    body.value = ''
    contactEmail.value = ''
    updatedAt.value = null
  } finally {
    loading.value = false
  }
}

watch(currentLang, load, { immediate: true })
</script>

<template>
  <div class="min-h-[60vh] max-w-xl mx-auto px-4 py-10 sm:py-14 pb-24">
    <nav class="mb-8 flex items-center gap-2 text-sm">
      <router-link
        to="/"
        class="inline-flex items-center gap-1.5 text-neutral-500 hover:text-pink-600 font-medium transition-colors"
      >
        <span class="material-symbols-outlined text-[18px]">arrow_back</span>
        {{ t('legal.backHome') }}
      </router-link>
    </nav>

    <div
      v-if="loading"
      class="rounded-3xl border border-neutral-100 bg-white p-8 sm:p-10 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.12)] ring-1 ring-neutral-900/[0.04] animate-pulse"
      aria-hidden="true"
    >
      <div class="flex flex-wrap items-start gap-4 mb-8">
        <div class="h-14 w-14 rounded-2xl bg-neutral-200 shrink-0" />
        <div class="flex-1 min-w-0 space-y-3 pt-1">
          <div class="h-5 w-28 rounded-full bg-neutral-200/90" />
          <div class="h-9 w-4/5 max-w-sm rounded-xl bg-neutral-200" />
          <div class="h-4 w-36 rounded-lg bg-neutral-100" />
        </div>
      </div>
      <div class="space-y-3 mb-8">
        <div class="h-4 rounded-lg bg-neutral-100 w-full" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[92%]" />
        <div class="h-4 rounded-lg bg-neutral-100 w-[88%]" />
      </div>
      <div class="h-12 w-full max-w-xs rounded-full bg-neutral-200" />
      <p class="sr-only">{{ t('app.loading') }}</p>
    </div>

    <div
      v-else-if="error"
      class="rounded-3xl border border-red-200/90 bg-gradient-to-br from-red-50 to-white p-10 sm:p-12 text-center shadow-sm"
    >
      <span class="material-symbols-outlined text-red-400 text-[44px] mb-4 inline-block" aria-hidden="true">
        cloud_off
      </span>
      <p class="text-red-900/90 font-medium text-sm">{{ t('legal.loadError') }}</p>
      <button
        type="button"
        class="mt-6 inline-flex items-center justify-center px-5 py-2.5 rounded-full border border-red-300/80 bg-white text-red-800 text-sm font-semibold hover:bg-red-50 transition-colors"
        @click="load()"
      >
        {{ t('legal.retry') }}
      </button>
    </div>

    <article
      v-else
      class="relative rounded-3xl border border-neutral-100/90 bg-gradient-to-br from-pink-50/90 via-white to-neutral-50 shadow-[0_24px_60px_-20px_rgba(15,23,42,0.12)] overflow-hidden ring-1 ring-black/[0.04]"
    >
      <div class="relative p-8 sm:p-10">
        <header class="flex flex-wrap items-start gap-5 pb-8 mb-2 border-b border-neutral-200/70">
          <div
            class="flex h-14 w-14 shrink-0 items-center justify-center rounded-2xl ring-1 ring-black/[0.05] bg-pink-500/15 text-pink-700"
          >
            <span class="material-symbols-outlined text-[28px]">mail</span>
          </div>
          <div class="min-w-0 flex-1 pt-0.5 space-y-3">
            <span
              class="inline-flex items-center rounded-full border px-3 py-1 text-[11px] font-bold uppercase tracking-wider bg-pink-100 text-pink-900 border-pink-200/80"
            >
              {{ t('app.footer.contact') }}
            </span>
            <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 tracking-tight text-balance">
              {{ title }}
            </h1>
            <p v-if="formattedUpdatedAt" class="text-xs sm:text-sm text-neutral-500 font-medium">
              {{ t('legal.updatedAt') }}
              <time :datetime="updatedAt ?? undefined">{{ formattedUpdatedAt }}</time>
            </p>
          </div>
        </header>

        <div class="mt-8 space-y-5">
          <p
            v-for="(para, i) in bodyParagraphs"
            :key="i"
            class="text-[15px] sm:text-base text-neutral-700 leading-relaxed text-pretty whitespace-pre-wrap"
          >
            {{ para }}
          </p>
        </div>

        <div class="mt-10 pt-8 border-t border-neutral-200/70">
          <a
            :href="mailtoHref"
            class="inline-flex items-center justify-center gap-2 w-full sm:w-auto min-w-[220px] px-6 py-3.5 rounded-full bg-pink-600 text-white text-sm font-semibold shadow-md hover:bg-pink-700 transition"
          >
            <span class="material-symbols-outlined text-xl">outgoing_mail</span>
            {{ t('contact.emailCta') }}
          </a>
          <p class="mt-3 text-sm text-pink-900/80 font-medium break-all">
            {{ contactEmail.trim() || FALLBACK_EMAIL }}
          </p>
        </div>
      </div>
    </article>
  </div>
</template>
