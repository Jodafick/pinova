<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useI18n } from '../i18n'
import { useAuth } from '../composables/useAuth'
import { useAppModal } from '../composables/useAppModal'
import { usePromoteHub } from '../composables/usePromoteHub'
import PinPickerField from './PinPickerField.vue'
import OfflineImg from './OfflineImg.vue'
import SponsoredContentCard from './SponsoredContentCard.vue'
import type { PinPromo } from '../types'

const props = withDefaults(
  defineProps<{ open: boolean; pinSlug?: string; initialMode?: 'boost' | 'campaign' }>(),
  { initialMode: 'boost' },
)
const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const { currentUser } = useAuth()
const { showAlert } = useAppModal()
const {
  packs,
  myPins,
  selectedSlug,
  selectedPin,
  pinsLoading,
  pinsLoadingMore,
  pinsHasMore,
  loadCatalog,
  loadMyPins,
  formatDuration,
  formatMoney,
} = usePromoteHub()

const mode = ref<'boost' | 'campaign'>('boost')
const headline = ref('')
const body = ref('')
const ctaUrl = ref('')
const ctaLabel = ref('')
const topicSlug = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref('')
const packageSlug = ref('')
const busy = ref(false)

const benefits = computed(() => [
  t('promote.boost.benefit1'),
  t('promote.boost.benefit2'),
])

const campaignPreview = computed((): PinPromo | null => {
  if (!headline.value.trim()) return null
  return {
    feedType: 'pin_promo',
    id: 'preview',
    campaignId: 0,
    title: headline.value.trim(),
    body: body.value.trim(),
    sponsorName: currentUser.value?.username ? `@${currentUser.value.username}` : '',
    username: currentUser.value?.username ?? '',
    imageUrl: imagePreviewUrl.value,
    ctaLabel: ctaLabel.value.trim() || t('feed.partnerAd.ctaDefault'),
    ctaUrl: ctaUrl.value.trim(),
  }
})

function resetCampaignForm() {
  headline.value = ''
  body.value = ''
  ctaUrl.value = ''
  ctaLabel.value = ''
  topicSlug.value = ''
  imageFile.value = null
  imagePreviewUrl.value = ''
}

function onImageChange(ev: Event) {
  const input = ev.target as HTMLInputElement
  const file = input.files?.[0] ?? null
  imageFile.value = file
  imagePreviewUrl.value = file ? URL.createObjectURL(file) : ''
}

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    mode.value = props.initialMode
    resetCampaignForm()
    await loadCatalog()
    if (props.initialMode === 'boost' || props.pinSlug) {
      await loadMyPins(props.pinSlug)
      if (props.pinSlug) selectedSlug.value = props.pinSlug
    }
    if (packs.value[0]) {
      packageSlug.value = packs.value[Math.min(1, packs.value.length - 1)]?.slug ?? packs.value[0].slug
    }
  },
)

async function startBoost(slug: string) {
  const pin = selectedSlug.value
  if (!pin) {
    await showAlert(t('promote.boost.pickPinFirst'), { variant: 'warning' })
    return
  }
  busy.value = true
  try {
    const res = await api.post(`monetization/pins/${encodeURIComponent(pin)}/boost/`, { package: slug })
    const data = res.data as { checkout_url?: string; status?: string }
    if (data.checkout_url) {
      window.location.href = data.checkout_url
      return
    }
    if (data.status === 'active') {
      await showAlert(t('pin.boost.success'), { variant: 'success' })
      emit('close')
      return
    }
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('pin.boost.error'), { variant: 'danger' })
  } finally {
    busy.value = false
  }
}

