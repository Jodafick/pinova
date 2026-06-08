<script setup lang="ts">
import { computed, onMounted, ref } from 'vue'
import { useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { pushToast } from '../composables/useToast'
import BirthDateRequiredModal from './BirthDateRequiredModal.vue'
import StoryImageCropEditor from './StoryImageCropEditor.vue'
import { appendQuickPinFormData, resolveQuickPinTitle } from '../composables/pinCreateShared'
import { navigateToPublishedPin } from '../utils/postPublishNavigation'
import { useTopicSuggestions } from '../composables/useTopicSuggestions'
import {
  moderationScanImageFile,
  moderationScanText,
  isVerifiedAdultFromBirthDate,
  hasRequiredBirthDateForMediaPublish,
} from '../composables/useModeration'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'
import { useIsLgDown } from '../composables/useIsLgDown'
import { useLayer } from '../navigation/useLayer'

const emit = defineEmits<{ cancel: [] }>()

const { t, currentLang } = useI18n()
const router = useRouter()
const { showAlert } = useAppModal()
const { addPin } = usePins()
const { currentUser, isAuthenticated, fetchCurrentUser } = useAuth()
const { isLgDown } = useIsLgDown()
const { layer, close: closeLayer, popAll } = useLayer()
const { selectedTopic, chipOptions, selectTopic, isSelected } = useTopicSuggestions()

type QuickStep = 'pick' | 'edit' | 'publish'

const step = ref<QuickStep>('pick')
const title = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const pendingImage = ref<File | null>(null)
const saving = ref(false)
const mediaModerationPending = ref(false)
const pendingSensitiveBlur = ref(false)
const showBirthDateModal = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
const nativeCameraInput = ref<HTMLInputElement | null>(null)
const isDragging = ref(false)
let mediaScanGeneration = 0

const needsBirthDateForMedia = computed(
  () => isAuthenticated.value && !hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate),
)

const hasMedia = computed(() => !!(imagePreviewUrl.value && imageFile.value))

const hasTitle = computed(() => title.value.trim().length > 0)

const canPublish = computed(
  () =>
    hasMedia.value &&
    hasTitle.value &&
    !saving.value &&
    !mediaModerationPending.value &&
    !needsBirthDateForMedia.value,
)

const moderationBirthOpts = computed(() => ({
  birthDate: currentUser.value?.birthDate,
  isAuthenticated: isAuthenticated.value,
}))

function openCameraCapture() {
  nativeCameraInput.value?.click()
}

function clearImage() {
  mediaScanGeneration++
  mediaModerationPending.value = false
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = null
  imagePreviewUrl.value = null
  pendingSensitiveBlur.value = false
  step.value = 'pick'
}

function usesCropEditor(file: File) {
  return isLgDown.value && file.type.startsWith('image/') && file.type !== 'image/gif'
}

async function runImageModeration(file: File) {
  if (isLgDown.value) {
    pendingSensitiveBlur.value = false
    return
  }
  const gen = ++mediaScanGeneration
  mediaModerationPending.value = true
  try {
    const r = await moderationScanImageFile(file, moderationBirthOpts.value)
    if (gen !== mediaScanGeneration) return
    if (r.level === 'block') {
      pendingSensitiveBlur.value = false
      clearImage()
      await showAlert(t('moderation.imageSensitiveBlocked'), { variant: 'danger', title: t('modal.errorTitle') })
      return
    }
    if (r.level === 'blur') {
      pendingSensitiveBlur.value = true
      await showAlert(t('moderation.blurTierPublish'), { variant: 'info' })
      return
    }
    pendingSensitiveBlur.value = false
  } catch (err) {
    console.warn('Scan NSFW indisponible', err)
  } finally {
    if (gen === mediaScanGeneration) mediaModerationPending.value = false
  }
}

async function ensureBirthDateBeforeMedia(): Promise<boolean> {
  await fetchCurrentUser({ silent: true })
  if (hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) return true
  showBirthDateModal.value = true
  return false
}

async function commitImage(file: File) {
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
  void runImageModeration(file)
  step.value = 'publish'
}

async function setMediaFile(file: File) {
  if (!(await ensureBirthDateBeforeMedia())) return
  if (file.type.startsWith('video/')) {
    void showAlert(t('create.pinMobile.videoNotAllowed'), { variant: 'warning' })
    return
  }
  if (!file.type.startsWith('image/')) {
    void showAlert(t('create.upload.invalid'), { variant: 'warning' })
    return
  }
  if (file.size > 10 * 1024 * 1024) {
    void showAlert(t('create.upload.tooLarge'), { variant: 'warning' })
    return
  }
  if (usesCropEditor(file)) {
    pendingImage.value = file
    step.value = 'edit'
    return
  }
  await commitImage(file)
}

