<script setup lang="ts">
import { ref, computed, onMounted, onUnmounted, watch, nextTick } from 'vue'
import { useRouter } from 'vue-router'
import api from '../api'
import { useAuth } from '../composables/useAuth'
import { useAppModal } from '../composables/useAppModal'
import { useI18n } from '../i18n'
import StoryViewer from '../components/StoryViewer.vue'
import StoryImageCropEditor from '../components/StoryImageCropEditor.vue'
import StoryVideoEditor from '../components/StoryVideoEditor.vue'
import BirthDateRequiredModal from '../components/BirthDateRequiredModal.vue'
import {
  hasRequiredBirthDateForMediaPublish,
  isVerifiedAdultFromBirthDate,
  moderationScanImageFile,
  moderationScanVideoFile,
  moderationScanText,
} from '../composables/useModeration'
import { mapDjangoPinToFrontend } from '../composables/usePins'
import { formatDrfErrorMessages } from '../utils/apiValidationErrors'
import { consumePendingStoryCaptureFile } from '../utils/storyCaptureDraft'
import { useIsLgDown } from '../composables/useIsLgDown'
import { useEdgeSwipeBack } from '../composables/useEdgeSwipeBack'
import { usePinovaHeaderSwipeDismiss } from '../composables/usePinovaHeaderSwipeDismiss'
import { useLayer } from '../navigation/useLayer'
import type { Pin } from '../types'

const { t } = useI18n()
const router = useRouter()
const { isLgDown } = useIsLgDown()
const { layer, close: closeLayer } = useLayer()

function leaveStoryFlow() {
  if (layer.value) closeLayer()
  else void router.back()
}

const storyCreateShellRef = ref<HTMLElement | null>(null)
const storyHeaderSwipeRef = ref<HTMLElement | null>(null)
const { showAlert } = useAppModal()
const { isAuthenticated, currentUser, fetchCurrentUser } = useAuth()

/* Desktop : étape « légende » puis choix média. Mobile : étape 1 = fichier ou caméra. */
const step = ref<'caption' | 'pick' | 'image-edit' | 'video-edit' | 'meta'>(
  isLgDown.value ? 'pick' : 'caption',
)
const nativeStoryCameraInput = ref<HTMLInputElement | null>(null)
function openStoryCameraCapture() {
  nativeStoryCameraInput.value?.click()
}
function goCaptionToMedia() {
  step.value = 'pick'
}
const description = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const storyVideoFile = ref<File | null>(null)
const storyVideoPreviewUrl = ref<string | null>(null)
const editingImageFile = ref<File | null>(null)
const editingVideoFile = ref<File | null>(null)
const galleryInput = ref<HTMLInputElement | null>(null)
const publishedStory = ref<Pin | null>(null)
const storyViewerOpen = ref(false)
const storyMetaMainRef = ref<HTMLElement | null>(null)
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

function isSupportedStoryVideoFile(file: File) {
  const contentType = (file.type || '').split(';')[0]?.trim().toLowerCase()
  return (
    contentType === 'video/mp4' ||
    contentType === 'video/webm' ||
    contentType === 'video/quicktime' ||
    /\.(mp4|webm|mov)$/i.test(file.name)
  )
}

function clearMediaSelection() {
  mediaScanGeneration++
  mediaModerationPending.value = false
  revoke(imagePreviewUrl.value)
  revoke(storyVideoPreviewUrl.value)
  imagePreviewUrl.value = null
  imageFile.value = null
  storyVideoPreviewUrl.value = null
  storyVideoFile.value = null
  editingImageFile.value = null
  editingVideoFile.value = null
  pendingSensitiveBlur.value = false
}

function goPickStep() {
  editingImageFile.value = null
  editingVideoFile.value = null
  step.value = 'pick'
}

function storyMetaBack() {
  if (imageFile.value && imagePreviewUrl.value && imageFile.value.type.startsWith('image/')) {
    editingImageFile.value = imageFile.value
    step.value = 'image-edit'
    return
  }
  if (storyVideoFile.value && storyVideoPreviewUrl.value) {
    editingVideoFile.value = storyVideoFile.value
    step.value = 'video-edit'
    return
  }
  goPickStep()
  clearMediaSelection()
}

