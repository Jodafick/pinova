<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRoute } from 'vue-router'
import { useI18n } from '../i18n'
import api from '../api'

const route = useRoute()
const { t, currentLang } = useI18n()

const slug = computed(() => String(route.params.slug || ''))
const loading = ref(true)
const error = ref('')
const title = ref('')
const body = ref('')
const updatedAt = ref<string | null>(null)

async function load() {
  const s = slug.value
  if (s !== 'privacy' && s !== 'terms') {
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
  } catch {
    error.value = 'load'
  } finally {
    loading.value = false
  }
}

watch([slug, currentLang], load, { immediate: true })
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 py-10 sm:py-14">
    <p v-if="loading" class="text-sm text-neutral-500">{{ t('app.loading') }}</p>
    <div v-else-if="error === 'invalid'" class="rounded-2xl border border-neutral-200 bg-white p-8 text-center text-neutral-600">
      {{ t('legal.invalid') }}
    </div>
    <div v-else-if="error" class="rounded-2xl border border-red-100 bg-red-50 p-8 text-center text-red-800 text-sm">
      {{ t('legal.loadError') }}
    </div>
    <article v-else class="rounded-3xl border border-neutral-100 bg-white p-8 sm:p-10 shadow-sm">
      <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">{{ title }}</h1>
      <p v-if="updatedAt" class="text-xs text-neutral-400 mb-8">{{ t('legal.updatedAt') }} {{ updatedAt }}</p>
      <div class="legal-body text-sm text-neutral-700 whitespace-pre-wrap leading-relaxed">{{ body }}</div>
    </article>
  </div>
</template>
