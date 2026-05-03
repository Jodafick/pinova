<script setup lang="ts">
import { ref, computed, watch, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import GlobalHeader from '../components/GlobalHeader.vue'
import { useAuth } from '../composables/useAuth'
import { useAppModal } from '../composables/useAppModal'
import { useI18n } from '../i18n'
import {
  hasRequiredBirthDateForMediaPublish,
  isVerifiedAdultFromBirthDate,
} from '../composables/useModeration'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'

const { t } = useI18n()
const router = useRouter()
const { showAlert } = useAppModal()
const { isAuthenticated, currentUser, fetchCurrentUser } = useAuth()

const description = ref('')
const imageFile = ref<File | null>(null)
const videoFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const videoPreviewUrl = ref<string | null>(null)
const saving = ref(false)
const blurSensitive = ref(false)

const canPremium = computed(() =>
  ['plus', 'pro'].includes(currentUser.value?.subscription?.plan || ''),
)

const needsBirthBanner = computed(
  () => isAuthenticated.value && !hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate),
)

const showBlurToggle = computed(() => isVerifiedAdultFromBirthDate(currentUser.value?.birthDate))

function revoke(name: string | null) {
  if (name) URL.revokeObjectURL(name)
}

watch(imageFile, (f) => {
  revoke(imagePreviewUrl.value)
  imagePreviewUrl.value = null
  if (!f || videoFile.value) return
  imagePreviewUrl.value = URL.createObjectURL(f)
})

watch(videoFile, (f) => {
  revoke(videoPreviewUrl.value)
  videoPreviewUrl.value = null
  if (!f || imageFile.value) return
  videoPreviewUrl.value = URL.createObjectURL(f)
})

function pickImage(ev: Event) {
  videoFile.value = null
  revoke(videoPreviewUrl.value)
  videoPreviewUrl.value = null
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  imageFile.value = f && f.type.startsWith('image/') ? f : null
  input.value = ''
}

function pickVideo(ev: Event) {
  imageFile.value = null
  revoke(imagePreviewUrl.value)
  imagePreviewUrl.value = null
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  const okType = f?.type ? /^video\/(mp4|webm|quicktime)$/i.test(f.type) : false
  const okName = /\.(mp4|webm|mov)$/i.test((f?.name || '').trim())
  videoFile.value = f && (okType || okName) ? f : null
  input.value = ''
}

onMounted(async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  await fetchCurrentUser({ silent: true })
  if (!canPremium.value) {
    await showAlert(t('story.standalone.needPlus'), { variant: 'info', title: t('story.standalone.title') })
    router.push('/premium')
  }
})

onUnmounted(() => {
  revoke(imagePreviewUrl.value)
  revoke(videoPreviewUrl.value)
})

async function submit() {
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    await showAlert(t('moderation.publishRequiresBirthDate'), {
      variant: 'warning',
      title: t('moderation.publishBirthDateTitle'),
    })
    return
  }
  if (!imageFile.value && !videoFile.value) {
    await showAlert(t('story.standalone.needMedia'), { variant: 'warning' })
    return
  }

  saving.value = true
  try {
    const fd = new FormData()
    if (description.value.trim()) fd.append('description', description.value.trim())
    if (blurSensitive.value && showBlurToggle.value) fd.append('media_sensitive_blur', 'true')
    if (videoFile.value) fd.append('story_video', videoFile.value)
    else if (imageFile.value) fd.append('image', imageFile.value)

    await api.post('pins/standalone-story/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    await showAlert(t('story.standalone.success'), { variant: 'success' })
    router.push('/')
  } catch (err: unknown) {
    const lines = formatDrfErrorMessages(err)
    await showAlert(lines.length ? lines.join('\n') : t('story.standalone.error'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  } finally {
    saving.value = false
  }
}
</script>

<template>
  <div class="min-h-screen bg-neutral-50 pb-28">
    <GlobalHeader />
    <div class="mx-auto max-w-lg px-4 py-8">
      <h1 class="text-2xl font-bold text-neutral-900 mb-1">{{ t('story.standalone.title') }}</h1>
      <p class="text-sm text-neutral-600 mb-6">{{ t('story.standalone.subtitle') }}</p>

      <div
        v-if="needsBirthBanner"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        {{ t('create.banner.birthDate') }}
        <router-link to="/settings" class="font-semibold text-amber-800 underline underline-offset-2 ml-1">
          {{ t('create.banner.birthDateCta') }}
        </router-link>
      </div>

      <div class="space-y-4 rounded-2xl border border-neutral-200 bg-white p-5 shadow-sm">
        <div>
          <p class="text-xs font-semibold text-neutral-500 uppercase tracking-wide mb-2">{{ t('story.standalone.media') }}</p>
          <div class="flex flex-wrap gap-2">
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 transition"
            >
              <span class="material-symbols-outlined text-lg">photo_library</span>
              {{ t('story.standalone.pickImage') }}
              <input type="file" accept="image/*" class="hidden" @change="pickImage">
            </label>
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 bg-neutral-50 px-4 py-2 text-sm font-medium text-neutral-800 hover:bg-neutral-100 transition"
            >
              <span class="material-symbols-outlined text-lg">movie</span>
              {{ t('story.standalone.pickVideo') }}
              <input type="file" accept="video/mp4,video/webm,video/quicktime,.mp4,.webm,.mov" class="hidden" @change="pickVideo">
            </label>
          </div>
          <p class="text-xs text-neutral-500 mt-2">{{ t('story.standalone.mediaHint') }}</p>
        </div>

        <div v-if="imagePreviewUrl" class="rounded-xl overflow-hidden border border-neutral-200 bg-black">
          <img :src="imagePreviewUrl" alt="" class="max-h-[360px] w-full object-contain">
        </div>
        <div v-else-if="videoPreviewUrl" class="rounded-xl overflow-hidden border border-neutral-200 bg-black">
          <video :src="videoPreviewUrl" class="max-h-[360px] w-full" controls muted playsinline />
        </div>

        <div>
          <label class="text-xs font-semibold text-neutral-500 uppercase tracking-wide">{{ t('story.standalone.caption') }}</label>
          <textarea
            v-model="description"
            rows="4"
            maxlength="1000"
            class="mt-2 w-full rounded-xl border border-neutral-200 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-pink-500 outline-none"
            :placeholder="t('story.standalone.captionPlaceholder')"
          />
        </div>

        <label
          v-if="showBlurToggle"
          class="flex items-start gap-3 cursor-pointer rounded-xl border border-neutral-100 bg-neutral-50 px-3 py-2.5"
        >
          <input v-model="blurSensitive" type="checkbox" class="mt-1 rounded border-neutral-300 text-pink-600 focus:ring-pink-500">
          <span class="text-sm text-neutral-700 leading-snug">{{ t('story.standalone.sensitiveBlur') }}</span>
        </label>

        <button
          type="button"
          class="w-full rounded-full bg-gradient-to-r from-pink-600 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition"
          :disabled="saving || needsBirthBanner"
          @click="submit()"
        >
          {{ saving ? '…' : t('story.standalone.publish') }}
        </button>
      </div>
    </div>
  </div>
</template>