function setEditedImage(file: File) {
  editingImageFile.value = null
  clearMediaSelection()
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
  void runImageModeration(file)
  step.value = 'meta'
}

function setEditedVideo(file: File) {
  editingVideoFile.value = null
  clearMediaSelection()
  storyVideoFile.value = file
  storyVideoPreviewUrl.value = URL.createObjectURL(file)
  void runVideoModeration(file)
  step.value = 'meta'
}

async function runImageModeration(file: File) {
  if (isLgDown.value) {
    pendingSensitiveBlur.value = false
    return
  }
  if (!file.type.startsWith('image/')) return
  const gen = ++mediaScanGeneration
  mediaModerationPending.value = true
  try {
    const r = await moderationScanImageFile(file, moderationBirthOpts.value)
    if (gen !== mediaScanGeneration) return
    if (r.level === 'block') {
      pendingSensitiveBlur.value = false
      clearMediaSelection()
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

async function runVideoModeration(file: File) {
  if (isLgDown.value) {
    pendingSensitiveBlur.value = false
    return
  }
  if (!isSupportedStoryVideoFile(file)) return
  const gen = ++mediaScanGeneration
  mediaModerationPending.value = true
  try {
    const r = await moderationScanVideoFile(file, 5, moderationBirthOpts.value)
    if (gen !== mediaScanGeneration) return
    if (r.level === 'block') {
      pendingSensitiveBlur.value = false
      clearMediaSelection()
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
    console.warn('Scan NSFW vidéo story', err)
  } finally {
    if (gen === mediaScanGeneration) mediaModerationPending.value = false
  }
}

async function applyMediaFile(f: File | null) {
  if (!f) return
  const isImage = f.type.startsWith('image/')
  const isVideo = isSupportedStoryVideoFile(f)
  if (!isImage && !isVideo) {
    await showAlert(t('create.upload.invalid'), { variant: 'warning' })
    return
  }
  await fetchCurrentUser({ silent: true })
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    /* Modal de saisie inline plutôt que renvoyer l'utilisateur en Paramètres. */
    showBirthDateModal.value = true
    return
  }
  if (isVideo) {
    clearMediaSelection()
    editingVideoFile.value = f
    step.value = 'video-edit'
    return
  }
  clearMediaSelection()
  editingImageFile.value = f
  step.value = 'image-edit'
}

async function pickMedia(ev: Event) {
  const input = ev.target as HTMLInputElement
  const f = input.files?.[0] ?? null
  input.value = ''
  await applyMediaFile(f)
}

/* Modal date de naissance : ouvert auto à l'arrivée si l'utilisateur n'a pas
   sa date renseignée, et bloque la publication tant qu'elle manque. */
const showBirthDateModal = ref(false)

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
    return
  }
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    showBirthDateModal.value = true
  }
  const capturedFile = consumePendingStoryCaptureFile()
  if (capturedFile) {
    await applyMediaFile(capturedFile)
  }
})

onUnmounted(() => {
  revoke(imagePreviewUrl.value)
  revoke(storyVideoPreviewUrl.value)
})

async function submit() {
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    /* Modal de saisie inline plutôt que renvoyer l'utilisateur en Paramètres. */
    showBirthDateModal.value = true
    return
  }
  if (!imageFile.value && !storyVideoFile.value) {
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
    if (imageFile.value) fd.append('image', imageFile.value)
    if (storyVideoFile.value) fd.append('story_video', storyVideoFile.value)

    const res = await api.post('pins/standalone-story/', fd, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    const slug = typeof res.data?.slug === 'string' ? res.data.slug.trim() : ''
    if (!slug) {
      router.push('/')
      return
    }
    publishedStory.value = mapDjangoPinToFrontend(res.data)
    storyViewerOpen.value = true
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

function closePublishedStory() {
  storyViewerOpen.value = false
  publishedStory.value = null
  router.push('/')
}

function scrollStoryMetaToEnd() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      const el = storyMetaMainRef.value
      if (!el) return
      el.scrollTop = Math.max(0, el.scrollHeight - el.clientHeight)
    })
  })
}