async function startCampaign() {
  if (!headline.value.trim() || !ctaUrl.value.trim() || !packageSlug.value) {
    await showAlert(t('promote.campaigns.validation'), { variant: 'warning' })
    return
  }
  busy.value = true
  try {
    const fd = new FormData()
    fd.append('headline', headline.value.trim())
    fd.append('body', body.value.trim())
    fd.append('cta_url', ctaUrl.value.trim())
    fd.append('cta_label', ctaLabel.value.trim() || t('feed.partnerAd.ctaDefault'))
    fd.append('topic_slug', topicSlug.value.trim())
    fd.append('package', packageSlug.value)
    if (imageFile.value) fd.append('image', imageFile.value)
    const res = await api.post('monetization/pin-promo-campaigns/', fd)
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      window.location.href = data.checkout_url
      return
    }
    if (data.status === 'active' || data.sandbox) {
      await showAlert(t('promote.campaigns.created'), { variant: 'success' })
      emit('close')
      return
    }
    await showAlert(t('promote.campaigns.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('promote.campaigns.error'), { variant: 'danger' })
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <Teleport to="body">
    <div
      v-if="open"
      class="fixed inset-0 z-[220] flex items-end sm:items-center justify-center p-0 sm:p-4 bg-black/55 backdrop-blur-[2px]"
      @click.self="emit('close')"
    >
      <div
        class="w-full sm:max-w-lg max-h-[92vh] overflow-hidden rounded-t-3xl sm:rounded-3xl bg-white dark:bg-neutral-950 shadow-2xl flex flex-col"
        role="dialog"
        aria-modal="true"
      >
        <div class="shrink-0 px-5 pt-5 pb-3 border-b border-neutral-100 dark:border-neutral-800 bg-gradient-to-br from-pink-50 via-white to-amber-50/40 dark:from-pink-950/50 dark:via-neutral-950 dark:to-amber-950/20">
          <div class="flex items-start justify-between gap-3">
            <div>
              <p class="text-[10px] font-bold uppercase tracking-widest text-pink-600 dark:text-pink-400">
                {{ t('promote.sheet.kicker') }}
              </p>
              <h2 class="text-lg font-bold text-neutral-900 dark:text-neutral-50">
                {{ mode === 'boost' ? t('promote.sheet.titleBoost') : t('promote.sheet.titleCampaign') }}
              </h2>
            </div>
            <button
              type="button"
              class="h-9 w-9 rounded-full bg-black/5 dark:bg-white/10 flex items-center justify-center"
              :aria-label="t('common.close')"
              @click="emit('close')"
            >
              <span class="material-symbols-outlined text-xl">close</span>
            </button>
          </div>

          <div class="mt-4 flex gap-1 p-1 rounded-xl bg-neutral-100/80 dark:bg-neutral-900/80">
            <button
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-semibold transition"
              :class="mode === 'boost' ? 'bg-white dark:bg-neutral-800 shadow text-pink-700' : 'text-neutral-500'"
              @click="mode = 'boost'"
            >
              {{ t('promote.sheet.tabBoost') }}
            </button>
            <button
              type="button"
              class="flex-1 rounded-lg py-2 text-xs font-semibold transition"
              :class="mode === 'campaign' ? 'bg-white dark:bg-neutral-800 shadow text-pink-700' : 'text-neutral-500'"
              @click="mode = 'campaign'"
            >
              {{ t('promote.sheet.tabCampaign') }}
            </button>
          </div>
        </div>

        <div class="flex-1 overflow-y-auto px-5 py-4 space-y-4">
          <template v-if="mode === 'boost'">
            <div>
              <p class="text-xs font-semibold text-neutral-500 mb-2">{{ t('promote.sheet.pickPin') }}</p>
              <PinPickerField
                :pins="myPins"
                :selected-slug="selectedSlug"
                :loading="pinsLoading"
                :loading-more="pinsLoadingMore"
                :has-more="pinsHasMore"
                @select="selectedSlug = $event"
                @load-more="loadMyPins(undefined, false)"
              />
            </div>

            <div v-if="selectedPin" class="flex items-center gap-3 rounded-2xl border app-divider-subtle p-3 bg-neutral-50/80 dark:bg-neutral-900/50">
              <div class="h-14 w-11 rounded-lg overflow-hidden bg-neutral-200 shrink-0">
                <OfflineImg
                  v-if="selectedPin.imageUrl"
                  :src="selectedPin.imageUrl"
                  :alt="selectedPin.title"
                  class="w-full h-full object-cover"
                />
              </div>
              <div class="min-w-0">
                <p class="text-sm font-semibold truncate">{{ selectedPin.title }}</p>
                <p class="text-xs text-neutral-500">@{{ selectedPin.username }}</p>
                <span
                  v-if="selectedPin.isBoosted"
                  class="inline-flex mt-1 items-center gap-0.5 rounded-full bg-amber-100 text-amber-800 text-[10px] font-bold px-2 py-0.5"
                >
                  <span class="material-symbols-outlined text-[12px]">rocket_launch</span>
                  {{ t('feed.pinBoosted') }}
                </span>
              </div>
            </div>

            <ul class="space-y-2">
              <li v-for="(b, i) in benefits" :key="i" class="flex gap-2 text-xs text-neutral-600 dark:text-neutral-400">
                <span class="material-symbols-outlined text-pink-600 text-base shrink-0">check_circle</span>
                {{ b }}
              </li>
            </ul>
            <div class="space-y-2">
              <button
                v-for="(p, idx) in packs"
                :key="p.slug"
                type="button"
                class="w-full flex items-center justify-between rounded-2xl border px-4 py-3.5 text-left transition disabled:opacity-50"
                :class="idx === 1 ? 'border-pink-500 bg-pink-50/60 dark:bg-pink-950/30' : 'border-neutral-200 dark:border-neutral-700 hover:border-pink-300'"
                :disabled="busy || !selectedSlug"
                @click="startBoost(p.slug)"
              >
                <div>
                  <p class="font-semibold text-sm">{{ p.label }}</p>
                  <p class="text-xs text-neutral-500">{{ formatDuration(p.duration_hours, t) }}</p>
                </div>
                <div class="text-right">
                  <p class="font-bold text-pink-700 dark:text-pink-300">{{ formatMoney(p.amount, p.currency_iso) }}</p>
                  <p v-if="idx === 1" class="text-[9px] uppercase text-pink-600 font-bold">{{ t('promote.sheet.popular') }}</p>
                </div>
              </button>
            </div>
          </template>

          <template v-else>
            <p class="text-xs text-neutral-500">{{ t('promote.sheet.campaignHint') }}</p>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.headlineRequired') }}
              <input v-model="headline" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" />
            </label>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.body') }}
              <textarea v-model="body" rows="2" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" />
            </label>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.ctaUrl') }}
              <input v-model="ctaUrl" type="url" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" placeholder="https://" />
            </label>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.ctaLabel') }}
              <input v-model="ctaLabel" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" :placeholder="t('feed.partnerAd.ctaDefault')" />
            </label>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.image') }}
              <input type="file" accept="image/*" class="w-full text-sm" @change="onImageChange" />
            </label>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.topic') }}
              <input v-model="topicSlug" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm" />
            </label>
            <label class="block text-xs font-medium space-y-1">
              {{ t('promote.campaigns.package') }}
              <select v-model="packageSlug" class="w-full rounded-xl border app-divider-subtle px-3 py-2.5 text-sm">
                <option v-for="p in packs" :key="p.slug" :value="p.slug">
                  {{ p.label }} — {{ formatMoney(p.amount, p.currency_iso) }}
                </option>
              </select>
            </label>
            <div v-if="campaignPreview" class="space-y-2">
              <p class="text-xs font-semibold text-neutral-500">{{ t('promote.campaigns.preview') }}</p>
              <SponsoredContentCard :item="campaignPreview" variant="feed" />
            </div>
            <button
              type="button"
              class="w-full rounded-2xl bg-pink-700 hover:bg-pink-800 text-white font-semibold py-3.5 disabled:opacity-50"
              :disabled="busy"
              @click="startCampaign"
            >
              {{ busy ? t('common.loading') : t('promote.campaigns.publish') }}
            </button>
          </template>
        </div>

        <div class="shrink-0 px-5 py-3 border-t border-neutral-100 dark:border-neutral-800 flex justify-between items-center">
          <button type="button" class="text-xs font-semibold text-pink-700 dark:text-pink-300" @click="router.push({ name: 'boost-promote' }); emit('close')">
            {{ t('promote.sheet.openHub') }}
          </button>
          <button type="button" class="text-xs text-neutral-500" @click="emit('close')">{{ t('modal.cancel') }}</button>
        </div>
      </div>
    </div>
  </Teleport>
</template>
