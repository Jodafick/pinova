<script setup lang="ts">
import { onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'

type CampaignRow = {
  id: number
  title: string
  sponsor_name: string
  is_active: boolean
  impressions: number
  clicks: number
}

const { t } = useI18n()
const router = useRouter()
const { currentUser } = useAuth()
const { showAlert } = useAppModal()

const campaigns = ref<CampaignRow[]>([])
const pending = ref(false)
const title = ref('')
const body = ref('')
const sponsorName = ref('')
const ctaLabel = ref('En savoir plus')
const ctaUrl = ref('')
const topicSlug = ref('')
const imageFile = ref<File | null>(null)

onMounted(() => {
  if (!currentUser.value?.isStaff) {
    void router.replace('/')
    return
  }
  void loadCampaigns()
})

async function loadCampaigns() {
  const res = await api.get<{ results: CampaignRow[] }>('monetization/partner-campaigns/')
  campaigns.value = res.data.results ?? []
}

async function submit() {
  if (!title.value.trim() || !ctaUrl.value.trim()) {
    await showAlert(t('staff.partnerAds.validation'), { variant: 'warning' })
    return
  }
  pending.value = true
  try {
    const fd = new FormData()
    fd.append('title', title.value.trim())
    fd.append('body', body.value.trim())
    fd.append('sponsor_name', sponsorName.value.trim())
    fd.append('cta_label', ctaLabel.value.trim() || 'En savoir plus')
    fd.append('cta_url', ctaUrl.value.trim())
    fd.append('topic_slug', topicSlug.value.trim())
    fd.append('is_active', 'true')
    if (imageFile.value) fd.append('image', imageFile.value)
    await api.post('monetization/partner-campaigns/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    title.value = ''
    body.value = ''
    sponsorName.value = ''
    ctaUrl.value = ''
    topicSlug.value = ''
    imageFile.value = null
    await loadCampaigns()
    await showAlert(t('staff.partnerAds.created'), { variant: 'success' })
  } catch {
    await showAlert(t('staff.partnerAds.error'), { variant: 'danger' })
  } finally {
    pending.value = false
  }
}

function onFileChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  imageFile.value = input.files?.[0] ?? null
}

async function deactivate(id: number) {
  await api.delete(`monetization/partner-campaigns/${id}/`)
  await loadCampaigns()
}
</script>

<template>
  <div class="max-w-lg mx-auto px-4 py-8 space-y-8">
    <header>
      <h1 class="text-2xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100">
        {{ t('staff.partnerAds.title') }}
      </h1>
      <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{{ t('staff.partnerAds.lead') }}</p>
    </header>

    <form class="app-card rounded-2xl p-5 space-y-4" @submit.prevent="submit">
      <div>
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">{{ t('staff.partnerAds.fieldTitle') }}</label>
        <input v-model="title" type="text" required class="mt-1 w-full rounded-xl border app-input" />
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">{{ t('staff.partnerAds.fieldBody') }}</label>
        <textarea v-model="body" rows="2" class="mt-1 w-full rounded-xl border app-input" />
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">{{ t('staff.partnerAds.fieldSponsor') }}</label>
        <input v-model="sponsorName" type="text" class="mt-1 w-full rounded-xl border app-input" />
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">{{ t('staff.partnerAds.fieldImage') }}</label>
        <input type="file" accept="image/*" class="mt-1 w-full text-sm" @change="onFileChange" />
      </div>
      <div class="grid grid-cols-2 gap-3">
        <div>
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">{{ t('staff.partnerAds.fieldCta') }}</label>
          <input v-model="ctaLabel" type="text" class="mt-1 w-full rounded-xl border app-input" />
        </div>
        <div>
          <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">URL</label>
          <input v-model="ctaUrl" type="url" required class="mt-1 w-full rounded-xl border app-input" />
        </div>
      </div>
      <div>
        <label class="text-xs font-medium text-neutral-600 dark:text-neutral-300">{{ t('staff.partnerAds.fieldTopic') }}</label>
        <input v-model="topicSlug" type="text" class="mt-1 w-full rounded-xl border app-input" placeholder="déco" />
      </div>
      <button
        type="submit"
        class="w-full rounded-xl bg-pink-700 text-white font-semibold py-3 disabled:opacity-50"
        :disabled="pending"
      >
        {{ pending ? t('staff.partnerAds.saving') : t('staff.partnerAds.publish') }}
      </button>
    </form>

    <section v-if="campaigns.length" class="space-y-3">
      <h2 class="text-sm font-semibold text-neutral-700 dark:text-neutral-200">{{ t('staff.partnerAds.listTitle') }}</h2>
      <div
        v-for="c in campaigns"
        :key="c.id"
        class="app-card rounded-xl p-4 flex items-start justify-between gap-3"
      >
        <div class="min-w-0">
          <p class="font-medium text-sm truncate">{{ c.title }}</p>
          <p class="text-xs text-neutral-500">{{ c.sponsor_name }} · {{ c.impressions }} vues · {{ c.clicks }} clics</p>
        </div>
        <button
          type="button"
          class="text-xs text-red-600 shrink-0"
          @click="deactivate(c.id)"
        >
          {{ t('staff.partnerAds.deactivate') }}
        </button>
      </div>
    </section>
  </div>
</template>
