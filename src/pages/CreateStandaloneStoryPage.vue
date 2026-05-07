<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useAppModal } from '../composables/useAppModal'
import { useI18n } from '../i18n'
import {
  hasRequiredBirthDateForMediaPublish,
  isVerifiedAdultFromBirthDate,
  moderationScanImageFile,
  moderationScanText,
} from '../composables/useModeration'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'

const { t } = useI18n()
const router = useRouter()
const { showAlert } = useAppModal()
const { isAuthenticated, currentUser, fetchCurrentUser } = useAuth()

const description = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const saving = ref(false)
const mediaModerationPending = ref(false)
const pendingSensitiveBlur = ref(false)
let mediaScanGeneration = 0

const moderationBirthOpts = computed(() => ({
  birthDate: currentUser.value?.birthDate,
  isAuthenticated: isAuthenticated.value,
}))

const canPremium = computed(() =>
  ['plus', 'pro'].includes(currentUser.value?.subscription?.plan || ''),
)

const needsBirthBanner = computed(
  () => isAuthenticated.value && !hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate),
)

function revoke(name: string | null) {
  if (name) URL.revokeObjectURL(name)
}

function clearImageSelection() {
  mediaScanGeneration++
  mediaModerationPending.value = false
  revoke(imagePreviewUrl.value)
  imagePreviewUrl.value = null
  imageFile.value = null
  pendingSensitiveBlur.value = false
}

async function runImageModeration(file: File) {
  if (!file.type.startsWith('image/')) return
  const gen = ++mediaScanGeneration
  mediaModerationPending.value = true
  try {
    const r = await moderationScanImageFile(file, moderationBirthOpts.value)
    if (gen !== mediaScanGeneration) return
    if (r.level === 'block') {
      pendingSensitiveBlur.value = false
      clearImageSelection()
      await showAlert(t('moderation.imageSensitiveBlocked'), {
        variant: 'danger',
        title: t('modal.errorTitle'),
      })
      return
    }
    if (r.level === 'blur') {
      pendingSensitiveBlur.value = true
      await showAlert(t('moderation.blurTierPublish'), { variant: 'info' })
      return
    }
    pendingSensitiveBlur.value = false
  } catch (err) {
    console.warn('Scan NSFW image story', err)
  } finally {
    if (gen === mediaScanGeneration) mediaModerationPending.value = false
  }
}

async function pickImage(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  input.value = ''
  if (!f || !f.type.startsWith('image/')) return
  await fetchCurrentUser({ silent: true })
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    await showAlert(t('moderation.publishRequiresBirthDate'), {
      variant: 'warning',
      title: t('moderation.publishBirthDateTitle'),
    })
    return
  }
  revoke(imagePreviewUrl.value)
  imagePreviewUrl.value = null
  imageFile.value = f
  imagePreviewUrl.value = URL.createObjectURL(f)
  void runImageModeration(f)
}

onMounted(async () => {
  if (!isAuthenticated.value) {
    router.push('/login')
    return
  }
  if (!currentUser.value) {
    await fetchCurrentUser({ silent: true })
  }
  if (!canPremium.value) {
    await showAlert(t('story.standalone.needPlus'), { variant: 'info', title: t('story.standalone.title') })
    router.push('/premium')
  }
})

onUnmounted(() => {
  revoke(imagePreviewUrl.value)
})

async function submit() {
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    await showAlert(t('moderation.publishRequiresBirthDate'), {
      variant: 'warning',
      title: t('moderation.publishBirthDateTitle'),
    })
    return
  }
  if (!imageFile.value) {
    await showAlert(t('story.standalone.needImage'), { variant: 'warning' })
    return
  }
  if (mediaModerationPending.value) return
  const descOk = moderationScanText([description.value])
  if (!descOk.ok) {
    await showAlert(t('moderation.textInappropriate'), { variant: 'warning' })
    return
  }

  await fetchCurrentUser({ silent: true })
  const blurPublish = pendingSensitiveBlur.value && isVerifiedAdultFromBirthDate(currentUser.value?.birthDate)

  saving.value = true
  try {
    const fd = new FormData()
    if (description.value.trim()) fd.append('description', description.value.trim())
    if (blurPublish) fd.append('media_sensitive_blur', 'true')
    fd.append('image', imageFile.value)

    const res = await api.post('pins/standalone-story/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const slug = typeof res.data?.slug === 'string' ? res.data.slug.trim() : ''
    if (!slug) {
      router.push('/')
      return
    }
    router.push({ path: '/', query: { story: slug } })
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
  <div class="min-h-screen bg-gradient-to-b from-pink-50 via-neutral-50 to-neutral-100 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900 pb-28">
    <div class="mx-auto max-w-lg px-4 py-8">
      <h1 class="text-2xl font-black text-neutral-900 dark:text-neutral-100 mb-1">{{ t('story.standalone.title') }}</h1>
      <p class="text-sm text-neutral-600 dark:text-neutral-300 mb-6">{{ t('story.standalone.subtitle') }}</p>

      <div
        v-if="needsBirthBanner"
        class="mb-6 rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900"
      >
        {{ t('create.banner.birthDate') }}
        <router-link to="/settings" class="font-semibold text-amber-800 underline underline-offset-2 ml-1">
          {{ t('create.banner.birthDateCta') }}
        </router-link>
      </div>

      <div class="space-y-4 rounded-3xl border border-pink-100 dark:border-neutral-700 bg-white/95 dark:bg-neutral-900/95 p-5 shadow-lg shadow-pink-100/60 dark:shadow-black/20">
        <div>
          <p class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide mb-2">{{ t('story.standalone.media') }}</p>
          <div class="flex flex-wrap gap-2">
            <label
              class="inline-flex cursor-pointer items-center gap-2 rounded-full border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-4 py-2 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition disabled:opacity-40"
              :class="{ 'pointer-events-none': mediaModerationPending }"
            >
              <span class="material-symbols-outlined text-lg">photo_library</span>
              {{ t('story.standalone.pickImage') }}
              <input type="file" accept="image/*" class="hidden" :disabled="mediaModerationPending" @change="(e) => void pickImage(e)">
            </label>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-2">{{ t('story.standalone.mediaHint') }}</p>
        </div>

        <div v-if="mediaModerationPending" class="flex items-center gap-2 text-xs text-neutral-500 dark:text-neutral-400">
          <span class="w-4 h-4 border-2 border-pink-500 border-t-transparent rounded-full animate-spin shrink-0" />
          {{ t('common.loading') }}
        </div>

        <div v-if="imagePreviewUrl" class="rounded-xl overflow-hidden border border-neutral-200 bg-black">
          <img :src="imagePreviewUrl" alt="" class="max-h-[360px] w-full object-contain">
        </div>

        <div>
          <label class="text-xs font-semibold text-neutral-500 dark:text-neutral-400 uppercase tracking-wide">{{ t('story.standalone.caption') }}</label>
          <textarea
            v-model="description"
            rows="4"
            maxlength="1000"
            class="mt-2 w-full rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-2 text-sm resize-none focus:ring-2 focus:ring-pink-500 outline-none"
            :placeholder="t('story.standalone.captionPlaceholder')"
          />
        </div>

        <button
          type="button"
          class="w-full rounded-full bg-gradient-to-r from-pink-600 to-pink-500 px-6 py-3 text-sm font-semibold text-white shadow hover:brightness-105 disabled:opacity-50 disabled:pointer-events-none transition"
          :disabled="saving || needsBirthBanner || mediaModerationPending"
          @click="submit()"
        >
          {{ saving ? '…' : t('story.standalone.publish') }}
        </button>
      </div>
    </div>
  </div>
</template>
