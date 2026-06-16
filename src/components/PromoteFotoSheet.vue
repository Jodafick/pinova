<script setup lang="ts">
import { ref, watch } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api/index'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { defaultBoostPackSlug, usePromoteHub } from '../composables/usePromoteHub'
import BoostWizardPanel from './BoostWizardPanel.vue'
import CampaignComposer from './CampaignComposer.vue'
import { appendCampaignToFormData, emptyTargeting, type CampaignTargeting } from '../composables/useCampaignTargeting'
import { openCheckoutFlow } from '../utils/checkoutFlow'

const props = withDefaults(
  defineProps<{ open: boolean; fotoSlug?: string; initialMode?: 'boost' | 'campaign' }>(),
  { initialMode: 'boost' },
)
const emit = defineEmits<{ (e: 'close'): void }>()

const { t } = useI18n()
const router = useRouter()
const { showAlert } = useAppModal()
const {
  boostPacks,
  campaignPacks,
  myFotos,
  selectedSlug,
  selectedPin,
  history,
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
const mediaFile = ref<File | null>(null)
const mediaType = ref<'image' | 'video'>('image')
const mediaPreviewUrl = ref('')
const mediaFileName = ref('')
const targeting = ref<CampaignTargeting>(emptyTargeting())
const packageSlug = ref('')
const busy = ref(false)

function resetCampaignForm() {
  headline.value = ''
  body.value = ''
  ctaUrl.value = ''
  ctaLabel.value = ''
  mediaFile.value = null
  mediaType.value = 'image'
  mediaPreviewUrl.value = ''
  mediaFileName.value = ''
  targeting.value = emptyTargeting()
}

function onCampaignMedia(payload: { file: File | null; previewUrl: string; mediaType: 'image' | 'video'; fileName: string }) {
  mediaFile.value = payload.file
  mediaPreviewUrl.value = payload.previewUrl
  mediaType.value = payload.mediaType
  mediaFileName.value = payload.fileName
}

watch(
  () => props.open,
  async (v) => {
    if (!v) return
    mode.value = props.initialMode
    resetCampaignForm()
    await loadCatalog()
    if (props.initialMode === 'boost' || props.fotoSlug) {
      await loadMyPins(props.fotoSlug)
      if (props.fotoSlug) selectedSlug.value = props.fotoSlug
    }
    const catalog = props.initialMode === 'campaign' ? campaignPacks.value : boostPacks.value
    if (catalog[0]) {
      packageSlug.value = defaultBoostPackSlug(catalog)
    }
  },
)

async function startBoost(packSlug: string) {
  const foto = selectedSlug.value
  if (!pin) {
    await showAlert(t('promote.boost.pickPinFirst'), { variant: 'warning' })
    return
  }
  busy.value = true
  try {
    const res = await api.post(`monetization/fotos/${encodeURIComponent(foto)}/boost/`, { package: packSlug })
    const data = res.data as { checkout_url?: string; status?: string }
    if (data.checkout_url) {
      openCheckoutFlow(router, 'boost', data.checkout_url)
      return
    }
    if (data.status === 'active') {
      await showAlert(t('foto.boost.success'), { variant: 'success' })
      emit('close')
      return
    }
    await showAlert(t('foto.boost.error'), { variant: 'danger' })
  } catch {
    await showAlert(t('foto.boost.error'), { variant: 'danger' })
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
    appendCampaignToFormData(fd, {
      headline: headline.value.trim(),
      body: body.value.trim(),
      ctaUrl: ctaUrl.value.trim(),
      ctaLabel: ctaLabel.value.trim() || t('feed.partnerAd.ctaDefault'),
      packageSlug: packageSlug.value,
      targeting: targeting.value,
      mediaFile: mediaFile.value,
      mediaType: mediaType.value,
    })
    const res = await api.post('monetization/foto-promo-campaigns/', fd)
    const data = res.data as { checkout_url?: string; status?: string; sandbox?: boolean }
    if (data.checkout_url) {
      openCheckoutFlow(router, 'campaign', data.checkout_url)
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
              <FotoceIcon name="close" class="text-xl" />
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

        <div class="flex-1 overflow-y-auto px-5 py-4">
          <BoostWizardPanel
            v-if="mode === 'boost'"
            :packs="boostPacks"
            :my-pins="myFotos"
            :selected-slug="selectedSlug"
            :selected-pin="selectedPin"
            :pins-loading="pinsLoading"
            :pins-loading-more="pinsLoadingMore"
            :pins-has-more="pinsHasMore"
            :history="history"
            :busy="busy"
            :format-duration="formatDuration"
            :format-money="formatMoney"
            @update:selected-slug="selectedSlug = $event"
            @load-more-pins="loadMyPins(undefined, false)"
            @confirm-boost="startBoost"
            @boost-again="selectedSlug = $event"
          />
          <CampaignComposer
            v-else
            :packs="campaignPacks"
            :headline="headline"
            :body="body"
            :cta-url="ctaUrl"
            :cta-label="ctaLabel"
            :package-slug="packageSlug"
            :targeting="targeting"
            :media-preview-url="mediaPreviewUrl"
            :media-type="mediaType"
            :media-file-name="mediaFileName"
            :busy="busy"
            :format-money="formatMoney"
            @update:headline="headline = $event"
            @update:body="body = $event"
            @update:cta-url="ctaUrl = $event"
            @update:cta-label="ctaLabel = $event"
            @update:package-slug="packageSlug = $event"
            @update:targeting="targeting = $event"
            @media="onCampaignMedia"
            @submit="startCampaign"
          />
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