watch(
  step,
  (s) => {
    if (s === 'meta') scrollStoryMetaToEnd()
  },
  { flush: 'post', immediate: true },
)

watch(
  [step, editingImageFile, editingVideoFile],
  () => {
    if (step.value === 'image-edit' && !editingImageFile.value) goPickStep()
    if (step.value === 'video-edit' && !editingVideoFile.value) goPickStep()
  },
  { flush: 'post' },
)

function onStoryEdgeDismiss() {
  if (step.value === 'pick') {
    leaveStoryFlow()
    return
  }
  if (step.value === 'meta') {
    storyMetaBack()
    return
  }
  if (step.value === 'image-edit' || step.value === 'video-edit') {
    goPickStep()
    return
  }
  leaveStoryFlow()
}

function storyEdgeUsesFullSlideOut() {
  return step.value === 'pick'
}

useEdgeSwipeBack(storyCreateShellRef, {
  enabled: () => isLgDown.value,
  fullSlideOut: storyEdgeUsesFullSlideOut,
  onDismiss: onStoryEdgeDismiss,
  canAcceptPointerDown: (e) => {
    const el = e.target as HTMLElement | null
    if (!el) return true
    return !el.closest('[data-pinova-no-edge-back]')
  },
})

usePinovaHeaderSwipeDismiss({
  gestureRootRef: storyHeaderSwipeRef,
  transformRef: storyCreateShellRef,
  enabled: () => isLgDown.value && !layer.value,
  onClose: () => leaveStoryFlow(),
})
</script>

