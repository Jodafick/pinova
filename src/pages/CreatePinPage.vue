<script setup lang="ts">
import { computed, ref, onMounted, watch, nextTick } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { usePins } from '../composables/usePins'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import { useAppModal } from '../composables/useAppModal'
import { pushToast } from '../composables/useToast'
import { trackOnce } from '../lib/analytics'
import PrivateTags from '../components/PrivateTags.vue'
import CreatePinEditSkeleton from '../components/CreatePinEditSkeleton.vue'
import PinovaButton from '../components/ui/PinovaButton.vue'
import QuickCreatePinView from '../components/QuickCreatePinView.vue'
import StoryImageCropEditor from '../components/StoryImageCropEditor.vue'
import BirthDateRequiredModal from '../components/BirthDateRequiredModal.vue'
import api from '../api/index'
import {
  moderationScanText,
  moderationScanImageFile,
  moderationScanVideoFile,
  isVerifiedAdultFromBirthDate,
  hasRequiredBirthDateForMediaPublish,
} from '../composables/useModeration'
import {
  extractDrfFieldErrors,
  firstErroredField,
  formatDrfErrorMessages,
  drfErrorTouchesFields,
} from '../utils/apiValidationErrors'
import { translatePinovaErrorToken, translatePinovaNonFieldToken } from '../utils/formErrorMessages'
import { escapeHtml } from '../utils/escapeHtml'
import { useAnchoredDropdown } from '../composables/useAnchoredDropdown'
import { usePointerOutsideDismiss } from '../composables/usePointerOutsideDismiss'
import { useIsLgDown } from '../composables/useIsLgDown'
import { useEdgeSwipeBack } from '../composables/useEdgeSwipeBack'
import { usePinovaHeaderSwipeDismiss } from '../composables/usePinovaHeaderSwipeDismiss'
import { useLayer } from '../navigation/useLayer'
import {
  invalidateHomeStoriesCache,
  invalidateProfileActiveStories,
} from '../utils/activeStoriesCache'
import { navigateToPublishedPin } from '../utils/postPublishNavigation'
import { shouldCelebrateFirstPin } from '@pinova/shared'
import { useActivationFunnel } from '../composables/useActivationFunnel'
import { openFirstPinCelebration } from '../composables/useActivationMoments'

/** Champs affichés uniquement à l’étape 1 (texte / catégorie / tags publics). Pas les tags privés (étape 2). */
const CREATE_PIN_STEP_1_FIELD_KEYS = new Set([
  'title',
  'description',
  'link',
  'topic',
  'public_tags_input',
])

const { t, currentLang } = useI18n()
const { showAlert } = useAppModal()

const router = useRouter()
const route = useRoute()
const { addPin, updatePin, topics, getPin, fetchPinBySlug, fetchPrivateTags } = usePins()
const { currentUser, fetchMyBoards, isAuthenticated, fetchCurrentUser } = useAuth()
const { funnelState } = useActivationFunnel()

const needsBirthDateForMedia = computed(
  () => isAuthenticated.value && !hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate),
)

const title = ref('')
const description = ref('')
const link = ref('')
const topic = ref('')
const imageFile = ref<File | null>(null)
const imagePreviewUrl = ref<string | null>(null)
const storyVideoFile = ref<File | null>(null)
const storyVideoPreviewUrl = ref<string | null>(null)
const isDragging = ref(false)
const fileInput = ref<HTMLInputElement | null>(null)
/** Caméra système (-picker natif, attribut `capture`). */
const nativeCameraInput = ref<HTMLInputElement | null>(null)
function openCameraCapture() {
  nativeCameraInput.value?.click()
}
/** Retouche image (mobile, breakpoint lg) — étape 2 avant formulaire. */
const pinMobilePendingImage = ref<File | null>(null)
/** Après rognage : retour depuis l’étape 3 rouvre l’éditeur avec le fichier courant. */
const mobileReturnToEditOnBack = ref(false)
const pinMobileMetaScrollRef = ref<HTMLElement | null>(null)
const pinMobileShellRef = ref<HTMLElement | null>(null)
const pinMobileHeaderSwipeRef = ref<HTMLElement | null>(null)
const { isLgDown } = useIsLgDown()
const { layer, close: closeLayer, popAll } = useLayer()

/** Ferme les couches plein écran (création pin) puis navigue : les liens internes sinon restent sous le layer. */
async function navigateFromCreateLayer(path: string) {
  popAll()
  await nextTick()
  try {
    await router.push(path)
  } catch {
    /* navigation dupliquée */
  }
}

function leaveCreateFlow() {
  if (layer.value) closeLayer()
  else void router.back()
}

const saving = ref(false)
/** Scan NSFW : publication avec flou par défaut (adultes vérifiés uniquement). */
const pendingSensitiveBlur = ref(false)
/** Chargement modèle NSFWJS + analyse — désactive publier et affiche un overlay sur le média. */
const mediaModerationPending = ref(false)
let mediaScanGeneration = 0

const moderationBirthOpts = computed(() => ({
  birthDate: currentUser.value?.birthDate,
  isAuthenticated: isAuthenticated.value,
}))

// Privacy mode (qui peut voir ce pin)
const visibility = ref<'public' | 'followers' | 'private'>('public')

// Tags privés
const privateTags = ref<string[]>([])
const publicTagsInput = ref('')
const selectedBoardIds = ref<number[]>([])
const myBoards = ref<{ id: number; name: string; is_private?: boolean }[]>([])
const fieldErrors = ref<Record<string, string>>({})
const titleInput = ref<HTMLInputElement | null>(null)
const descriptionInput = ref<HTMLTextAreaElement | null>(null)
const linkInput = ref<HTMLInputElement | null>(null)
const categoryInput = ref<HTMLInputElement | null>(null)
const publicTagsInputRef = ref<HTMLInputElement | null>(null)

const currentPlan = computed<'free' | 'plus' | 'pro'>(() => currentUser.value?.subscription?.plan || 'free')

const createNoTrackingSafeHtml = computed(() =>
  escapeHtml(t('create.noTracking')).replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>'),
)

const canSchedulePublish = computed(() => currentPlan.value === 'pro')
const scheduledPublishLocal = ref('')
watch(canSchedulePublish, (ok) => {
  if (!ok) scheduledPublishLocal.value = ''
}, { immediate: true })
type TopicOption = { name: string; originalName: string; icon?: string; color?: string }
const dynamicTopics = ref<TopicOption[]>([])
type CachedTopics = { at: number; rows: TopicOption[] }
const TOPICS_QUERY_CACHE = new Map<string, CachedTopics>()
const TOPICS_CACHE_TTL_MS = 10 * 60 * 1000
const boardsLoading = ref(false)
const showCategoryDropdown = ref(false)
const categoryAnchorRef = ref<HTMLElement | null>(null)
const categoryFloatingRef = ref<HTMLElement | null>(null)

const { floatingStyles: categoryFloatingStyles } = useAnchoredDropdown(categoryAnchorRef, categoryFloatingRef, {
  open: showCategoryDropdown,
  placement: 'bottom-start',
  strategy: 'fixed',
  matchReferenceWidth: true,
})

usePointerOutsideDismiss(() => [
  {
    isOpen: showCategoryDropdown,
    getRoots: () => [categoryAnchorRef.value, categoryFloatingRef.value],
    close: () => {
      showCategoryDropdown.value = false
    },
  },
])

const categorySearch = ref('')
let categorySearchTimer: ReturnType<typeof setTimeout> | null = null

const editSlug = computed(() => (route.name === 'edit-pin' ? String(route.params.slug || '').trim() : ''))
const isEditMode = computed(() => editSlug.value.length > 0)
const isQuickMode = computed(() => !isEditMode.value && String(route.query.mode || '') === 'quick')
const isCompleteDetailsMode = computed(() => isEditMode.value && String(route.query.complete || '') === '1')

async function skipCompleteDetails() {
  const slug = editSlug.value
  if (!slug) {
    leaveCreateFlow()
    return
  }
  if (layer.value) popAll()
  await navigateToPublishedPin(router, {
    slug,
    username: currentUser.value?.username,
  })
}
const loadingEdit = ref(false)
const createStep = ref<1 | 2>(1)
type MobilePinStep = 'pick' | 'edit' | 'meta'
const mobileCreateStep = ref<MobilePinStep>(isEditMode.value ? 'meta' : 'pick')

const existingImageUrl = ref<string | null>(null)
const existingStoryVideoUrl = ref<string | null>(null)

async function goStep2() {
  if (!title.value.trim()) {
    void showAlert(t('create.step1.titleRequired'), { variant: 'warning' })
    return
  }
  const resolvedTopic = topic.value || categorySearch.value.trim()
  if (!resolvedTopic) {
    void showAlert(t('create.step1.categoryRequired'), { variant: 'warning' })
    return
  }
  await fetchCurrentUser({ silent: true })
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    /* Au lieu d'une simple alerte qui force un détour vers Paramètres, on
       affiche directement un modal de saisie pour débloquer la publication
       sans quitter le flux de création. */
    showBirthDateModal.value = true
    return
  }
  createStep.value = 2
}

function goStep1() {
  createStep.value = 1
}

const isStory = ref(false)