function onFileChange(e: Event) {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void setMediaFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

function onDrop(e: DragEvent) {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void setMediaFile(file)
}

async function onCropped(file: File) {
  pendingImage.value = null
  await commitImage(file)
}

function onCropCancel() {
  pendingImage.value = null
  step.value = 'pick'
}

const canPublishHint = computed(() => {
  if (needsBirthDateForMedia.value) return t('create.banner.birthDate')
  if (mediaModerationPending.value) return t('moderation.scanningMediaShort')
  if (!hasMedia.value) return t('create.quick.mediaHint')
  return ''
})

async function publish() {
  if (!canPublish.value || !currentUser.value) return
  const resolvedTitle = resolveQuickPinTitle(title.value, t, currentLang.value)
  const textOk = await moderationScanText([resolvedTitle])
  if (!textOk.ok) {
    await showAlert(t('moderation.textInappropriate'), { variant: 'warning' })
    return
  }
  await fetchCurrentUser({ silent: true })
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    showBirthDateModal.value = true
    return
  }
  saving.value = true
  try {
    const formData = new FormData()
    appendQuickPinFormData(formData, {
      title: resolvedTitle,
      authorId: currentUser.value.id,
      imageFile: imageFile.value,
      topic: selectedTopic.value,
      mediaSensitiveBlur:
        pendingSensitiveBlur.value && isVerifiedAdultFromBirthDate(currentUser.value.birthDate),
    })
    const result = await addPin(formData)
    pushToast({ message: t('create.quick.published'), kind: 'success' })
    const slug = result?.slug
    if (slug) {
      if (layer.value) popAll()
      await navigateToPublishedPin(router, {
        slug,
        username: currentUser.value.username,
        pin: result ?? null,
      })
    } else if (layer.value) closeLayer()
    else emit('cancel')
  } catch (err: unknown) {
    const ax = err as { response?: { data?: unknown } }
    const msgs = formatDrfErrorMessages(ax.response?.data)
    await showAlert(msgs.slice(0, 6).join('\n') || t('create.publish.error'), {
      variant: 'danger',
      title: t('modal.errorTitle'),
    })
  } finally {
    saving.value = false
  }
}

onMounted(() => {
  if (isAuthenticated.value && !currentUser.value) {
    void fetchCurrentUser({ silent: true })
  }
  if (needsBirthDateForMedia.value) showBirthDateModal.value = true
})
</script>