<template>
  <div class="create-story-page-root flex w-full flex-1 flex-col min-h-0">
  <div
    ref="storyCreateShellRef"
    :class="[
      isLgDown
        ? 'flex min-h-0 w-full flex-1 flex-col overflow-y-auto overflow-x-hidden overscroll-y-contain bg-[#060408] text-white pinova-min-vh-fill'
        : 'story-create-shell pinova-min-vh-fill flex w-full flex-1 flex-col min-h-0 bg-[#060408] text-white overflow-hidden',
    ]"
  >
    <input
      ref="galleryInput"
      type="file"
      accept="image/*,video/mp4,video/webm,video/quicktime,.mov"
      class="hidden"
      :disabled="mediaModerationPending || saving"
      @change="(e) => void pickMedia(e)"
    >
    <input
      ref="nativeStoryCameraInput"
      type="file"
      accept="image/*,video/mp4,video/webm,video/quicktime,.mov"
      capture="environment"
      class="hidden"
      :disabled="mediaModerationPending || saving"
      @change="(e) => void pickMedia(e)"
    >

    <div
      v-if="step === 'caption'"
      :class="[
        'story-caption-step relative flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+1rem)]',
        isLgDown ? 'min-h-[100svh]' : 'min-h-0 flex-1',
      ]"
    >
      <div class="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-pink-700/10 dark:bg-pink-600/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-2xl" />
      <header class="relative z-10 flex items-center justify-between">
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 active:scale-95 transition"
          :aria-label="t('common.cancel')"
          @click="leaveStoryFlow()"
        >
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
        <p class="text-sm font-black tracking-tight">{{ t('story.standalone.navShort') }}</p>
        <span class="h-9 w-9" />
      </header>
      <div class="relative z-10 mx-auto mt-4 flex max-w-md items-center gap-2 px-8">
        <span class="h-1.5 w-[22px] rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 via-rose-400 to-fuchsia-500" />
        <span class="h-1.5 flex-1 rounded-full bg-white/15" />
      </div>
      <section class="relative z-10 mx-auto mt-9 max-w-md">
        <p class="mb-2 text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/30">{{ t('story.standalone.stepBadge') }}</p>
        <h1 class="text-3xl sm:text-4xl font-black leading-[1.05] tracking-[-0.04em]">{{ t('story.standalone.captionFirstTitle') }}</h1>
        <p class="mt-3 text-sm leading-6 text-white/40">{{ t('story.standalone.captionFirstHint') }}</p>
        <div class="mt-8 rounded-2xl border border-white/10 bg-white/[0.04] p-4">
          <label class="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">
            <span class="grid h-6 w-6 place-items-center rounded-lg bg-pink-700/15 dark:bg-pink-600/15 text-pink-700 dark:text-pink-600">
              <span class="material-symbols-outlined text-sm">chat_bubble</span>
            </span>
            {{ t('story.standalone.caption') }}
          </label>
          <textarea
            v-model="description"
            rows="5"
            maxlength="1000"
            class="min-h-28 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.04] px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/25 focus:border-pink-700/70 focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20"
            :placeholder="t('story.standalone.captionPlaceholder')"
          />
        </div>
        <button
          type="button"
          class="mt-6 flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 to-fuchsia-600 py-4 text-base font-black text-white shadow-lg shadow-pink-700/35 transition active:scale-[0.98]"
          @click="goCaptionToMedia"
        >
          <span class="material-symbols-outlined text-xl">arrow_forward</span>
          {{ t('create.step.next') }}
        </button>
      </section>
    </div>

    <div
      v-else-if="step === 'pick'"
      :class="[
        'story-media-step relative flex flex-col px-5 pb-[calc(env(safe-area-inset-bottom,0px)+2rem)] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]',
        isLgDown ? 'min-h-[100svh]' : 'min-h-0 flex-1',
      ]"
    >
      <div class="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-pink-700/10 dark:bg-pink-600/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-2xl" />

      <header ref="storyHeaderSwipeRef" class="relative z-10 flex items-center justify-between" data-pinova-swipe-dismiss-handle>
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 active:scale-95 transition"
          :aria-label="t('common.cancel')"
          @click="leaveStoryFlow()"
        >
          <span class="material-symbols-outlined text-xl">close</span>
        </button>
        <p class="text-sm font-black tracking-tight">{{ t('story.standalone.navShort') }}</p>
        <span class="h-9 w-9" />
      </header>

      <div class="relative z-10 mx-auto mt-4 flex max-w-sm items-center gap-1.5 px-4">
        <span class="h-1.5 min-w-[20px] flex-1 rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 via-rose-400 to-fuchsia-500" />
        <span class="h-1.5 min-w-[20px] flex-1 rounded-full bg-white/15" />
        <span class="h-1.5 min-w-[20px] flex-1 rounded-full bg-white/15" />
      </div>
      <p class="relative z-10 mx-auto mt-2 max-w-sm text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">
        {{ t('create.mobile.stepPick') }}
      </p>

      <section class="relative z-10 mx-auto mt-7 max-w-sm story-enter-down">
        <p class="mb-2 text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/30">{{ t('story.standalone.stepBadge') }}</p>
        <h1 class="text-[2.35rem] font-black leading-[1.05] tracking-[-0.08em]">{{ t('story.standalone.mediaTitle') }}</h1>
        <p class="mt-3 text-sm leading-6 text-white/40">{{ t('story.standalone.mediaHint') }}</p>
      </section>

      <section class="relative z-10 mx-auto mt-10 grid max-w-sm gap-3 story-enter-up">
        <button
          type="button"
          class="story-pick-card story-pick-card-primary min-h-48"
          :disabled="mediaModerationPending || saving"
          @click="galleryInput?.click()"
        >
          <span class="story-pick-icon bg-white/15 text-white">
            <span class="material-symbols-outlined text-3xl">imagesmode</span>
          </span>
          <span class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">{{ t('story.standalone.galleryLabel') }}</span>
          <span class="text-2xl font-black tracking-tight">{{ t('story.standalone.chooseFile') }}</span>
        </button>

        <button
          type="button"
          class="story-pick-card min-h-40 border border-white/10 bg-white/[0.03]"
          :disabled="mediaModerationPending || saving"
          @click="openStoryCameraCapture()"
        >
          <span class="story-pick-icon bg-white/5 text-pink-700 dark:text-pink-600">
            <span class="material-symbols-outlined text-3xl">videocam</span>
          </span>
          <span class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/35">{{ t('story.standalone.cameraLabel') }}</span>
          <span class="text-[1.35rem] font-black tracking-tight">{{ t('story.standalone.captureStory') }}</span>
        </button>
      </section>

      <div v-if="needsBirthBanner" class="relative z-10 mx-auto mt-5 max-w-sm rounded-2xl border border-amber-200/30 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
        {{ t('create.banner.birthDate') }}
        <router-link to="/settings" class="font-bold text-amber-50 underline underline-offset-2">
          {{ t('create.banner.birthDateCta') }}
        </router-link>
      </div>
    </div>

    <StoryImageCropEditor
      v-else-if="step === 'image-edit' && editingImageFile"
      :file="editingImageFile"
      @cancel="goPickStep"
      @apply="setEditedImage"
    />

    <StoryVideoEditor
      v-else-if="step === 'video-edit' && editingVideoFile"
      :file="editingVideoFile"
      @cancel="goPickStep"
      @apply="setEditedVideo"
    />

    <div
      v-else-if="step === 'meta'"
      :class="[
        'story-meta-step relative flex min-h-0 flex-1 flex-col overflow-hidden bg-[#060408]',
      ]"
    >
      <header
        ref="storyHeaderSwipeRef"
        class="relative z-30 flex shrink-0 items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
        data-pinova-swipe-dismiss-handle
      >
        <button
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/45 text-white active:scale-95 transition"
          :aria-label="t('common.back')"
          @click="storyMetaBack()"
        >
          <span class="material-symbols-outlined text-xl">chevron_left</span>
        </button>
        <div class="flex shrink-0 items-center gap-2">
          <button
            type="button"
            class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-2 text-xs font-bold text-white/80 active:scale-95 transition"
            :disabled="mediaModerationPending || saving"
            @click="galleryInput?.click()"
          >
            <span class="material-symbols-outlined text-base">imagesmode</span>
            {{ t('story.standalone.changeMedia') }}
          </button>
          <button
            type="button"
            class="grid h-10 w-10 place-items-center rounded-full border border-white/15 bg-black/50 text-white active:scale-95 transition"
            :aria-label="t('story.standalone.cameraLabel')"
            :disabled="mediaModerationPending || saving"
            @click="openStoryCameraCapture()"
          >
            <span class="material-symbols-outlined text-xl">photo_camera</span>
          </button>
        </div>
      </header>

      <div
        v-if="imagePreviewUrl || storyVideoPreviewUrl"
        class="relative z-20 shrink-0 px-4 pb-2"
      >
        <div class="mx-auto flex max-h-[min(36svh,300px)] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/55">
          <img
            v-if="imagePreviewUrl"
            :src="imagePreviewUrl"
            alt=""
            class="max-h-[min(36svh,300px)] w-full object-contain"
          >
          <video
            v-else
            :src="storyVideoPreviewUrl || ''"
            class="max-h-[min(36svh,300px)] w-full object-contain"
            autoplay
            muted
            loop
            playsinline
          />
        </div>
      </div>

      <main
        ref="storyMetaMainRef"
        class="relative z-20 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain rounded-t-[2rem] border-t border-white/10 bg-black/72 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 backdrop-blur-xl"
      >
        <div class="mx-auto mb-2 h-1.5 w-10 shrink-0 rounded-full bg-white/25" aria-hidden="true" />
        <div class="mx-auto mb-2 flex max-w-md shrink-0 justify-center gap-1.5 px-2">
          <span class="h-1.5 min-w-[18px] flex-1 rounded-full bg-white/22" />
          <span class="h-1.5 min-w-[18px] flex-1 rounded-full bg-white/22" />
          <span class="h-1.5 min-w-[18px] flex-1 rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 via-rose-400 to-fuchsia-500" />
        </div>
        <p class="mb-3 shrink-0 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">
          {{ t('create.mobile.stepMeta') }}
        </p>
        <div class="flex min-h-min flex-col justify-end">
          <div class="mx-auto w-full max-w-md space-y-3">
          <div v-if="mediaModerationPending" class="story-glass-card flex items-center gap-2 text-xs text-white/70 story-enter-up">
            <span class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-pink-700 border-t-transparent" />
            {{ t('moderation.scanningMedia') }}
          </div>

          <div v-if="needsBirthBanner" class="story-glass-card border-amber-200/25 bg-amber-300/10 text-xs leading-5 text-amber-100 story-enter-up">
            {{ t('create.banner.birthDate') }}
            <router-link to="/settings" class="font-bold text-amber-50 underline underline-offset-2">
              {{ t('create.banner.birthDateCta') }}
            </router-link>
          </div>

          <div class="story-glass-card story-enter-up">
            <label class="mb-2 flex items-center gap-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">
              <span class="grid h-6 w-6 place-items-center rounded-lg bg-pink-700/15 dark:bg-pink-600/15 text-pink-700 dark:text-pink-600">
                <span class="material-symbols-outlined text-sm">chat_bubble</span>
              </span>
              {{ t('story.standalone.caption') }}
            </label>
            <textarea
              v-model="description"
              rows="4"
              maxlength="1000"
              class="min-h-24 w-full resize-none rounded-2xl border border-white/10 bg-white/[0.06] px-4 py-3 text-sm font-medium text-white outline-none transition placeholder:text-white/25 focus:border-pink-700/70 focus:ring-2 focus:ring-pink-700/20 dark:focus:ring-pink-600/20"
              :placeholder="t('story.standalone.captionPlaceholder')"
            />
          </div>

          <button
            type="button"
            class="story-publish-btn story-enter-up"
            :disabled="saving || needsBirthBanner || mediaModerationPending"
            @click="submit()"
          >
            <span v-if="saving" class="h-4 w-4 animate-spin rounded-full border-2 border-white/80 border-t-transparent" />
            <span v-else class="material-symbols-outlined text-lg">auto_stories</span>
            {{ saving ? t('create.publishing') : t('story.standalone.publish') }}
          </button>
        </div>
        </div>
      </main>
    </div>

    <StoryViewer
      v-model="storyViewerOpen"
      :pins="publishedStory ? [publishedStory] : []"
      @update:model-value="(open) => { if (!open) closePublishedStory() }"
    />
  </div>

  <BirthDateRequiredModal v-model="showBirthDateModal" required />
  </div>