watch(isStory, (on) => {
  if (on) clearStoryVideo()
})

const isGif = computed(() => imageFile.value?.type === 'image/gif')
const fileAcceptAttr = computed(() => {
  if (isLgDown.value && !isEditMode.value) {
    return 'image/*,.gif,.webp,.png,.jpg,.jpeg,.avif,.heic,.heif'
  }
  return isStory.value
    ? 'image/*,image/gif'
    : 'image/*,image/gif,video/mp4,video/webm,video/quicktime'
})
const canUsePrivateTags = computed(() => currentPlan.value !== 'free')
const resolvedTopics = computed<TopicOption[]>(() => {
  if (dynamicTopics.value.length > 0) return dynamicTopics.value
  return topics.value.map((chip) => ({ name: chip.label, originalName: chip.canonical }))
})
const filteredTopics = computed(() => {
  const q = categorySearch.value.trim().toLowerCase()
  if (!q) return resolvedTopics.value.slice(0, 20)
  return resolvedTopics.value
    .filter((item) =>
      item.name.toLowerCase().includes(q) ||
      item.originalName.toLowerCase().includes(q),
    )
    .slice(0, 20)
})

const loadTopics = async (query = '') => {
  const key = `${currentLang.value}:${query.trim().toLowerCase()}`
  const hit = TOPICS_QUERY_CACHE.get(key)
  if (hit && Date.now() - hit.at < TOPICS_CACHE_TTL_MS) {
    dynamicTopics.value = hit.rows
    return
  }
  try {
    const response = await api.get('pins/topics/', {
      params: { lang: currentLang.value, q: query, limit: 20 },
    })
    const payload = Array.isArray(response.data) ? response.data : []
    const rows = payload.map((item: any) => ({
      name: item?.name || '',
      originalName: item?.originalName || item?.name || '',
      icon: item?.icon || 'category',
      color: item?.color || '#6B7280',
    })).filter((item: TopicOption) => item.name)
    dynamicTopics.value = rows
    TOPICS_QUERY_CACHE.set(key, { at: Date.now(), rows })
  } catch (err) {
    console.warn('Impossible de charger les catégories dynamiques', err)
  }
}

const loadBoards = async () => {
  if (!currentUser.value) {
    myBoards.value = []
    return
  }
  boardsLoading.value = true
  try {
    myBoards.value = await fetchMyBoards()
  } catch (err) {
    console.warn('Impossible de charger les tableaux', err)
    myBoards.value = []
  } finally {
    boardsLoading.value = false
  }
}

/* Modal de saisie de date de naissance — affiché automatiquement à l'ouverture
   de la page si l'utilisateur authentifié n'a pas encore renseigné sa date,
   et bloque la publication tant qu'elle n'est pas fournie. */
const showBirthDateModal = ref(false)

function maybePromptBirthDate() {
  if (!isAuthenticated.value) return
  if (!hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    showBirthDateModal.value = true
  }
}