<template>
  <div class="quick-create-root flex min-h-0 w-full flex-1 flex-col overflow-hidden bg-[#060408] text-white">
    <input ref="fileInput" type="file" class="hidden" accept="image/*,.gif,.webp,.png,.jpg,.jpeg,.avif,.heic,.heif" @change="onFileChange">
    <input ref="nativeCameraInput" type="file" class="hidden" accept="image/*" capture="environment" @change="onFileChange">

    <!-- Étape rognage (mobile) -->
    <div v-if="step === 'edit' && pendingImage" class="relative z-[80] flex min-h-0 flex-1 flex-col">
      <StoryImageCropEditor export-profile="pin" :file="pendingImage" @cancel="onCropCancel" @apply="onCropped" />
    </div>

    <!-- Étape choix média -->
    <div
      v-else-if="step === 'pick'"
      class="relative flex min-h-0 flex-1 flex-col px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)] lg:mx-auto lg:max-w-lg"
    >
      <header class="relative z-10 flex items-center justify-between">
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition active:scale-95"
          :aria-label="t('common.cancel')"
          @click="emit('cancel')"
        >
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
        <p class="text-sm font-black tracking-tight">{{ t('create.mobile.quickTitle') }}</p>
        <span class="h-9 w-9" />
      </header>

      <p class="relative z-10 mx-auto mt-6 max-w-sm text-center text-xs font-medium text-pink-300/90">
        {{ t('create.quick.subtitle') }}
      </p>

      <section class="relative z-10 mx-auto mt-8 max-w-sm">
        <h1 class="text-[2rem] font-black leading-tight tracking-tight lg:text-3xl">
          {{ t('create.quick.mediaHeadline') }}
        </h1>
        <p class="mt-2 text-sm text-white/45">{{ t('create.quick.mediaHint') }}</p>
      </section>

      <section class="relative z-10 mx-auto mt-8 grid max-w-sm gap-3 lg:max-w-md">
        <button
          type="button"
          class="relative flex min-h-[10rem] flex-col justify-end overflow-hidden rounded-[1.75rem] bg-gradient-to-br from-pink-700 to-fuchsia-700 px-7 pb-7 pt-14 text-left shadow-lg transition active:scale-[0.98]"
          @click="fileInput?.click()"
        >
          <span class="absolute right-5 top-5 grid h-14 w-14 place-items-center rounded-full bg-white/15">
            <span class="material-symbols-outlined text-3xl">imagesmode</span>
          </span>
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-white/60">{{ t('create.pinMobile.galleryLabel') }}</span>
          <span class="text-xl font-black">{{ t('create.pinMobile.chooseFile') }}</span>
        </button>
        <button
          type="button"
          class="relative flex min-h-[8rem] flex-col justify-end overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-7 pb-7 pt-12 transition active:scale-[0.98] lg:hidden"
          @click="openCameraCapture()"
        >
          <span class="absolute right-5 top-5 grid h-14 w-14 place-items-center rounded-full bg-white/5 text-pink-500">
            <span class="material-symbols-outlined text-3xl">photo_camera</span>
          </span>
          <span class="text-[10px] font-extrabold uppercase tracking-wider text-white/35">{{ t('create.pinMobile.cameraLabel') }}</span>
          <span class="text-lg font-black">{{ t('create.pinMobile.capturePin') }}</span>
        </button>
        <div
          class="hidden min-h-[8rem] cursor-pointer flex-col items-center justify-center gap-2 rounded-[1.75rem] border-2 border-dashed border-white/20 px-6 py-8 text-center transition hover:border-pink-500/50 lg:flex"
          :class="isDragging ? 'border-pink-500 bg-pink-500/10' : ''"
          @dragover.prevent="isDragging = true"
          @dragleave.prevent="isDragging = false"
          @drop="onDrop"
          @click="fileInput?.click()"
        >
          <span class="material-symbols-outlined text-4xl text-white/40">cloud_upload</span>
          <p class="text-sm font-semibold text-white/70">{{ t('create.upload.title') }}</p>
        </div>
      </section>

      <div v-if="needsBirthDateForMedia" class="relative z-10 mx-auto mt-5 max-w-sm rounded-2xl border border-amber-200/30 bg-amber-300/10 px-4 py-3 text-xs text-amber-100">
        {{ t('create.banner.birthDate') }}
      </div>
    </div>

    <!-- Étape publication : média + titre + publier -->
    <div v-else class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <header class="flex shrink-0 items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]">
        <button
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/45 text-white transition active:scale-95"
          :aria-label="t('common.back')"
          @click="clearImage()"
        >
          <span class="material-symbols-outlined text-xl">chevron_left</span>
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-2 text-xs font-bold text-white/80"
          @click="fileInput?.click()"
        >
          <span class="material-symbols-outlined text-base">imagesmode</span>
          {{ t('create.pinMobile.changeMedia') }}
        </button>
      </header>

      <div class="relative flex min-h-0 flex-1 flex-col overflow-y-auto px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] lg:mx-auto lg:max-w-xl lg:w-full">
        <div
          v-if="imagePreviewUrl"
          class="relative mx-auto mb-4 flex max-h-[min(32svh,280px)] w-full items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/55 lg:max-h-[360px]"
        >
          <img :src="imagePreviewUrl" alt="" class="max-h-[min(32svh,280px)] w-full object-contain lg:max-h-[360px]">
          <div
            v-if="mediaModerationPending"
            class="absolute inset-0 flex flex-col items-center justify-center gap-2 rounded-2xl bg-black/50"
          >
            <span class="h-8 w-8 animate-spin rounded-full border-2 border-pink-500 border-t-transparent" />
            <p class="text-xs text-white/70">{{ t('moderation.scanningMediaShort') }}</p>
          </div>
        </div>

        <div class="mx-auto w-full max-w-md space-y-4 rounded-3xl border border-white/10 bg-black/60 p-5 backdrop-blur-xl">
          <p class="text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">
            {{ t('create.quick.publishStep') }}
          </p>

          <input
            v-model="title"
            type="text"
            :placeholder="t('create.quick.titlePlaceholder')"
            required
            autocomplete="off"
            class="w-full border-0 border-b-2 border-white/14 bg-transparent pb-3 text-2xl font-black tracking-tight text-white outline-none placeholder:text-white/35 focus:border-pink-500/60"
          >

          <div class="space-y-2">
            <p class="text-xs font-semibold text-white/70">{{ t('create.quick.categoryLabel') }}</p>
            <p class="text-[11px] leading-snug text-white/45">{{ t('create.quick.categoryHint') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                v-for="chip in chipOptions"
                :key="chip.originalName || chip.name"
                type="button"
                class="rounded-full border px-3 py-1.5 text-xs font-semibold transition active:scale-[0.98]"
                :class="
                  isSelected(chip)
                    ? 'border-pink-400 bg-pink-500/20 text-white'
                    : 'border-white/15 bg-white/5 text-white/75 hover:border-white/25'
                "
                @click="selectTopic(chip)"
              >
                {{ chip.name }}
              </button>
            </div>
          </div>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-700 to-fuchsia-600 py-4 text-base font-black text-white shadow-lg transition active:scale-[0.98] disabled:opacity-50"
            :disabled="!canPublish"
            @click="publish()"
          >
            <svg v-if="saving || mediaModerationPending" class="h-5 w-5 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span v-else class="material-symbols-outlined text-xl">rocket_launch</span>
            {{
              saving
                ? t('create.publishing')
                : mediaModerationPending
                  ? t('moderation.scanningMediaShort')
                  : t('create.quick.publishNow')
            }}
          </button>

          <p v-if="canPublishHint && !canPublish" class="text-center text-xs text-amber-200/90">
            {{ canPublishHint }}
          </p>

          <p class="text-center text-xs text-white/40">{{ t('create.quick.detailsLater') }}</p>
        </div>
      </div>
    </div>

    <BirthDateRequiredModal v-model="showBirthDateModal" @saved="void fetchCurrentUser({ force: true, silent: true })" />
  </div>
</template>