</template>

<style scoped>
.story-enter-down {
  animation: story-enter-down 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.story-enter-up {
  animation: story-enter-up 0.38s cubic-bezier(0.2, 0.8, 0.2, 1) both;
}

.story-pick-card {
  position: relative;
  display: flex;
  flex-direction: column;
  justify-content: flex-end;
  gap: 0.25rem;
  overflow: hidden;
  border-radius: 1.75rem;
  padding: 1.75rem;
  text-align: left;
  transition: transform 0.18s ease, opacity 0.18s ease, filter 0.18s ease;
}

.story-pick-card:active {
  transform: scale(0.98);
  opacity: 0.88;
}

.story-pick-card-primary {
  background: linear-gradient(135deg, #ec4899 0%, #db2777 48%, #a855f7 100%);
  box-shadow: 0 28px 70px -28px rgb(236 72 153 / 0.78);
}

.story-pick-icon {
  position: absolute;
  right: 1.375rem;
  top: 1.375rem;
  display: grid;
  height: 3.75rem;
  width: 3.75rem;
  place-items: center;
  border-radius: 999px;
}

.story-glass-card {
  border: 1px solid rgb(255 255 255 / 0.09);
  border-radius: 1.5rem;
  background: rgb(255 255 255 / 0.055);
  padding: 1rem;
  backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
}

.story-publish-btn {
  display: inline-flex;
  min-height: 3.25rem;
  width: 100%;
  align-items: center;
  justify-content: center;
  gap: 0.5rem;
  border-radius: 999px;
  background: linear-gradient(90deg, #ec4899, #db2777);
  color: white;
  font-size: 0.95rem;
  font-weight: 900;
  box-shadow: 0 18px 40px -16px rgb(236 72 153 / 0.8);
  transition: transform 0.18s ease, opacity 0.18s ease, filter 0.18s ease;
}

.story-publish-btn:active:not(:disabled) {
  transform: scale(0.97);
}

.story-publish-btn:disabled {
  opacity: 0.55;
  pointer-events: none;
}

@keyframes story-enter-down {
  from {
    opacity: 0;
    transform: translateY(-18px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}

@keyframes story-enter-up {
  from {
    opacity: 0;
    transform: translateY(24px);
  }
  to {
    opacity: 1;
    transform: translateY(0);
  }
}
</style>