onMounted(async () => {
  if (isAuthenticated.value && !currentUser.value) {
    await fetchCurrentUser({ silent: true })
  }
  await loadTopics('')
  maybePromptBirthDate()

  if (isEditMode.value) {
    loadingEdit.value = true
    try {
      await fetchPinBySlug(editSlug.value)
      const p = getPin(editSlug.value)
      if (!p || currentUser.value?.username !== p.username) {
        await showAlert(t('pin.edit.denied'), { variant: 'warning', title: t('modal.errorTitle') })
        router.replace('/')
        return
      }
      title.value = p.title
      description.value = p.description || ''
      link.value = p.link || ''
      topic.value = p.topic
      categorySearch.value = p.topicDisplay || p.topic
      visibility.value = (p.visibility as typeof visibility.value) || 'public'
      isStory.value = !!p.isStory
      existingImageUrl.value = p.imageUrl || null
      existingStoryVideoUrl.value =
        !p.isStory && !p.imageUrl && p.storyVideoUrl ? p.storyVideoUrl : null
      pendingSensitiveBlur.value = !!p.mediaSensitiveBlur
      publicTagsInput.value = (p.hashtags || []).map((h) => String(h).replace(/^#/, '').trim()).filter(Boolean).join(', ')
      selectedBoardIds.value = (p.boards || []).filter((b) => {
        const o = String(b.ownerUsername || '').trim().toLowerCase()
        const me = String(currentUser.value?.username || '').trim().toLowerCase()
        return !!o && o === me
      }).map((b) => b.id)
      if (canUsePrivateTags.value) {
        try {
          privateTags.value = [...(await fetchPrivateTags(editSlug.value))]
        } catch {
          privateTags.value = []
        }
      }
      await fetchCurrentUser({ silent: true })
      if (canSchedulePublish.value && p.scheduledPublishAt) {
        try {
          const d = new Date(p.scheduledPublishAt)
          if (!Number.isNaN(d.getTime())) {
            const pad = (n: number) => String(n).padStart(2, '0')
            scheduledPublishLocal.value = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}`
          }
        } catch {
          scheduledPublishLocal.value = ''
        }
      }
      createStep.value = 2
    } catch {
      await showAlert(t('pin.edit.loadError'), { variant: 'danger', title: t('modal.errorTitle') })
      router.replace('/')
    } finally {
      loadingEdit.value = false
    }
  }
})

/*
 * `deep: true` rechargeait les boards à chaque mutation interne (renommage,
 * is_private toggle, etc.) → cycles inutiles + appels API redondants. On
 * surveille seulement la longueur et la liste des IDs : suffisant pour
 * détecter "nouveau board ajouté" / "board supprimé" / "réordonnement".
 */
watch(
  () => (currentUser.value?.boards || []).map((b) => b.id).join(','),
  () => void loadBoards(),
  { immediate: true },
)

watch(categorySearch, (value) => {
  if (categorySearchTimer) clearTimeout(categorySearchTimer)
  categorySearchTimer = setTimeout(() => {
    void loadTopics(value.trim())
  }, 250)
})

watch(currentLang, () => {
  void loadTopics(categorySearch.value.trim())
})

function clearStoryVideo() {
  mediaScanGeneration++
  mediaModerationPending.value = false
  if (storyVideoPreviewUrl.value) URL.revokeObjectURL(storyVideoPreviewUrl.value)
  storyVideoFile.value = null
  storyVideoPreviewUrl.value = null
  pendingSensitiveBlur.value = false
}

async function runVideoModeration(file: File) {
  if (isLgDown.value) {
    pendingSensitiveBlur.value = false
    return
  }
  if (!file.type.startsWith('video/')) return
  const gen = ++mediaScanGeneration
  mediaModerationPending.value = true
  try {
    const r = await moderationScanVideoFile(file, 5, moderationBirthOpts.value)
    if (gen !== mediaScanGeneration) return
    if (r.level === 'block') {
      pendingSensitiveBlur.value = false
      clearStoryVideo()
      await showAlert(t('moderation.imageSensitiveBlocked'), {
        variant: 'danger',
        title: t('modal.errorTitle'),
      })
      return
    }
    if (r.level === 'video_too_small') {
      pendingSensitiveBlur.value = false
      clearStoryVideo()
      await showAlert(t('moderation.videoTooShort', { minMb: r.minSizeMb }), {
        variant: 'warning',
        title: t('modal.errorTitle'),
      })
      return
    }
    if (r.level === 'video_too_large') {
      pendingSensitiveBlur.value = false
      clearStoryVideo()
      await showAlert(t('moderation.videoTooHeavy', { maxMb: r.maxSizeMb }), {
        variant: 'warning',
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
    console.warn('Scan NSFW vidéo indisponible ou erreur', err)
  } finally {
    if (gen === mediaScanGeneration) mediaModerationPending.value = false
  }
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
      clearImage()
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
    console.warn('Scan NSFW indisponible ou erreur', err)
  } finally {
    if (gen === mediaScanGeneration) mediaModerationPending.value = false
  }
}

async function ensureBirthDateBeforeMedia(): Promise<boolean> {
  await fetchCurrentUser({ silent: true })
  if (hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) return true
  /* Ouvre le modal directement plutôt qu'une alerte d'avertissement. */
  showBirthDateModal.value = true
  createStep.value = 1
  return false
}

function pinMobileUsesCropEditor(file: File) {
  if (!isLgDown.value || !file.type.startsWith('image/')) return false
  if (file.type === 'image/gif') return false
  return true
}

function closePinMobileCropEditor() {
  pinMobilePendingImage.value = null
  mobileCreateStep.value = 'pick'
}

function onPinMobileCropCancel() {
  closePinMobileCropEditor()
}

async function commitPickedImageFile(file: File, opts?: { fromCrop?: boolean }) {
  if (storyVideoPreviewUrl.value) URL.revokeObjectURL(storyVideoPreviewUrl.value)
  storyVideoFile.value = null
  storyVideoPreviewUrl.value = null
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = file
  imagePreviewUrl.value = URL.createObjectURL(file)
  void runImageModeration(file)
  mobileReturnToEditOnBack.value = !!opts?.fromCrop
  mobileCreateStep.value = 'meta'
  if (isLgDown.value) createStep.value = 2
}

async function onPinMobileCropped(file: File) {
  pinMobilePendingImage.value = null
  await commitPickedImageFile(file, { fromCrop: true })
}

function mobilePinMetaBack() {
  if (mobileCreateStep.value === 'edit') {
    closePinMobileCropEditor()
    return
  }
  if (isEditMode.value) {
    leaveCreateFlow()
    return
  }
  if (mobileCreateStep.value === 'meta') {
    if (
      mobileReturnToEditOnBack.value &&
      imageFile.value &&
      pinMobileUsesCropEditor(imageFile.value)
    ) {
      pinMobilePendingImage.value = imageFile.value
      mobileCreateStep.value = 'edit'
      return
    }
    clearStep2Media()
    return
  }
}

const CREATE_PIN_IMAGE_MAX_BYTES = 10 * 1024 * 1024

async function setMediaFile(file: File) {
  if (!(await ensureBirthDateBeforeMedia())) return
  if (file.type.startsWith('video/')) {
    if (isLgDown.value && !isEditMode.value) {
      void showAlert(t('create.pinMobile.videoNotAllowed'), { variant: 'warning' })
      return
    }
    if (isStory.value) {
      void showAlert(t('create.upload.videoNotForStory'), { variant: 'warning' })
      return
    }
    if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
    imageFile.value = null
    imagePreviewUrl.value = null
    if (storyVideoPreviewUrl.value) URL.revokeObjectURL(storyVideoPreviewUrl.value)
    storyVideoFile.value = file
    storyVideoPreviewUrl.value = URL.createObjectURL(file)
    void runVideoModeration(file)
    mobileReturnToEditOnBack.value = false
    mobileCreateStep.value = 'meta'
    if (isLgDown.value) createStep.value = 2
    return
  }
  if (file.type.startsWith('image/')) {
    if (file.size > CREATE_PIN_IMAGE_MAX_BYTES) {
      void showAlert(t('create.upload.tooLarge'), { variant: 'warning' })
      return
    }
    if (pinMobileUsesCropEditor(file)) {
      pinMobilePendingImage.value = file
      mobileCreateStep.value = 'edit'
      return
    }
    await commitPickedImageFile(file)
    return
  }
  void showAlert(t('create.upload.invalid'), { variant: 'warning' })
}

const onFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) void setMediaFile(file)
  ;(e.target as HTMLInputElement).value = ''
}

const onDrop = (e: DragEvent) => {
  e.preventDefault()
  isDragging.value = false
  const file = e.dataTransfer?.files?.[0]
  if (file) void setMediaFile(file)
}

const clearImage = () => {
  mediaScanGeneration++
  mediaModerationPending.value = false
  if (imagePreviewUrl.value) URL.revokeObjectURL(imagePreviewUrl.value)
  imageFile.value = null
  imagePreviewUrl.value = null
  pendingSensitiveBlur.value = false
}

const clearStep2Media = () => {
  closePinMobileCropEditor()
  clearImage()
  clearStoryVideo()
  existingImageUrl.value = null
  existingStoryVideoUrl.value = null
  mobileReturnToEditOnBack.value = false
  mobileCreateStep.value = 'pick'
  if (isLgDown.value && !isEditMode.value) createStep.value = 1
}

const submitPin = async () => {
  fieldErrors.value = {}
  if (!title.value) return
  const hasRemoteMedia =
    !!existingImageUrl.value || !!(existingStoryVideoUrl.value || '').trim()
  if (
    !hasRemoteMedia && !imageFile.value && !storyVideoFile.value
  ) {
    return
  }
  if (mediaModerationPending.value) return
  const textOk = await moderationScanText([
    title.value,
    description.value,
    publicTagsInput.value,
    link.value,
  ])
  if (!textOk.ok) {
    await showAlert(t('moderation.textInappropriate'), { variant: 'warning' })
    createStep.value = 1
    return
  }
    await fetchCurrentUser({ silent: true })
    const hasMedia = !!(
      imageFile.value ||
      storyVideoFile.value ||
      existingImageUrl.value ||
      (existingStoryVideoUrl.value || '').trim()
    )
  if (hasMedia && !hasRequiredBirthDateForMediaPublish(currentUser.value?.birthDate)) {
    /* Dernière barrière avant l'envoi : on ouvre le modal de saisie au lieu
       d'un alert dead-end. */
    showBirthDateModal.value = true
    createStep.value = 1
    return
  }
  const pinsBeforePublish = currentUser.value?.pinsCount ?? 0
  saving.value = true

  try {
    const formData = new FormData()
    formData.append('title', title.value)
    formData.append('description', description.value || '')
    formData.append('link', link.value || '')
    if (imageFile.value) formData.append('image', imageFile.value)
    if (storyVideoFile.value) formData.append('story_video', storyVideoFile.value)
    const resolvedTopic = topic.value || categorySearch.value.trim() || 'Général'
    formData.append('topic', resolvedTopic)
    formData.append('visibility', visibility.value)
    formData.append('is_story', isStory.value ? 'true' : 'false')
    if (canSchedulePublish.value && scheduledPublishLocal.value) {
      const d = new Date(scheduledPublishLocal.value)
      if (!Number.isNaN(d.getTime())) {
        formData.append('scheduled_publish_at', d.toISOString())
      }
    }
    publicTagsInput.value
      .split(',')
      .map((tag) => tag.trim())
      .filter(Boolean)
      .forEach((tag) => formData.append('public_tags_input', tag))
    if (canUsePrivateTags.value) {
      privateTags.value.forEach((tag) => formData.append('private_tags_input', tag))
    }
    selectedBoardIds.value.forEach((boardId) => formData.append('board_ids_input', String(boardId)))

    const blurPublish =
      pendingSensitiveBlur.value &&
      isVerifiedAdultFromBirthDate(currentUser.value?.birthDate)
    formData.append('media_sensitive_blur', blurPublish ? 'true' : 'false')

    if (!isEditMode.value && currentUser.value) {
      formData.append('author', currentUser.value.id.toString())
    }

    let resultPin
    if (isEditMode.value) {
      resultPin = await updatePin(editSlug.value, formData)
    } else {
      resultPin = await addPin(formData)
    }
    const destSlug = resultPin?.slug || editSlug.value
    if (isStory.value) {
      invalidateHomeStoriesCache()
      const un = currentUser.value?.username?.trim()
      if (un) invalidateProfileActiveStories(un)
    }
    /* Rafraîchit /me et le snapshot localStorage : les compteurs (pins_count,
       stories_count, etc.) du profil courant doivent refléter la nouvelle
       publication immédiatement (header, profil, suggestions). */
    const successMessage = isEditMode.value
      ? t('pin.edit.success')
      : isStory.value
        ? t('create.story.success')
        : t('create.pin.success')
    pushToast({ message: successMessage, kind: 'success' })
    if (!isEditMode.value) {
      trackOnce('first_pin_published', { pin_slug: destSlug, is_story: isStory.value })
      if (!isStory.value) {
        const { recordEngagementMoment } = await import('../utils/engagementMoments')
        recordEngagementMoment('pin_published')
      }
    }
    if (layer.value) closeLayer()
    const celebrateFirstPin =
      !isEditMode.value &&
      destSlug &&
      shouldCelebrateFirstPin(funnelState.value, pinsBeforePublish, !!isStory.value)
    if (celebrateFirstPin) {
      await fetchCurrentUser({ force: true, silent: true })
      openFirstPinCelebration({
        slug: destSlug,
        username: currentUser.value?.username ?? null,
      })
      return
    }
    if (isStory.value && destSlug) {
      window.location.assign(`/?story=${encodeURIComponent(destSlug)}`)
    } else if (destSlug) {
      await navigateToPublishedPin(router, {
        slug: destSlug,
        username: currentUser.value?.username,
        pin: resultPin ?? null,
      })
    } else {
      await router.push('/')
    }
  } catch (err: unknown) {
    console.error('Erreur lors de la publication:', err)
    const ax = err as { response?: { data?: Record<string, unknown> } }
    const data = ax.response?.data
    if (data && typeof data === 'object' && !Array.isArray(data)) {
      const extracted = extractDrfFieldErrors(data)
      fieldErrors.value = Object.fromEntries(
        Object.entries(extracted).map(([k, v]) => [k, translatePinovaErrorToken(v[0] || '', t)]),
      )
      if (drfErrorTouchesFields(data, CREATE_PIN_STEP_1_FIELD_KEYS)) {
        createStep.value = 1
      } else if (fieldErrors.value.image || fieldErrors.value.story_video) {
        createStep.value = 2
      }
      const mediaErr = fieldErrors.value.image || fieldErrors.value.story_video
      if (mediaErr) {
        pushToast({ message: mediaErr, kind: 'error' })
      }
      const first = firstErroredField(extracted, [
        'title',
        'description',
        'link',
        'topic',
        'public_tags_input',
      ])
      requestAnimationFrame(() => {
        if (first === 'title') titleInput.value?.focus()
        if (first === 'description') descriptionInput.value?.focus()
        if (first === 'link') linkInput.value?.focus()
        if (first === 'topic') categoryInput.value?.focus()
        if (first === 'public_tags_input') publicTagsInputRef.value?.focus()
      })
      const hasFieldErr = Object.keys(fieldErrors.value).length > 0
      const rawNfe = data.non_field_errors
      const nfe0 =
        Array.isArray(rawNfe) && typeof rawNfe[0] === 'string' && rawNfe[0].trim()
          ? rawNfe[0].trim()
          : ''
      const detail =
        typeof data.detail === 'string' && data.detail.trim() ? data.detail.trim() : ''
      const globalMsg = nfe0
        ? translatePinovaNonFieldToken(nfe0, t)
        : detail
          ? translatePinovaNonFieldToken(detail, t)
          : ''

      if (globalMsg) {
        pushToast({ message: globalMsg, kind: 'error' })
      } else if (!hasFieldErr) {
        const lines = formatDrfErrorMessages(data)
        await showAlert(lines.slice(0, 8).join('\n') || t('create.publish.error'), {
          variant: 'danger',
          title: t('modal.errorTitle'),
        })
      }
    } else {
      await showAlert(t('create.publish.error'), { variant: 'danger', title: t('modal.errorTitle') })
    }
  } finally {
    saving.value = false
  }
}

const toggleBoardSelection = (boardId: number) => {
  if (selectedBoardIds.value.includes(boardId)) {
    selectedBoardIds.value = selectedBoardIds.value.filter((id) => id !== boardId)
  } else {
    selectedBoardIds.value = [...selectedBoardIds.value, boardId]
  }
}

const selectCategory = (selected: TopicOption) => {
  topic.value = selected.originalName
  categorySearch.value = selected.name
  showCategoryDropdown.value = false
}

function setPinVisibility(id: 'public' | 'followers' | 'private') {
  visibility.value = id
}

function scrollPinMobileMetaToStart() {
  void nextTick(() => {
    requestAnimationFrame(() => {
      const el = pinMobileMetaScrollRef.value
      if (!el) return
      el.scrollTop = 0
      titleInput.value?.focus({ preventScroll: true })
    })
  })
}

watch(
  [isLgDown, mobileCreateStep, loadingEdit, isEditMode],
  () => {
    if (!isLgDown.value || loadingEdit.value) return
    if (mobileCreateStep.value === 'edit') return
    if (!isEditMode.value && mobileCreateStep.value !== 'meta') return
    scrollPinMobileMetaToStart()
  },
  { flush: 'post', immediate: true },
)

function onCreateMobileEdgeDismiss() {
  if (mobileCreateStep.value === 'edit') {
    closePinMobileCropEditor()
    return
  }
  if (!isEditMode.value && mobileCreateStep.value === 'meta') {
    mobilePinMetaBack()
    return
  }
  if (!isEditMode.value && mobileCreateStep.value === 'pick') {
    leaveCreateFlow()
    return
  }
  if (isEditMode.value) {
    mobilePinMetaBack()
  }
}

function createMobileEdgeUsesFullSlideOut() {
  if (mobileCreateStep.value === 'edit') return false
  if (!isEditMode.value && mobileCreateStep.value === 'meta') return false
  return true
}

useEdgeSwipeBack(pinMobileShellRef, {
  enabled: () => isLgDown.value && !loadingEdit.value,
  fullSlideOut: createMobileEdgeUsesFullSlideOut,
  onDismiss: onCreateMobileEdgeDismiss,
  canAcceptPointerDown: (e) => {
    const el = e.target as HTMLElement | null
    if (!el) return true
    return !el.closest('[data-pinova-no-edge-back]')
  },
})

usePinovaHeaderSwipeDismiss({
  gestureRootRef: pinMobileHeaderSwipeRef,
  transformRef: pinMobileShellRef,
  enabled: () => isLgDown.value && !loadingEdit.value && !layer.value,
  onClose: () => leaveCreateFlow(),
})
</script>

<template>
  <QuickCreatePinView v-if="isQuickMode" @cancel="leaveCreateFlow()" />

  <div v-else class="create-pin-page-root flex w-full flex-1 flex-col min-h-0">
  <CreatePinEditSkeleton
    v-if="loadingEdit"
    class="w-full min-w-0 max-w-5xl mx-auto px-4 sm:px-6 py-8 sm:py-12 rounded-3xl bg-gradient-to-b from-pink-50/70 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900"
  />

  <div
    v-else-if="isLgDown"
    ref="pinMobileShellRef"
    class="pinova-create-flow-mobile flex min-h-0 w-full flex-1 flex-col overflow-hidden overflow-x-hidden bg-[#060408] text-white"
  >
    <input ref="fileInput" type="file" class="hidden" data-testid="create-pin-file" :accept="fileAcceptAttr" @change="onFileChange">
    <!-- Même entrée que desktop : absent ici, `openCameraCapture()` ne ciblait aucun élément. -->
    <input
      ref="nativeCameraInput"
      type="file"
      class="hidden"
      accept="image/*"
      capture="environment"
      @change="onFileChange"
    >

    <div
      v-if="!isEditMode && mobileCreateStep === 'pick'"
      class="relative flex min-h-0 flex-1 flex-col px-5 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]"
    >
      <div class="pointer-events-none absolute -right-16 -top-20 h-64 w-64 rounded-full bg-pink-700/10 dark:bg-pink-600/10 blur-2xl" />
      <div class="pointer-events-none absolute -bottom-20 -left-20 h-72 w-72 rounded-full bg-fuchsia-500/10 blur-2xl" />

      <header ref="pinMobileHeaderSwipeRef" class="relative z-10 flex items-center justify-between" data-pinova-swipe-dismiss-handle>
        <button
          type="button"
          class="grid h-9 w-9 place-items-center rounded-full bg-white/10 text-white/80 transition active:scale-95"
          :aria-label="t('common.cancel')"
          @click="leaveCreateFlow()"
        >
          <PinovaIcon name="close" class="text-xl" />
        </button>
        <p class="text-sm font-black tracking-tight">{{ t('create.pinMobile.header') }}</p>
        <span class="h-9 w-9" />
      </header>

      <div class="relative z-10 mx-auto mt-4 flex max-w-sm items-center gap-1.5 px-2">
        <span class="h-1.5 min-w-[20px] flex-1 rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 via-rose-400 to-fuchsia-500" />
        <span class="h-1.5 min-w-[20px] flex-1 rounded-full bg-white/15" />
        <span class="h-1.5 min-w-[20px] flex-1 rounded-full bg-white/15" />
      </div>
      <p class="relative z-10 mx-auto mt-2 max-w-sm text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">
        {{ t('create.mobile.stepPick') }}
      </p>

      <section class="relative z-10 mx-auto mt-7 max-w-sm">
        <p class="mb-2 text-[10px] font-extrabold uppercase tracking-[0.25em] text-white/30">{{ t('create.pinMobile.stepBadge') }}</p>
        <h1 class="text-[2.35rem] font-black leading-[1.05] tracking-[-0.08em]">
          {{ t('create.pinMobile.mediaTitleLine1') }}<br>{{ t('create.pinMobile.mediaTitleLine2') }}
        </h1>
        <p class="mt-3 text-sm leading-6 text-white/40">{{ t('create.pinMobile.mediaHint') }}</p>
      </section>

      <section class="relative z-10 mx-auto mt-10 grid max-w-sm gap-3">
        <button
          type="button"
          class="pin-m-pick-card pin-m-pick-primary relative flex min-h-[11.875rem] max-h-[190px] flex-col justify-end overflow-hidden rounded-[1.75rem] px-7 pb-7 pt-16 text-left text-white shadow-[0_28px_70px_-28px_rgba(236,72,153,0.78)] transition active:scale-[0.98] active:opacity-90"
          data-welcome-coach="media"
          @click="fileInput?.click()"
        >
          <span class="absolute right-[1.375rem] top-[1.375rem] grid h-[3.75rem] w-[3.75rem] place-items-center rounded-full bg-white/15 text-white">
            <PinovaIcon name="imagesmode" class="text-3xl" />
          </span>
          <span class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/60">{{ t('create.pinMobile.galleryLabel') }}</span>
          <span class="text-2xl font-black tracking-tight">{{ t('create.pinMobile.chooseFile') }}</span>
        </button>

        <button
          type="button"
          class="pin-m-pick-card relative flex min-h-[9.375rem] max-h-[150px] flex-col justify-end overflow-hidden rounded-[1.75rem] border border-white/10 bg-white/[0.03] px-7 pb-7 pt-16 text-left transition active:scale-[0.98] active:opacity-90"
          @click="openCameraCapture()"
        >
          <span class="absolute right-[1.375rem] top-[1.375rem] grid h-[3.75rem] w-[3.75rem] place-items-center rounded-full bg-white/5 text-pink-700 dark:text-pink-600">
            <PinovaIcon name="photo_camera" class="text-3xl" />
          </span>
          <span class="text-[10px] font-extrabold uppercase tracking-[0.16em] text-white/35">{{ t('create.pinMobile.cameraLabel') }}</span>
          <span class="text-[1.35rem] font-black tracking-tight">{{ t('create.pinMobile.capturePin') }}</span>
        </button>
      </section>

      <div v-if="needsBirthDateForMedia" class="relative z-10 mx-auto mt-5 max-w-sm rounded-2xl border border-amber-200/30 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
        {{ t('create.banner.birthDate') }}
        <a
          href="/settings"
          class="font-bold text-amber-50 underline underline-offset-2"
          @click.prevent="navigateFromCreateLayer('/settings')"
        >
          {{ t('create.banner.birthDateCta') }}
        </a>
      </div>
    </div>

    <div
      v-else-if="!isEditMode && mobileCreateStep === 'edit' && pinMobilePendingImage"
      class="relative z-[80] flex min-h-0 flex-1 flex-col"
    >
      <StoryImageCropEditor
        export-profile="pin"
        :file="pinMobilePendingImage"
        @cancel="onPinMobileCropCancel"
        @apply="onPinMobileCropped"
      />
    </div>

    <!-- Étape 3 mobile (création + édition) : aperçu cadré + formulaire scrollable -->
    <div v-else class="pin-m-meta relative z-10 flex min-h-0 flex-1 flex-col overflow-hidden bg-[#060408]">
      <header
        ref="pinMobileHeaderSwipeRef"
        class="relative z-30 flex shrink-0 items-center justify-between px-4 pb-2 pt-[calc(env(safe-area-inset-top,0px)+0.5rem)]"
        data-pinova-swipe-dismiss-handle
      >
        <button
          type="button"
          class="grid h-10 w-10 place-items-center rounded-full border border-white/10 bg-black/45 text-white transition active:scale-95"
          :aria-label="t('common.back')"
          @click="mobilePinMetaBack()"
        >
          <PinovaIcon name="chevron_left" class="text-xl" />
        </button>
        <button
          type="button"
          class="inline-flex items-center gap-1.5 rounded-full border border-white/15 bg-black/50 px-3 py-2 text-xs font-bold text-white/80 transition active:scale-95"
          @click="fileInput?.click()"
        >
          <PinovaIcon name="imagesmode" class="text-base" />
          {{ (imagePreviewUrl || storyVideoPreviewUrl || (existingImageUrl || '').trim() || (existingStoryVideoUrl || '').trim()) ? t('create.pinMobile.changeMedia') : t('create.pinMobile.galleryPill') }}
        </button>
      </header>

      <div
        v-if="storyVideoPreviewUrl || (!imagePreviewUrl && (existingStoryVideoUrl || '').trim()) || imagePreviewUrl || (existingImageUrl || '').trim()"
        class="relative z-20 shrink-0 px-4 pb-2"
      >
        <div
          class="mx-auto flex max-h-[min(24svh,220px)] w-full max-w-md items-center justify-center overflow-hidden rounded-2xl border border-white/10 bg-black/55"
        >
          <video
            v-if="storyVideoPreviewUrl || (!imagePreviewUrl && (existingStoryVideoUrl || '').trim())"
            :src="storyVideoPreviewUrl || existingStoryVideoUrl || ''"
            class="max-h-[min(24svh,220px)] w-full object-contain"
            autoplay
            muted
            loop
            playsinline
          />
          <img
            v-else
            :src="(imagePreviewUrl || existingImageUrl || '').trim()"
            alt=""
            class="max-h-[min(24svh,220px)] w-full object-contain"
          >
        </div>
      </div>

      <main
        ref="pinMobileMetaScrollRef"
        class="pin-m-sheet relative z-20 flex min-h-0 flex-1 flex-col overflow-y-auto overscroll-y-contain rounded-t-[2rem] border-t border-white/10 bg-black/72 px-4 pb-[max(0.75rem,env(safe-area-inset-bottom,0px))] pt-3 shadow-[0_-12px_40px_-18px_rgba(0,0,0,0.45)] backdrop-blur-2xl backdrop-saturate-150"
      >
        <div class="mx-auto mb-3 h-1.5 w-10 shrink-0 rounded-full bg-white/25" aria-hidden="true" />
        <div class="flex min-h-min flex-col justify-end">
          <div v-if="!isEditMode" class="mx-auto mb-2 flex max-w-md shrink-0 justify-center gap-1.5 px-2">
            <span class="h-1.5 min-w-[18px] flex-1 rounded-full bg-white/22" />
            <span class="h-1.5 min-w-[18px] flex-1 rounded-full bg-white/22" />
            <span class="h-1.5 min-w-[18px] flex-1 rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 via-rose-400 to-fuchsia-500" />
          </div>
          <p v-if="!isEditMode" class="mb-3 shrink-0 text-center text-[10px] font-extrabold uppercase tracking-[0.2em] text-white/35">
            {{ t('create.mobile.stepMeta') }}
          </p>
          <div class="mx-auto w-full max-w-md space-y-3">
          <div
            v-if="isCompleteDetailsMode"
            class="rounded-2xl border border-pink-500/30 bg-pink-500/10 px-4 py-3 space-y-2"
          >
            <p class="text-sm font-bold text-pink-200">{{ t('create.complete.title') }}</p>
            <p class="text-xs leading-5 text-white/55">{{ t('create.complete.subtitle') }}</p>
            <button
              type="button"
              class="text-xs font-bold text-pink-300 underline underline-offset-2"
              @click="skipCompleteDetails()"
            >
              {{ t('create.complete.skip') }}
            </button>
          </div>
          <div v-if="needsBirthDateForMedia" class="rounded-2xl border border-amber-200/25 bg-amber-300/10 px-4 py-3 text-xs leading-5 text-amber-100">
            {{ t('create.banner.birthDate') }}
            <a
              href="/settings"
              class="font-bold text-amber-50 underline underline-offset-2"
              @click.prevent="navigateFromCreateLayer('/settings')"
            >{{ t('create.banner.birthDateCta') }}</a>
          </div>

          <div v-if="mediaModerationPending" class="pin-m-glass flex items-center gap-2 text-xs text-white/70">
            <span class="h-4 w-4 shrink-0 animate-spin rounded-full border-2 border-pink-700 border-t-transparent" />
            {{ t('moderation.scanningMedia') }}
          </div>

          <div class="pin-m-glass space-y-4">
            <div>
              <input
                ref="titleInput"
                v-model="title"
                type="text"
                data-welcome-coach="title"
                :placeholder="t('create.field.title.placeholder')"
                class="w-full border-0 border-b-2 border-white/14 bg-transparent pb-3 text-2xl font-black tracking-tight text-white outline-none placeholder:text-white/38 focus:border-pink-700/60 dark:border-pink-600/60"
              />
              <p v-if="fieldErrors.title" class="mt-1 text-xs font-semibold text-pink-700 dark:text-pink-600">{{ fieldErrors.title }}</p>
            </div>
            <div>
              <textarea
                ref="descriptionInput"
                v-model="description"
                rows="3"
                maxlength="1000"
                :placeholder="t('create.field.description.placeholder')"
                class="w-full resize-none border-0 border-b-2 border-white/11 bg-transparent pb-3 text-sm text-white/75 outline-none placeholder:text-white/38 focus:border-pink-700/50 dark:border-pink-600/50"
              />
              <p v-if="fieldErrors.description" class="mt-1 text-xs font-semibold text-pink-700 dark:text-pink-600">{{ fieldErrors.description }}</p>
            </div>
            <div class="flex items-center gap-2 rounded-2xl border border-white/10 bg-white/[0.04] px-3 py-2">
              <PinovaIcon name="link" class="text-lg text-white/35" />
              <input
                ref="linkInput"
                v-model="link"
                type="url"
                :placeholder="t('create.field.link.placeholder')"
                class="min-w-0 flex-1 bg-transparent py-2 text-sm text-white/70 outline-none placeholder:text-white/38"
              />
            </div>
            <p v-if="fieldErrors.link" class="text-xs font-semibold text-pink-700 dark:text-pink-600">{{ fieldErrors.link }}</p>

            <div class="relative z-40">
              <p class="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">{{ t('create.field.category') }}</p>
              <div ref="categoryAnchorRef" class="relative">
                <input
                  ref="categoryInput"
                  v-model="categorySearch"
                  data-testid="create-pin-category"
                  type="text"
                  :placeholder="t('create.field.category.placeholder')"
                  class="w-full rounded-2xl border border-white/13 bg-white/[0.055] px-4 py-3 text-sm text-white outline-none placeholder:text-white/38 focus:border-pink-700/70"
                  @focus="showCategoryDropdown = true"
                />
                <button
                  type="button"
                  class="absolute right-2 top-1/2 grid h-8 w-8 -translate-y-1/2 place-items-center rounded-full hover:bg-white/10"
                  @click="showCategoryDropdown = !showCategoryDropdown"
                >
                  <PinovaIcon name="expand_more" class="text-white/50" />
                </button>
              </div>
              <Teleport to="body">
                <div
                  v-if="showCategoryDropdown"
                  ref="categoryFloatingRef"
                  class="max-h-56 overflow-y-auto rounded-xl border border-white/15 bg-neutral-950 shadow-2xl"
                  role="listbox"
                  :style="{ ...categoryFloatingStyles, zIndex: 200 }"
                >
                  <button
                    v-for="topicItem in filteredTopics"
                    :key="topicItem.originalName"
                    type="button"
                    class="flex w-full items-center gap-2 px-3 py-2.5 text-left text-sm text-white/90 hover:bg-white/10"
                    @click="selectCategory(topicItem)"
                  >
                    <PinovaIcon :name="topicItem.icon || 'category'" class="text-base text-white/40" />
                    <span>{{ topicItem.name }}</span>
                  </button>
                  <button
                    v-if="categorySearch.trim() && !resolvedTopics.some((item) => item.name === categorySearch.trim() || item.originalName === categorySearch.trim())"
                    type="button"
                    class="w-full px-3 py-2.5 text-left text-sm font-semibold text-pink-700 dark:text-pink-600 hover:bg-pink-700/10 dark:hover:bg-pink-600/20"
                    @click="selectCategory({ name: categorySearch.trim(), originalName: categorySearch.trim() })"
                  >
                    + {{ categorySearch.trim() }}
                  </button>
                </div>
              </Teleport>
              <p v-if="fieldErrors.topic" class="mt-1 text-xs text-pink-700 dark:text-pink-600">{{ fieldErrors.topic }}</p>
            </div>
          </div>

          <div class="pin-m-glass space-y-3">
            <p class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">{{ t('create.visibility.label') }}</p>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in [
                  { id: 'public', label: t('create.visibility.public'), icon: 'public' },
                  { id: 'followers', label: t('create.visibility.followers'), icon: 'group' },
                  { id: 'private', label: t('create.visibility.private'), icon: 'lock' },
                ]"
                :key="option.id"
                type="button"
                class="rounded-xl border px-2 py-2.5 text-center text-[11px] font-bold transition"
                :class="visibility === option.id ? 'border-pink-700 dark:border-pink-600 bg-pink-700/15 dark:bg-pink-600/15 text-pink-200' : 'border-white/10 bg-white/[0.04] text-white/50'"
                @click="setPinVisibility(option.id as 'public' | 'followers' | 'private')"
              >
                <PinovaIcon :name="option.icon" class="mb-0.5 block text-base" />
                {{ option.label }}
              </button>
            </div>
            <label class="flex cursor-pointer items-start gap-3 border-t border-white/10 pt-3">
              <input v-model="isStory" type="checkbox" class="mt-1 rounded border-white/20 bg-white/10 text-pink-700 focus:ring-pink-700 dark:focus:ring-pink-600">
              <span>
                <span class="block text-sm font-semibold text-white">{{ t('create.story.title') }}</span>
                <span class="block text-xs text-white/40">{{ t('create.story.subtitle') }}</span>
              </span>
            </label>
          </div>

          <div class="pin-m-glass space-y-3">
            <p class="text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">{{ t('create.field.publicTags') }}</p>
            <input
              ref="publicTagsInputRef"
              v-model="publicTagsInput"
              type="text"
              :placeholder="t('create.field.publicTags.placeholder')"
              class="w-full rounded-2xl border border-white/13 bg-white/[0.065] px-4 py-3 text-sm text-white outline-none placeholder:text-white/38"
            />
            <p v-if="fieldErrors.public_tags_input" class="text-xs text-pink-700 dark:text-pink-600">{{ fieldErrors.public_tags_input }}</p>
            <div v-if="myBoards.length" class="border-t border-white/10 pt-3">
              <p class="mb-2 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">{{ t('create.field.boards') }}</p>
              <div class="flex flex-wrap gap-2">
                <button
                  v-for="board in myBoards"
                  :key="board.id"
                  type="button"
                  class="rounded-full border px-3 py-1.5 text-xs font-semibold transition"
                  :class="selectedBoardIds.includes(board.id) ? 'border-pink-700 dark:border-pink-600 bg-pink-700/15 dark:bg-pink-600/15 text-pink-200' : 'border-white/10 text-white/55'"
                  @click="toggleBoardSelection(board.id)"
                >
                  {{ board.name }}
                </button>
              </div>
            </div>
            <p v-else class="text-xs text-white/35">{{ t('create.field.boards.empty') }}</p>
          </div>

          <div class="pin-m-glass space-y-3">
            <PrivateTags v-if="canUsePrivateTags" v-model="privateTags" />
            <div v-else class="rounded-2xl border border-violet-400/20 bg-violet-500/10 px-4 py-3 text-xs text-violet-100">
              {{ t('create.privateTags.upgradeRequired') }}
              <a
                href="/premium"
                class="font-bold text-white underline"
                @click.prevent="navigateFromCreateLayer('/premium')"
              >{{ t('create.privateTags.upgradeCta') }}</a>
            </div>
            <div v-if="canSchedulePublish" class="border-t border-white/10 pt-3">
              <p class="mb-1 text-[11px] font-extrabold uppercase tracking-[0.12em] text-white/45">{{ t('create.schedule.title') }}</p>
              <input v-model="scheduledPublishLocal" type="datetime-local" class="w-full max-w-full rounded-xl border border-white/10 bg-white/[0.06] px-3 py-2 text-sm text-white" />
            </div>
          </div>

          <div class="pin-m-glass text-xs leading-relaxed text-white/60">
            <span v-html="createNoTrackingSafeHtml" />
            <a
              href="/premium"
              class="ml-1 font-semibold text-pink-700 dark:text-pink-600 underline"
              @click.prevent="navigateFromCreateLayer('/premium')"
            >{{ t('create.noTracking.learnMore') }}</a>
          </div>

          <button
            type="button"
            class="flex w-full items-center justify-center gap-2 rounded-full bg-gradient-to-r from-pink-700 dark:from-pink-600 to-fuchsia-600 py-4 text-base font-black text-white shadow-lg shadow-pink-700/35 transition active:scale-[0.98] disabled:opacity-50"
            :disabled="!title || (!imagePreviewUrl && !storyVideoPreviewUrl && !(existingImageUrl || '').trim() && !(existingStoryVideoUrl || '').trim()) || saving || mediaModerationPending || needsBirthDateForMedia"
            data-welcome-coach="publish"
            @click="submitPin"
          >
            <svg v-if="saving || mediaModerationPending" class="h-5 w-5 shrink-0 animate-spin" viewBox="0 0 24 24" aria-hidden="true">
              <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
              <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <PinovaIcon v-else name="rocket_launch" class="text-xl" />
            {{
              saving
                ? (isEditMode ? t('pin.edit.saving') : t('create.publishing'))
                : mediaModerationPending
                  ? t('moderation.scanningMediaShort')
                  : isEditMode
                    ? t('pin.edit.save')
                    : t('create.publish')
            }}
          </button>

          <div class="flex justify-center pb-4">
            <button
              type="button"
              class="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-4 py-2 text-xs font-bold text-white/45 transition active:scale-95"
              @click="openCameraCapture()"
            >
              <PinovaIcon name="photo_camera" class="text-base" />
              {{ t('create.pinMobile.cameraShortcut') }}
            </button>
          </div>
          </div>
        </div>
      </main>
    </div>
  </div>

  <div
    v-else
    class="flex min-h-full w-full min-w-0 max-w-5xl flex-1 flex-col mx-auto px-4 sm:px-6 py-8 sm:py-12 rounded-3xl bg-gradient-to-b from-pink-50/70 via-white to-neutral-100 dark:from-neutral-950 dark:via-neutral-950 dark:to-neutral-900"
  >
    <input ref="fileInput" type="file" class="hidden" data-testid="create-pin-file" :accept="fileAcceptAttr" @change="onFileChange">
    <input
      ref="nativeCameraInput"
      type="file"
      class="hidden"
      accept="image/*"
      capture="environment"
      @change="onFileChange"
    >
    <div
      v-if="needsBirthDateForMedia"
      class="mb-6 rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-950 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3"
    >
      <p class="leading-snug">{{ t('create.banner.birthDate') }}</p>
      <a
        href="/settings"
        class="shrink-0 inline-flex items-center justify-center px-4 py-2 rounded-full bg-amber-600 text-white text-xs font-semibold hover:bg-amber-700 text-center"
        @click.prevent="navigateFromCreateLayer('/settings')"
      >
        {{ t('create.banner.birthDateCta') }}
      </a>
    </div>
    <!-- Header -->
    <div class="flex items-center justify-between mb-8" data-pinova-swipe-dismiss-handle>
      <div>
        <h1 class="text-[1.9375rem] sm:text-[2.1875rem] font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-100">
          {{ isCompleteDetailsMode ? t('create.complete.title') : isEditMode ? t('pin.edit.title') : t('create.title') }}
        </h1>
        <p class="text-sm text-neutral-500 dark:text-neutral-300 mt-1">
          {{ isCompleteDetailsMode ? t('create.complete.subtitle') : isEditMode ? t('pin.edit.subtitle') : t('create.subtitle') }}
        </p>
        <p v-if="createStep === 1 && !isCompleteDetailsMode" class="text-xs text-pink-700 mt-2 font-medium">{{ t('create.step1.banner') }}</p>
      </div>
      <div class="flex items-center gap-3">
        <PinovaButton variant="ghost" size="sm" @click="leaveCreateFlow()">
          {{ t('common.cancel') }}
        </PinovaButton>
        <PinovaButton
          v-if="createStep === 2"
          data-testid="create-pin-publish"
          data-welcome-coach="publish"
          variant="primary"
          size="sm"
          :loading="saving || mediaModerationPending"
          :disabled="!title || (!imagePreviewUrl && !storyVideoPreviewUrl && !(existingImageUrl || '').trim() && !(existingStoryVideoUrl || '').trim()) || saving || mediaModerationPending || needsBirthDateForMedia"
          @click="submitPin"
        >
          {{
            saving
              ? (isEditMode ? t('pin.edit.saving') : t('create.publishing'))
              : mediaModerationPending
                ? t('moderation.scanningMediaShort')
                : isEditMode
                  ? t('pin.edit.save')
                  : t('create.publish')
          }}
        </PinovaButton>
        <PinovaButton
          v-else
          data-testid="create-pin-next"
          variant="primary"
          size="sm"
          :disabled="!title.trim() || needsBirthDateForMedia"
          @click="goStep2"
        >
          {{ t('create.step.next') }}
        </PinovaButton>
      </div>
    </div>

    <div
      v-if="isCompleteDetailsMode"
      class="mb-6 flex flex-col gap-3 rounded-2xl border border-pink-200 bg-pink-50 px-4 py-4 dark:border-pink-900/50 dark:bg-pink-950/30 sm:flex-row sm:items-center sm:justify-between"
    >
      <div>
        <p class="text-sm font-bold text-pink-800 dark:text-pink-200">{{ t('create.complete.banner') }}</p>
        <p class="mt-1 text-xs text-pink-900/70 dark:text-pink-100/70">{{ t('create.complete.hint') }}</p>
      </div>
      <button
        type="button"
        class="shrink-0 rounded-full border border-pink-300 px-4 py-2 text-xs font-bold text-pink-800 transition hover:bg-pink-100 dark:border-pink-700 dark:text-pink-200 dark:hover:bg-pink-950/50"
        @click="skipCompleteDetails()"
      >
        {{ t('create.complete.skip') }}
      </button>
    </div>

    <!-- Form -->
    <!-- Formulaire : overflow visible pour que la liste catégories ne soit pas coupée -->
    <div class="bg-white/95 dark:bg-neutral-900/95 rounded-3xl shadow-xl border border-pink-100 dark:border-neutral-700 overflow-visible">
      <div class="flex flex-col xl:flex-row">
        <!-- Image — disponible dès l'étape 1 sur web (même flux empilé que mobile jusqu’à xl). -->
        <div class="xl:w-2/5 p-6 sm:p-8 bg-neutral-50 dark:bg-neutral-950/60 border-b xl:border-b-0 xl:border-r border-neutral-100 dark:border-neutral-800">
          <div
            v-if="!imagePreviewUrl && !storyVideoPreviewUrl && !(existingImageUrl || '').trim() && !(existingStoryVideoUrl || '').trim()"
            class="h-80 xl:h-full min-h-[320px] border-2 border-dashed rounded-2xl flex flex-col items-center justify-center gap-4 text-center cursor-pointer transition-colors"
            :class="isDragging
              ? 'border-pink-700 bg-pink-50/60'
              : 'border-neutral-300 hover:border-pink-300 hover:bg-pink-50/30'"
            @dragover.prevent="isDragging = true"
            @dragleave.prevent="isDragging = false"
            @drop="onDrop"
            data-welcome-coach="media"
            @click="fileInput?.click()"
          >
            <div class="w-16 h-16 rounded-full bg-neutral-200 flex items-center justify-center">
              <PinovaIcon name="cloud_upload" class="text-3xl text-neutral-500" />
            </div>
            <div>
              <p class="text-sm font-semibold text-neutral-700 mb-1">
                {{ t('create.upload.title') }}
              </p>
              <p class="text-xs text-neutral-500">
                {{ t('create.upload.subtitle') }}
              </p>
              <div class="flex items-center justify-center gap-2 mt-3">
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold">JPG</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold">PNG</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-neutral-200 text-neutral-600 rounded font-bold">WEBP</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-pink-100 text-pink-700 rounded font-bold flex items-center gap-1">
                  <PinovaIcon name="animation" class="text-xs" />
                  {{ t('create.upload.gifBadge') }}
                </span>
              </div>
              <p class="text-xs text-neutral-400 mt-2">
                {{ t('create.upload.specs') }}
              </p>
              <p v-if="!isStory" class="text-[11px] text-neutral-500 mt-2">
                {{ t('create.upload.videoHint') }}
              </p>
              <div v-if="!isStory" class="flex items-center justify-center gap-2 mt-2 flex-wrap">
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-violet-100 text-violet-800 rounded font-bold">MP4</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-violet-100 text-violet-800 rounded font-bold">WEBM</span>
                <span class="text-[10px] uppercase tracking-wider px-2 py-0.5 bg-violet-100 text-violet-800 rounded font-bold">MOV</span>
              </div>
            </div>
          </div>

          <div v-else class="relative">
            <video
              v-if="storyVideoPreviewUrl || (!imagePreviewUrl && (existingStoryVideoUrl || '').trim())"
              :src="storyVideoPreviewUrl || existingStoryVideoUrl || ''"
              controls
              muted
              playsinline
              class="w-full rounded-2xl bg-black object-contain max-h-[500px]"
            />
            <template v-else>
              <img
                :src="(imagePreviewUrl || existingImageUrl || '').trim()"
                alt="Aperçu"
                class="w-full rounded-2xl object-cover max-h-[500px]"
              />
              <span
                v-if="isGif"
                class="absolute top-3 left-3 px-2 py-1 rounded-md bg-pink-700 dark:bg-pink-600 text-white text-[10px] font-bold tracking-wider flex items-center gap-1 shadow"
              >
                <PinovaIcon name="animation" class="text-sm" />
                {{ t('create.gif.label') }}
              </span>
            </template>
            <div
              v-if="mediaModerationPending"
              class="absolute inset-0 rounded-2xl bg-white/55 backdrop-blur-[2px] flex flex-col items-center justify-center gap-2 z-10 pointer-events-none"
            >
              <svg class="animate-spin h-10 w-10 text-pink-700" viewBox="0 0 24 24" aria-hidden="true">
                <circle class="opacity-20" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-90" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              <p class="text-xs font-medium text-neutral-700 text-center px-4 max-w-[14rem]">
                {{ t('moderation.scanningMedia') }}
              </p>
            </div>
            <button
              type="button"
              class="absolute top-3 right-3 w-9 h-9 rounded-full bg-white/90 shadow-md flex items-center justify-center hover:bg-white transition z-20"
              @click="clearStep2Media"
            >
              <PinovaIcon name="close" class="text-neutral-600" />
            </button>
          </div>
        </div>

        <!-- Fields -->
        <div class="xl:w-3/5 p-6 sm:p-8 space-y-5">
          <div class="flex items-center gap-2 mb-2">
            <span
              class="text-xs font-bold px-2 py-1 rounded-full"
              :class="createStep === 1 ? 'bg-pink-700 dark:bg-pink-600 text-white' : 'bg-neutral-200 text-neutral-600'"
            >1</span>
            <span class="text-neutral-300">→</span>
            <span
              class="text-xs font-bold px-2 py-1 rounded-full"
              :class="createStep === 2 ? 'bg-pink-700 dark:bg-pink-600 text-white' : 'bg-neutral-200 text-neutral-600'"
            >2</span>
          </div>

          <template v-if="createStep === 1">
          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.title') }}</label>
            <input
              ref="titleInput"
              v-model="title"
              type="text"
              data-testid="create-pin-title"
              data-welcome-coach="title"
              :placeholder="t('create.field.title.placeholder')"
              :class="[
                'w-full px-4 py-3 rounded-xl border text-base focus:outline-none focus:ring-2 focus:border-transparent transition placeholder:text-neutral-400',
                fieldErrors.title
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-neutral-200 focus:ring-pink-700 dark:focus:ring-pink-600',
              ]"
            />
            <p v-if="fieldErrors.title" class="mt-1 text-xs text-red-600">{{ fieldErrors.title }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.description') }}</label>
            <textarea
              ref="descriptionInput"
              v-model="description"
              maxlength="1000"
              rows="4"
              :placeholder="t('create.field.description.placeholder')"
              :class="[
                'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition resize-none placeholder:text-neutral-400',
                fieldErrors.description
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-neutral-200 focus:ring-pink-700 dark:focus:ring-pink-600',
              ]"
            />
            <p v-if="fieldErrors.description" class="mt-1 text-xs text-red-600">{{ fieldErrors.description }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.link') }}</label>
            <div class="relative">
              <PinovaIcon name="link" class="absolute left-3.5 top-1/2 -translate-y-1/2 text-neutral-400 text-lg" />
              <input
                ref="linkInput"
                v-model="link"
                type="url"
                :placeholder="t('create.field.link.placeholder')"
                :class="[
                  'w-full pl-11 pr-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition placeholder:text-neutral-400',
                  fieldErrors.link
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-neutral-200 focus:ring-pink-700 dark:focus:ring-pink-600',
                ]"
              />
            </div>
            <p v-if="fieldErrors.link" class="mt-1 text-xs text-red-600">{{ fieldErrors.link }}</p>
          </div>

          <div class="relative z-40 isolate">
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.category') }}</label>
            <div ref="categoryAnchorRef" class="relative">
              <input
                ref="categoryInput"
                v-model="categorySearch"
                data-testid="create-pin-category"
                type="text"
                :placeholder="t('create.field.category.placeholder')"
                :class="[
                  'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition placeholder:text-neutral-400',
                  fieldErrors.topic
                    ? 'border-red-400 focus:ring-red-400'
                    : 'border-neutral-200 focus:ring-pink-700 dark:focus:ring-pink-600',
                ]"
                @focus="showCategoryDropdown = true"
              />
              <button
                type="button"
                class="absolute right-2.5 top-1/2 -translate-y-1/2 w-7 h-7 rounded-full hover:bg-neutral-100 flex items-center justify-center"
                aria-haspopup="listbox"
                :aria-expanded="showCategoryDropdown"
                @click="showCategoryDropdown = !showCategoryDropdown"
              >
                <PinovaIcon name="expand_more" class="text-neutral-500" />
              </button>
            </div>
            <Teleport to="body">
              <div
                v-if="showCategoryDropdown"
                ref="categoryFloatingRef"
                class="bg-white border border-neutral-200 rounded-xl shadow-lg max-h-56 overflow-y-auto dark:bg-neutral-900 dark:border-neutral-800"
                role="listbox"
                :style="{ ...categoryFloatingStyles, zIndex: 400 }"
              >
                <button
                  v-for="topicItem in filteredTopics"
                  :key="topicItem.originalName"
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 flex items-center gap-2"
                  @click="selectCategory(topicItem)"
                >
                  <PinovaIcon :name="topicItem.icon || 'category'" class="text-base text-neutral-500 dark:text-neutral-400" />
                  <span>{{ topicItem.name }}</span>
                </button>
                <div
                  v-if="filteredTopics.length === 0 && !categorySearch.trim()"
                  class="px-3 py-3 text-xs text-neutral-500 dark:text-neutral-400"
                >
                  {{ t('create.field.category.loading') }}
                </div>
                <button
                  v-if="categorySearch.trim() && !resolvedTopics.some((item) => item.name === categorySearch.trim() || item.originalName === categorySearch.trim())"
                  type="button"
                  class="w-full text-left px-3 py-2 text-sm font-medium text-pink-700 hover:bg-pink-50 dark:hover:bg-pink-950/40"
                  @click="selectCategory({ name: categorySearch.trim(), originalName: categorySearch.trim() })"
                >
                  + {{ categorySearch.trim() }}
                </button>
              </div>
            </Teleport>
            <p v-if="fieldErrors.topic" class="mt-1 text-xs text-red-600">{{ fieldErrors.topic }}</p>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-2">{{ t('create.field.publicTags') }}</label>
            <input
              ref="publicTagsInputRef"
              v-model="publicTagsInput"
              type="text"
              :placeholder="t('create.field.publicTags.placeholder')"
              :class="[
                'w-full px-4 py-3 rounded-xl border text-sm focus:outline-none focus:ring-2 focus:border-transparent transition placeholder:text-neutral-400',
                fieldErrors.public_tags_input
                  ? 'border-red-400 focus:ring-red-400'
                  : 'border-neutral-200 focus:ring-pink-700 dark:focus:ring-pink-600',
              ]"
            />
            <p v-if="fieldErrors.public_tags_input" class="mt-1 text-xs text-red-600">
              {{ fieldErrors.public_tags_input }}
            </p>
          </div>
          </template>

          <template v-else>
          <div class="pt-4 border-t border-neutral-100">
            <div class="flex items-center justify-between mb-2">
              <label class="block text-sm font-medium text-neutral-700">{{ t('create.field.boards') }}</label>
              <span v-if="boardsLoading" class="text-xs text-neutral-400">{{ t('common.loading') }}</span>
            </div>
            <div v-if="myBoards.length === 0" class="text-xs text-neutral-500">
              {{ t('create.field.boards.empty') }}
            </div>
            <div v-else class="flex flex-wrap gap-2">
              <button
                v-for="board in myBoards"
                :key="board.id"
                type="button"
                class="px-3 py-1.5 rounded-full text-xs border transition"
                :class="selectedBoardIds.includes(board.id)
                  ? 'bg-pink-50 border-pink-300 text-pink-700'
                  : 'bg-white border-neutral-200 text-neutral-600 hover:border-neutral-300'"
                @click="toggleBoardSelection(board.id)"
              >
                {{ board.name }}
              </button>
            </div>
          </div>

          <!-- Visibilité / Mode privé -->
          <div class="pt-4 border-t border-neutral-100">
            <label class="block text-sm font-medium text-neutral-700 mb-3">
              {{ t('create.visibility.label') }}
            </label>
            <div class="grid grid-cols-3 gap-2">
              <button
                v-for="option in [
                  { id: 'public', label: t('create.visibility.public'), icon: 'public', desc: t('create.visibility.public.desc') },
                  { id: 'followers', label: t('create.visibility.followers'), icon: 'group', desc: t('create.visibility.followers.desc') },
                  { id: 'private', label: t('create.visibility.private'), icon: 'lock', desc: t('create.visibility.private.desc') },
                ]"
                :key="option.id"
                type="button"
                class="px-3 py-3 rounded-xl border-2 text-left transition-all"
                :class="visibility === option.id
                  ? 'border-pink-700 dark:border-pink-600 bg-pink-50/40'
                  : 'border-neutral-200 hover:border-neutral-300'"
                @click="setPinVisibility(option.id as 'public' | 'followers' | 'private')"
              >
                <div class="flex items-center gap-1.5 mb-0.5">
                  <PinovaIcon :name="option.icon" class="text-base" :class="visibility === option.id ? 'text-pink-700' : 'text-neutral-500'" />
                  <span
                    class="text-xs font-bold"
                    :class="visibility === option.id ? 'text-pink-700' : 'text-neutral-700'"
                  >{{ option.label }}</span>
                </div>
                <p class="text-[10px] text-neutral-500 leading-tight">{{ option.desc }}</p>
              </button>
            </div>
          </div>

          <!-- Story 24h -->
          <div class="pt-4 border-t border-neutral-100">
            <label class="flex items-start gap-3 cursor-pointer">
              <input
                v-model="isStory"
                type="checkbox"
                class="mt-1 rounded border-neutral-300 text-pink-700 focus:ring-pink-700 dark:focus:ring-pink-600"
              />
              <div>
                <p class="text-sm font-medium text-neutral-800">{{ t('create.story.title') }}</p>
                <p class="text-xs text-neutral-500">{{ t('create.story.subtitle') }}</p>
              </div>
            </label>
          </div>

          <!-- Publication planifiée (Pro) -->
          <div v-if="canSchedulePublish" class="pt-4 border-t border-neutral-100">
            <label class="block text-sm font-medium text-neutral-700 mb-1">{{ t('create.schedule.title') }}</label>
            <p class="text-xs text-neutral-500 mb-2">{{ t('create.schedule.subtitle') }}</p>
            <input
              v-model="scheduledPublishLocal"
              type="datetime-local"
              class="w-full max-w-xs px-3 py-2 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600"
            />
          </div>

          <div class="pt-4 border-t border-neutral-100">
            <PrivateTags v-if="canUsePrivateTags" v-model="privateTags" />
            <div
              v-else
              class="rounded-xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800 leading-relaxed"
            >
              {{ t('create.privateTags.upgradeRequired') }}
              <a
                href="/premium"
                class="ml-1 font-semibold underline hover:no-underline"
                @click.prevent="navigateFromCreateLayer('/premium')"
              >
                {{ t('create.privateTags.upgradeCta') }}
              </a>
            </div>
          </div>

          <div class="pt-4 border-t border-neutral-100">
            <div class="flex items-start gap-3 text-sm text-neutral-500 bg-blue-50/40 border border-blue-100 rounded-xl px-4 py-3">
              <PinovaIcon name="shield" class="text-lg text-blue-600" />
              <p class="text-xs leading-relaxed">
                <span v-html="createNoTrackingSafeHtml"></span>
                <a
                  href="/premium"
                  class="text-blue-600 font-semibold hover:underline ml-1"
                  @click.prevent="navigateFromCreateLayer('/premium')"
                >{{ t('create.noTracking.learnMore') }}</a>
              </p>
            </div>
          </div>

          <button
            type="button"
            class="text-sm font-semibold text-neutral-600 hover:text-neutral-900 pt-2"
            @click="goStep1"
          >
            ← {{ t('create.step.back') }}
          </button>
          </template>
        </div>
      </div>
    </div>
  </div>

  <!-- Modal date de naissance : ouvert auto si manquante ; bloque la
       publication tant qu'elle n'est pas saisie. -->
  <BirthDateRequiredModal
    v-model="showBirthDateModal"
    required
    @saved="() => { /* refresh déjà géré dans le composant via fetchCurrentUser */ }"
  />
  </div>

</template>

<style scoped>
.pin-m-pick-card {
  position: relative;
  transition: transform 0.18s ease, opacity 0.18s ease;
}
.pin-m-pick-card:active {
  transform: scale(0.98);
  opacity: 0.88;
}
.pin-m-pick-primary {
  background: linear-gradient(135deg, #ec4899 0%, #db2777 48%, #a855f7 100%);
}
.pin-m-glass {
  border: 1px solid rgb(255 255 255 / 0.09);
  border-radius: 1.5rem;
  background: rgb(12 8 18 / 0.82);
  padding: 1.25rem;
  backdrop-filter: blur(18px);
  box-shadow: inset 0 1px 0 rgb(255 255 255 / 0.06);
}
</style>
