<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { useI18n } from '../i18n'
import api from '../api'
import { displayInitials } from '../utils/displayInitials'
import { useDataSaver } from '../composables/useDataSaver'
import BillingInvoicesSkeleton from '../components/BillingInvoicesSkeleton.vue'
import BillingReceiptPdfModal from '../components/BillingReceiptPdfModal.vue'
import UserSearchPickModal from '../components/UserSearchPickModal.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import type { DataSaverOverride } from '../composables/useDataSaver'
import { useAppModal } from '../composables/useAppModal'
import { useBillingReceiptPdfModal } from '../composables/useBillingReceiptPdfModal'
import { isVerifiedAdultFromBirthDate } from '../composables/useModeration'
import { useAppearance } from '../composables/useAppearance'
import { usePwaContext } from '../composables/usePwaContext'
import { reloadPwaApplication } from '../utils/pwaAppReload'
import { requestPwaInstallModalOpen } from '../utils/pwaInstallBridge'
import {
  activateWebPushNotifications,
  deactivateWebPushNotifications,
  isWebPushActiveForUi,
  isWebPushSupported,
  type WebPushActivateError,
} from '../utils/webPushClient'

const SETTINGS_NAV_ROWS: { id: string; icon: string; labelKey: string }[] = [
  { id: 'settings-profile', icon: 'person', labelKey: 'settings.nav.profile' },
  { id: 'settings-notifications', icon: 'notifications', labelKey: 'settings.nav.notifications' },
  { id: 'settings-privacy', icon: 'lock', labelKey: 'settings.nav.privacy' },
  { id: 'settings-appearance', icon: 'dark_mode', labelKey: 'settings.nav.appearance' },
  { id: 'settings-pwa-install', icon: 'install_mobile', labelKey: 'settings.nav.pwaInstall' },
  { id: 'settings-blocked', icon: 'block', labelKey: 'settings.nav.blocked' },
  { id: 'settings-access', icon: 'accessibility_new', labelKey: 'settings.nav.access' },
  { id: 'settings-tips', icon: 'payments', labelKey: 'settings.nav.tips' },
  { id: 'settings-seats', icon: 'group', labelKey: 'settings.nav.seats' },
  { id: 'settings-subscription', icon: 'workspace_premium', labelKey: 'settings.nav.subscription' },
  { id: 'settings-support', icon: 'support_agent', labelKey: 'settings.nav.support' },
  { id: 'settings-password', icon: 'key', labelKey: 'settings.nav.password' },
  { id: 'settings-danger', icon: 'warning', labelKey: 'settings.nav.danger' },
]

const router = useRouter()
const route = useRoute()
const { currentUser, updateProfile, logout, manageSubscription, fetchSupportTickets, createSupportTicket, fetchSubscriptionInvoices, fetchSubscriptionInvoiceReceipt, fetchCurrentUser } =
  useAuth()
const { unblockUser } = usePins()
const { t, currentLang } = useI18n()
const { mode: appearanceMode, setMode: setAppearanceMode } = useAppearance()
const { isStandalone } = usePwaContext()

async function onReloadPwaFromSettings() {
  await reloadPwaApplication()
}

function openPwaInstallGuideFromSettings() {
  requestPwaInstallModalOpen()
}
const { showAlert, showPrompt } = useAppModal()
const {
  override: dataSaverOverride,
  isLowDataMode,
  setOverride: setDataSaverOverride,
} = useDataSaver()

type BlockedRow = { id: number; username: string; display_name?: string; displayName?: string }
const blockedRows = ref<BlockedRow[]>([])
const blockedLoading = ref(false)

async function loadBlockedList() {
  if (!currentUser.value) return
  blockedLoading.value = true
  try {
    const res = await api.get('blocks/', { params: { page_size: 100 } })
    const raw = res.data?.results ?? res.data ?? []
    blockedRows.value = Array.isArray(raw) ? raw : []
  } catch {
    blockedRows.value = []
  } finally {
    blockedLoading.value = false
  }
}

async function handleUnblockUser(row: BlockedRow) {
  try {
    await unblockUser(row.id)
    await showAlert(t('settings.blocked.unblocked'), { variant: 'success' })
    await loadBlockedList()
    await fetchCurrentUser({ silent: true })
  } catch {
    await showAlert(t('settings.blocked.unblockError'), { variant: 'danger', title: t('modal.errorTitle') })
  }
}

const displayName = ref('')
const username = ref('')
const bio = ref('')
const email = ref('')
const birthDate = ref('')
const oldPassword = ref('')
const newPassword = ref('')
const confirmNewPassword = ref('')
const avatarFile = ref<File | null>(null)
const avatarPreview = ref<string | null>(null)
const fileInput = ref<HTMLInputElement | null>(null)
const saved = ref(false)
const saving = ref(false)
const passwordChanging = ref(false)
const passwordSaved = ref(false)
const passwordError = ref('')
const needsPasswordSetup = computed(
  () => !!currentUser.value && currentUser.value.hasUsablePassword === false,
)
const initialPasswordModalOpen = ref(false)
const initialPw1 = ref('')
const initialPw2 = ref('')
const initialPwBusy = ref(false)
const initialPwError = ref('')
const initialPwAutoOpened = ref(false)
const tipsEnabled = ref(false)
const tipsUrl = ref('')
const tipsSaving = ref(false)
const tipsSaved = ref(false)
const preferredCurrency = ref('XOF')
const detectedCountryCode = ref('')
const supportedCurrencies = ref<string[]>([])
const webNotificationsLoading = ref(false)
const webNotificationsEnabled = ref(false)
const webNotificationsError = ref('')
const notificationsFollowers = ref(true)
const notificationsSaves = ref(true)
const notificationsRecommendations = ref(false)
const notificationsSaving = ref(false)
const notificationsSaved = ref(false)
const privateProfile = ref(false)
const discoverableProfile = ref(true)
const privacySaving = ref(false)
const privacySaved = ref(false)
const digestWeekly = ref(true)
const digestSaving = ref(false)
const digestSaved = ref(false)
type SensitiveMediaViewerPref = 'blur' | 'show' | 'hide'

const sensitiveMediaViewerPref = ref<SensitiveMediaViewerPref>('blur')
const sensitiveMediaPrefsSaving = ref(false)
const sensitiveMediaPrefsSaved = ref(false)
const subscriptionActionPending = ref(false)
const subscriptionActionMessage = ref('')
const billingInvoices = ref<
  {
    id: number
    fedapay_transaction_id: string
    created_at: string
    plan: string
    billing_cycle: string
    amount_display: number
    currency_iso: string
    promo_bundle?: string
    status: string
    checkout_url?: string
    invoice_url?: string
  }[]
>([])
const billingInvoicesLoading = ref(false)
const billingReceiptLoadingId = ref<number | null>(null)
const { receiptPdfOpen, receiptPdfUrl, closeReceiptPdf, openReceiptPdf } = useBillingReceiptPdfModal()
const supportSubject = ref('')
const supportMessage = ref('')
const supportSubmitting = ref(false)
const supportTickets = ref<any[]>([])

type SeatHubIncoming = {
  id: string
  owner_username: string
  owner_display_name: string
  expires_at: string
}

type SeatHubResp =
  | { role: 'none'; seat_bundle: string; incoming_invitations: SeatHubIncoming[] }
  | {
      role: 'member'
      sponsor_username: string | null
      sponsor_display_name: string | null
      seat_plan: string
      incoming_invitations: SeatHubIncoming[]
    }
  | {
      role: 'owner'
      seat_bundle: string
      max_invitees: number
      used_slots: number
      members: { username: string; display_name: string; joined_at: string }[]
      pending_invitations: { id: string; invitee_username: string; expires_at: string; created_at: string }[]
      incoming_invitations: SeatHubIncoming[]
    }

const seatHubLoading = ref(false)
const seatHub = ref<SeatHubResp | null>(null)
const seatBusy = ref(false)
const seatInviteSearchOpen = ref(false)
const seatInviteDisambiguation = ref<Array<{ username: string; display_name: string }>>([])

watch(seatInviteSearchOpen, (open) => {
  if (!open) seatInviteDisambiguation.value = []
})

const accountDeletionBusy = ref(false)

const scheduledAccountDeletion = computed(() => currentUser.value?.subscription?.accountScheduledDeletionAt || null)

const scheduledAccountDeletionLabel = computed(() => {
  const raw = scheduledAccountDeletion.value
  if (!raw) return ''
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return String(raw)
  try {
    return new Intl.DateTimeFormat(currentLang.value || 'fr', { dateStyle: 'long', timeStyle: 'short' }).format(d)
  } catch {
    return d.toLocaleString()
  }
})

const currentPlan = ref<'free' | 'plus' | 'pro'>('free')

const isVerifiedAdultForSensitiveSettings = computed(() => isVerifiedAdultFromBirthDate(currentUser.value?.birthDate))

const canShowUnblurredSensitiveOption = computed(() => currentPlan.value === 'plus' || currentPlan.value === 'pro')

function syncSensitiveMediaFormFromUser() {
  const u = currentUser.value
  if (!u || !isVerifiedAdultForSensitiveSettings.value) {
    sensitiveMediaViewerPref.value = 'blur'
    return
  }
  if (u.subscription?.hideSensitivePins) {
    sensitiveMediaViewerPref.value = 'hide'
    return
  }
  const paid = u.subscription?.plan === 'plus' || u.subscription?.plan === 'pro'
  if (u.subscription?.sensitiveMediaBlurByDefault === false && paid) {
    sensitiveMediaViewerPref.value = 'show'
  } else {
    sensitiveMediaViewerPref.value = 'blur'
  }
}

const subscriptionRenewalLabel = computed(() => {
  const raw = currentUser.value?.subscription?.renewalAt
  if (!raw) return '—'
  const d = new Date(String(raw))
  if (Number.isNaN(d.getTime())) return String(raw)
  try {
    return new Intl.DateTimeFormat(currentLang.value || 'fr', {
      dateStyle: 'long',
      timeStyle: 'short',
    }).format(d)
  } catch {
    return d.toLocaleString()
  }
})

const subscriptionScheduleHint = computed(() => {
  const sp = currentUser.value?.subscription?.scheduledPlan
  if (!sp) return ''
  if (sp === 'plus') return t('settings.subscription.scheduledPlus')
  if (sp === 'free') return t('settings.subscription.scheduledFree')
  return ''
})

const currencyOptionLabel = (currency: string) => {
  try {
    const parts = new Intl.NumberFormat(currentLang.value || 'fr', {
      style: 'currency',
      currency,
    }).formatToParts(1)
    const symbol = parts.find((p) => p.type === 'currency')?.value
    return symbol ? `${currency} (${symbol})` : currency
  } catch (_) {
    return currency
  }
}

const syncWebNotificationState = async () => {
  try {
    webNotificationsEnabled.value = await isWebPushActiveForUi(api)
  } catch {
    webNotificationsEnabled.value = false
  }
}

const activateWebNotifications = async () => {
  if (webNotificationsLoading.value) return
  if (!isWebPushSupported()) {
    webNotificationsError.value = t('settings.notifications.web.errorUnsupported')
    return
  }
  webNotificationsLoading.value = true
  webNotificationsError.value = ''
  const result = await activateWebPushNotifications(api)
  webNotificationsLoading.value = false
  if (result.ok) {
    webNotificationsEnabled.value = true
    return
  }
  webNotificationsEnabled.value = false
  const map: Record<WebPushActivateError, string> = {
    unsupported: t('settings.notifications.web.errorUnsupported'),
    denied: t('settings.notifications.web.errorDenied'),
    unavailable: t('settings.notifications.web.errorUnavailable'),
    generic: t('settings.notifications.web.errorGeneric'),
  }
  webNotificationsError.value = map[result.error]
}

const deactivateWebNotifications = async () => {
  if (webNotificationsLoading.value) return
  webNotificationsLoading.value = true
  webNotificationsError.value = ''
  const { ok } = await deactivateWebPushNotifications(api)
  webNotificationsLoading.value = false
  if (!ok) {
    webNotificationsError.value = t('settings.notifications.web.errorDisableFailed')
    return
  }
  await syncWebNotificationState()
}

onMounted(() => {
  if (currentUser.value) {
    displayName.value = currentUser.value.displayName
    username.value = currentUser.value.username
    bio.value = currentUser.value.bio
    email.value = currentUser.value.email
    birthDate.value = currentUser.value.birthDate ? String(currentUser.value.birthDate).slice(0, 10) : ''
    avatarPreview.value = currentUser.value.avatarUrl || null
    currentPlan.value = currentUser.value.subscription?.plan || 'free'
    tipsEnabled.value = currentUser.value.subscription?.tipsEnabled ?? false
    tipsUrl.value = currentUser.value.subscription?.tipsUrl || ''
    preferredCurrency.value = currentUser.value.preferredCurrency || 'XOF'
    detectedCountryCode.value = currentUser.value.countryCode || ''
    notificationsFollowers.value = currentUser.value.notificationsFollowers ?? true
    notificationsSaves.value = currentUser.value.notificationsSaves ?? true
    notificationsRecommendations.value = currentUser.value.notificationsRecommendations ?? false
    privateProfile.value = currentUser.value.privateProfile ?? false
    discoverableProfile.value = currentUser.value.discoverableProfile ?? true
    digestWeekly.value = currentUser.value.subscription?.digestCreatorWeekly ?? true
  }
  api.get('subscription/currencies/')
    .then((response) => {
      supportedCurrencies.value = response.data?.supported || []
      if (!currentUser.value?.preferredCurrency && response.data?.selected) {
        preferredCurrency.value = String(response.data.selected)
      }
      if (!detectedCountryCode.value && response.data?.country_code) {
        detectedCountryCode.value = String(response.data.country_code)
      }
    })
    .catch(() => undefined)
  syncWebNotificationState().catch(() => undefined)
  void loadSupportTickets()
  void loadBillingInvoices()
  void loadSeatHub()
  void loadBlockedList()
})

watch(
  () => currentUser.value?.id,
  () => {
    syncWebNotificationState().catch(() => undefined)
  },
)

watch(
  () =>
    [
      currentUser.value?.subscription?.plan,
      currentUser.value?.subscription?.sensitiveMediaBlurByDefault,
      currentUser.value?.subscription?.hideSensitivePins,
      currentUser.value?.birthDate,
    ] as const,
  () => {
    syncSensitiveMediaFormFromUser()
  },
  { immediate: true },
)

const loadSeatHub = async () => {
  if (!currentUser.value) return
  seatHubLoading.value = true
  try {
    const res = await api.get('subscription/seats/')
    seatHub.value = res.data as SeatHubResp
  } catch {
    seatHub.value = null
  } finally {
    seatHubLoading.value = false
  }
}

const sendSeatInvite = async (username: string) => {
  const uname = username.trim().replace(/^@/, '')
  if (uname.length < 2 || seatBusy.value) return
  seatBusy.value = true
  try {
    await api.post('subscription/seats/invites/', { username: uname })
    seatInviteSearchOpen.value = false
    seatInviteDisambiguation.value = []
    await showAlert(t('settings.seats.inviteSentOk'), {
      title: t('settings.seats.inviteCreatedTitle'),
      variant: 'success',
    })
    await loadSeatHub()
    await fetchCurrentUser({ silent: true })
  } catch (err: unknown) {
    const ax = err as {
      response?: {
        data?: {
          code?: string
          candidates?: Array<{ username: string; display_name: string }>
        }
      }
    }
    const d = ax.response?.data
    if (d?.code === 'ambiguous_display_name' && Array.isArray(d.candidates) && d.candidates.length) {
      seatInviteDisambiguation.value = d.candidates
    } else {
      await showAlert(t('settings.seats.error'), { variant: 'danger', title: t('modal.errorTitle') })
    }
  } finally {
    seatBusy.value = false
  }
}

function onSeatInviteUserPick(username: string) {
  void sendSeatInvite(username)
}

const revokeSeatInviteOutgoing = async (id: string) => {
  if (seatBusy.value) return
  seatBusy.value = true
  try {
    await api.delete(`subscription/seats/invites/${encodeURIComponent(id)}/`)
    await loadSeatHub()
  } catch {
    await showAlert(t('settings.seats.error'), { variant: 'danger' })
  } finally {
    seatBusy.value = false
  }
}

const removeSeatMember = async (username: string) => {
  if (seatBusy.value) return
  seatBusy.value = true
  try {
    await api.delete(`subscription/seats/members/${encodeURIComponent(username)}/`)
    await loadSeatHub()
    await fetchCurrentUser({ silent: true })
  } catch {
    await showAlert(t('settings.seats.error'), { variant: 'danger' })
  } finally {
    seatBusy.value = false
  }
}

const respondSeatInvite = async (id: string, action: 'accept' | 'decline') => {
  if (seatBusy.value) return
  seatBusy.value = true
  try {
    await api.post(`subscription/seats/invites/${encodeURIComponent(id)}/`, { action })
    await loadSeatHub()
    await fetchCurrentUser({ silent: true })
  } catch {
    await showAlert(t('settings.seats.error'), { variant: 'danger' })
  } finally {
    seatBusy.value = false
  }
}

const leaveSeatGroup = async () => {
  if (seatBusy.value) return
  seatBusy.value = true
  try {
    await api.post('subscription/seats/leave/')
    await loadSeatHub()
    await fetchCurrentUser({ silent: true })
    currentPlan.value = currentUser.value?.subscription?.plan || 'free'
  } catch {
    await showAlert(t('settings.seats.error'), { variant: 'danger' })
  } finally {
    seatBusy.value = false
  }
}

const revokeAllSeatGroup = async () => {
  if (seatBusy.value) return
  const typed = await showPrompt({
    message: t('settings.seats.revokeAllPrompt'),
    title: t('settings.seats.revokeAll'),
    placeholder: 'REVOQUER',
    variant: 'warning',
  })
  const tconfirm = String(typed ?? '').trim().toUpperCase()
  if (tconfirm !== 'REVOQUER' && tconfirm !== 'REVOKE') return
  seatBusy.value = true
  try {
    await api.post('subscription/seats/revoke-all/')
    await loadSeatHub()
    await fetchCurrentUser({ silent: true })
    currentPlan.value = currentUser.value?.subscription?.plan || 'free'
  } catch {
    await showAlert(t('settings.seats.error'), { variant: 'danger' })
  } finally {
    seatBusy.value = false
  }
}

const handleFileChange = (e: Event) => {
  const file = (e.target as HTMLInputElement).files?.[0]
  if (file) {
    avatarFile.value = file
    avatarPreview.value = URL.createObjectURL(file)
  }
}

const triggerFileInput = () => {
  fileInput.value?.click()
}

const handleSave = async () => {
  saving.value = true
  try {
    await updateProfile({
      displayName: displayName.value,
      bio: bio.value,
      email: email.value,
      avatar: avatarFile.value || undefined,
      preferredLanguage: currentLang.value,
      preferredCurrency: preferredCurrency.value,
      birthDate: birthDate.value.trim() || undefined,
    })
    await fetchCurrentUser({ silent: true })
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
    currentPlan.value = currentUser.value?.subscription?.plan || 'free'
  } catch (err) {
    console.error('Failed to update profile:', err)
  } finally {
    saving.value = false
  }
}

const handlePasswordChange = async () => {
  passwordError.value = ''
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = t('settings.password.error.mismatch')
    return
  }

  passwordChanging.value = true
  try {
    const apiMod = (await import('../api')).default
    await apiMod.post('auth/password/change/', {
      old_password: oldPassword.value,
      new_password1: newPassword.value,
      new_password2: confirmNewPassword.value,
    })
    passwordSaved.value = true
    oldPassword.value = ''
    newPassword.value = ''
    confirmNewPassword.value = ''
    setTimeout(() => (passwordSaved.value = false), 3000)
  } catch (err: any) {
    console.error('Failed to change password:', err)
    passwordError.value = err.response?.data?.non_field_errors?.[0] || t('settings.password.error.generic')
  } finally {
    passwordChanging.value = false
  }
}

function openInitialPasswordModal() {
  initialPwError.value = ''
  initialPasswordModalOpen.value = true
}

function closeInitialPasswordModal() {
  initialPasswordModalOpen.value = false
  initialPwError.value = ''
}

const submitInitialPassword = async () => {
  initialPwError.value = ''
  if (initialPw1.value !== initialPw2.value) {
    initialPwError.value = t('settings.password.error.mismatch')
    return
  }
  initialPwBusy.value = true
  try {
    const apiMod = (await import('../api')).default
    await apiMod.post('me/set-password/', {
      new_password1: initialPw1.value,
      new_password2: initialPw2.value,
    })
    initialPw1.value = ''
    initialPw2.value = ''
    closeInitialPasswordModal()
    await fetchCurrentUser({ silent: true })
    await showAlert(t('settings.password.saved'), { variant: 'success' })
  } catch (err: unknown) {
    const ax = err as { response?: { data?: Record<string, unknown> } }
    const d = ax.response?.data
    const np1 = d?.new_password1
    const fromField = Array.isArray(np1) && typeof np1[0] === 'string' ? np1[0] : ''
    const detail = d?.detail
    const fromDetail =
      typeof detail === 'string'
        ? detail
        : Array.isArray(detail) && typeof detail[0] === 'string'
          ? detail[0]
          : ''
    const nfe = d?.non_field_errors
    const fromNfe = Array.isArray(nfe) && typeof nfe[0] === 'string' ? nfe[0] : ''
    initialPwError.value =
      fromField || fromDetail || fromNfe || t('settings.password.error.generic')
  } finally {
    initialPwBusy.value = false
  }
}

const persistTipsSettings = async () => {
  tipsSaving.value = true
  try {
    await updateProfile({
      tipsEnabled: currentPlan.value === 'pro' ? tipsEnabled.value : false,
      tipsUrl: currentPlan.value === 'pro' ? tipsUrl.value : '',
    })
    tipsEnabled.value = currentUser.value?.subscription?.tipsEnabled ?? false
    tipsUrl.value = currentUser.value?.subscription?.tipsUrl || ''
    tipsSaved.value = true
    setTimeout(() => (tipsSaved.value = false), 2500)
  } catch (err) {
    console.error('Failed to save tips settings:', err)
  } finally {
    tipsSaving.value = false
  }
}

const persistNotificationSettings = async () => {
  notificationsSaving.value = true
  try {
    await updateProfile({
      notificationsFollowers: notificationsFollowers.value,
      notificationsSaves: notificationsSaves.value,
      notificationsRecommendations: notificationsRecommendations.value,
    })
    notificationsSaved.value = true
    setTimeout(() => (notificationsSaved.value = false), 2500)
  } finally {
    notificationsSaving.value = false
  }
}

const persistPrivacySettings = async () => {
  privacySaving.value = true
  try {
    await updateProfile({
      privateProfile: privateProfile.value,
      discoverableProfile: discoverableProfile.value,
    })
    privacySaved.value = true
    setTimeout(() => (privacySaved.value = false), 2500)
  } finally {
    privacySaving.value = false
  }
}

const persistDigestWeekly = async () => {
  if (currentPlan.value !== 'pro') return
  digestSaving.value = true
  try {
    await updateProfile({ notificationsDigestCreatorWeekly: digestWeekly.value })
    digestWeekly.value = currentUser.value?.subscription?.digestCreatorWeekly ?? digestWeekly.value
    digestSaved.value = true
    setTimeout(() => (digestSaved.value = false), 2500)
  } catch {
    void 0
  } finally {
    digestSaving.value = false
  }
}

const persistSensitiveMediaPreferences = async () => {
  if (!currentUser.value || !isVerifiedAdultForSensitiveSettings.value) return
  if (sensitiveMediaViewerPref.value === 'show' && !canShowUnblurredSensitiveOption.value) {
    await showAlert(t('settings.access.sensitiveMedia.needPlus'), { variant: 'warning' })
    syncSensitiveMediaFormFromUser()
    return
  }
  sensitiveMediaPrefsSaving.value = true
  try {
    const hide = sensitiveMediaViewerPref.value === 'hide'
    const blur = sensitiveMediaViewerPref.value !== 'show'
    await updateProfile({
      hideSensitivePins: hide,
      sensitiveMediaBlurByDefault: hide ? true : blur,
    })
    sensitiveMediaPrefsSaved.value = true
    setTimeout(() => (sensitiveMediaPrefsSaved.value = false), 2500)
  } catch {
    void 0
  } finally {
    sensitiveMediaPrefsSaving.value = false
  }
}

const handleDataSaverMode = (mode: DataSaverOverride) => {
  setDataSaverOverride(mode)
}

const handleCancelAtPeriodEnd = async () => {
  subscriptionActionPending.value = true
  subscriptionActionMessage.value = ''
  try {
    await manageSubscription('cancel')
    currentPlan.value = currentUser.value?.subscription?.plan || currentPlan.value
    subscriptionActionMessage.value = t('settings.subscription.cancelScheduled')
  } catch {
    subscriptionActionMessage.value = t('settings.subscription.error')
  } finally {
    subscriptionActionPending.value = false
  }
}

const handleReactivateSubscription = async () => {
  subscriptionActionPending.value = true
  subscriptionActionMessage.value = ''
  try {
    await manageSubscription('reactivate')
    currentPlan.value = currentUser.value?.subscription?.plan || currentPlan.value
    subscriptionActionMessage.value = t('settings.subscription.reactivated')
  } catch {
    subscriptionActionMessage.value = t('settings.subscription.error')
  } finally {
    subscriptionActionPending.value = false
  }
}

const loadBillingInvoices = async () => {
  if (!currentUser.value) return
  billingInvoicesLoading.value = true
  try {
    billingInvoices.value = await fetchSubscriptionInvoices()
  } catch {
    billingInvoices.value = []
  } finally {
    billingInvoicesLoading.value = false
  }
}

const handleSchedulePlusAtRenewal = async () => {
  subscriptionActionPending.value = true
  subscriptionActionMessage.value = ''
  try {
    await manageSubscription('schedule_plan_change', { target_plan: 'plus' })
    currentPlan.value = currentUser.value?.subscription?.plan || currentPlan.value
    subscriptionActionMessage.value = t('settings.subscription.schedulePlusOk')
  } catch {
    subscriptionActionMessage.value = t('settings.subscription.error')
  } finally {
    subscriptionActionPending.value = false
  }
}

const handleClearPlannedChange = async () => {
  subscriptionActionPending.value = true
  subscriptionActionMessage.value = ''
  try {
    await manageSubscription('cancel_schedule')
    currentPlan.value = currentUser.value?.subscription?.plan || currentPlan.value
    subscriptionActionMessage.value = t('settings.subscription.scheduleCleared')
  } catch {
    subscriptionActionMessage.value = t('settings.subscription.error')
  } finally {
    subscriptionActionPending.value = false
  }
}

const formatInvoiceWhen = (iso: string) => {
  const d = new Date(iso)
  if (Number.isNaN(d.getTime())) return iso
  try {
    return new Intl.DateTimeFormat(currentLang.value || 'fr', { dateStyle: 'medium', timeStyle: 'short' }).format(d)
  } catch {
    return d.toLocaleString()
  }
}

const invoiceAmountLabel = (row: { amount_display: number; currency_iso: string }) => {
  try {
    return new Intl.NumberFormat(currentLang.value || 'fr', {
      style: 'currency',
      currency: row.currency_iso,
      maximumFractionDigits: 2,
    }).format(Number(row.amount_display))
  } catch {
    return `${row.amount_display} ${row.currency_iso}`
  }
}

async function fetchBillingReceiptFromApi(inv: { id: number }) {
  billingReceiptLoadingId.value = inv.id
  try {
    const data = await fetchSubscriptionInvoiceReceipt(inv.id)
    const url = data?.invoice_url
    if (url) {
      const ix = billingInvoices.value.findIndex((x) => x.id === inv.id)
      const prev = ix >= 0 ? billingInvoices.value[ix] : undefined
      if (prev) {
        billingInvoices.value[ix] = { ...prev, invoice_url: url }
      }
      openReceiptPdf(url)
    } else {
      await showAlert(data?.detail ? String(data.detail) : t('billing.fetchReceiptUnavailable'), {
        variant: 'warning',
      })
    }
  } catch {
    await showAlert(t('billing.fetchReceiptError'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    billingReceiptLoadingId.value = null
  }
}

function viewBillingReceipt(inv: { id: number; invoice_url?: string }) {
  if (inv.invoice_url) {
    openReceiptPdf(inv.invoice_url)
    return
  }
  void fetchBillingReceiptFromApi(inv)
}

const loadSupportTickets = async () => {
  if (!currentUser.value) return
  try {
    supportTickets.value = await fetchSupportTickets()
  } catch {
    supportTickets.value = []
  }
}

function supportTicketStatusLabel(status: unknown): string {
  const s = String(status || '').toLowerCase()
  const key =
    s === 'open'
      ? 'settings.support.status.open'
      : s === 'in_progress'
        ? 'settings.support.status.inProgress'
        : s === 'resolved'
          ? 'settings.support.status.resolved'
          : null
  return key ? t(key) : String(status ?? '')
}

function supportTicketPriorityLabel(priority: unknown): string {
  const p = String(priority || '').toLowerCase()
  const key =
    p === 'normal'
      ? 'settings.support.priority.normal'
      : p === 'priority'
        ? 'settings.support.priority.priority'
        : null
  return key ? t(key) : String(priority ?? '')
}

const submitSupportTicket = async () => {
  if (!supportSubject.value.trim() || !supportMessage.value.trim()) return
  supportSubmitting.value = true
  try {
    await createSupportTicket(supportSubject.value.trim(), supportMessage.value.trim())
    supportSubject.value = ''
    supportMessage.value = ''
    await loadSupportTickets()
  } finally {
    supportSubmitting.value = false
  }
}

const handleLogout = async () => {
  await logout()
  router.push('/login')
}

async function requestAccountDeletion() {
  await showAlert(t('settings.danger.delete.warningBody'), {
    variant: 'danger',
    title: t('settings.danger.delete.title'),
  })
  const typed = await showPrompt({
    title: t('settings.danger.delete.promptTitle'),
    message: t('settings.danger.delete.promptMessage'),
    placeholder: 'SUPPRIMER',
    variant: 'danger',
  })
  const normalized = typed?.trim().toUpperCase() || ''
  if (normalized !== 'SUPPRIMER' && normalized !== 'DELETE') return
  accountDeletionBusy.value = true
  try {
    const confirm = normalized === 'DELETE' ? 'DELETE' : 'SUPPRIMER'
    await api.post('me/account-deletion/request/', { confirm })
    await fetchCurrentUser({ silent: true })
    await showAlert(t('settings.danger.delete.scheduledOk'), { variant: 'success' })
  } catch {
    await showAlert(t('settings.danger.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    accountDeletionBusy.value = false
  }
}

async function cancelAccountDeletion() {
  accountDeletionBusy.value = true
  try {
    await api.post('me/account-deletion/cancel/')
    await fetchCurrentUser({ silent: true })
    await showAlert(t('settings.danger.delete.cancelledOk'), { variant: 'success' })
  } catch {
    await showAlert(t('settings.danger.delete.error'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    accountDeletionBusy.value = false
  }
}

const activeSectionId = ref('settings-profile')
/** Après un clic sur un chip : on ne réécrit pas la section active avant cette date (évite de « sauter » pendant le smooth scroll). */
const settingsNavExplicitLockUntil = ref(0)

const settingsNavItems = computed(() =>
  SETTINGS_NAV_ROWS.filter((row) => row.id !== 'settings-seats' || currentUser.value).map((row) => ({
    id: row.id,
    icon: row.icon,
    label: t(row.labelKey),
  })),
)

function scrollToSettingsSection(id: string) {
  activeSectionId.value = id
  settingsNavExplicitLockUntil.value = Date.now() + 1200
  document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'center' })
}

watch(
  () => [needsPasswordSetup.value, route.query.set_password, route.query.add_password] as const,
  () => {
    if (!needsPasswordSetup.value || initialPwAutoOpened.value) return
    const q = route.query.set_password === '1' || route.query.add_password === '1'
    if (!q) return
    initialPwAutoOpened.value = true
    initialPasswordModalOpen.value = true
    void nextTick(() => scrollToSettingsSection('settings-password'))
  },
  { immediate: true },
)

let settingsNavScrollRaf: number | null = null

function refreshSettingsActiveSection() {
  if (typeof window === 'undefined') return
  if (Date.now() < settingsNavExplicitLockUntil.value) return

  const ids = settingsNavItems.value.map((i) => i.id)
  if (!ids.length) return

  const main = document.getElementById('main-content')
  const mainRect = main?.getBoundingClientRect()
  /* Ligne de lecture ~milieu de la zone scrollable (pas le bord haut). */
  const centerY =
    mainRect && mainRect.height > 0
      ? mainRect.top + mainRect.height * 0.42
      : window.innerHeight * 0.42

  let current = ids[0]
  if (!current) return
  for (const sid of ids) {
    const el = document.getElementById(sid)
    if (!el) continue
    const top = el.getBoundingClientRect().top
    if (top <= centerY) current = sid
  }
  if (current && activeSectionId.value !== current) activeSectionId.value = current
}

function scheduleRefreshSettingsActiveSection() {
  if (typeof window === 'undefined') return
  if (settingsNavScrollRaf !== null) return
  settingsNavScrollRaf = window.requestAnimationFrame(() => {
    settingsNavScrollRaf = null
    refreshSettingsActiveSection()
  })
}

function attachSettingsScrollListeners() {
  detachSettingsScrollListeners()
  const h = scheduleRefreshSettingsActiveSection
  window.addEventListener('scroll', h, { passive: true })
  document.getElementById('main-content')?.addEventListener('scroll', h, { passive: true })
}

function detachSettingsScrollListeners() {
  const h = scheduleRefreshSettingsActiveSection
  window.removeEventListener('scroll', h)
  document.getElementById('main-content')?.removeEventListener('scroll', h)
}

function onResizeSettingsNav() {
  attachSettingsScrollListeners()
  scheduleRefreshSettingsActiveSection()
}

onMounted(() => {
  attachSettingsScrollListeners()
  window.addEventListener('resize', onResizeSettingsNav, { passive: true })
  void nextTick(() => scheduleRefreshSettingsActiveSection())
})

onUnmounted(() => {
  detachSettingsScrollListeners()
  window.removeEventListener('resize', onResizeSettingsNav)
  if (settingsNavScrollRaf !== null) {
    cancelAnimationFrame(settingsNavScrollRaf)
    settingsNavScrollRaf = null
  }
})

watch(
  () => settingsNavItems.value.map((i) => i.id).join(','),
  () => scheduleRefreshSettingsActiveSection(),
)
</script>

<template>
  <div
    class="pinova-settings-page max-w-3xl mx-auto w-full min-w-0 overflow-x-clip px-4 sm:px-6 flex flex-col h-full min-h-0 pt-6 sm:pt-10 md:pt-12 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-12 min-h-[min(100dvh,100svh)]"
  >
    <h1 class="text-xl min-[400px]:text-2xl sm:text-3xl font-auth-title font-auth-title--black text-neutral-900 dark:text-neutral-50 mb-2 break-words">{{ t('settings.title') }}</h1>
    <p class="text-sm text-neutral-500 dark:text-neutral-400 mb-5 leading-relaxed">{{ t('settings.subtitle') }}</p>

    <div
      v-if="needsPasswordSetup"
      class="mb-6 rounded-2xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60 px-4 py-4 text-sm text-amber-950 dark:text-amber-100"
    >
      <p class="font-semibold">{{ t('settings.password.socialBannerTitle') }}</p>
      <p class="mt-1 text-xs leading-relaxed opacity-90">{{ t('settings.password.socialBannerBody') }}</p>
      <button
        type="button"
        class="mt-3 app-btn app-btn-sm bg-pink-700 dark:bg-pink-600 text-white border-pink-700 dark:border-pink-600 hover:bg-pink-800 dark:hover:opacity-90"
        @click="openInitialPasswordModal"
      >
        {{ t('settings.password.socialBannerCta') }}
      </button>
    </div>

    <nav
      :aria-label="t('settings.navLabel')"
      class="pinova-sticky-below-global-header sticky z-[38] mb-6 sm:mb-8 rounded-2xl border border-neutral-200/85 dark:border-neutral-700/90 bg-white/95 dark:bg-neutral-900/95 backdrop-blur-md backdrop-saturate-150 shadow-[0_2px_16px_-6px_rgba(0,0,0,.1)] dark:shadow-[0_2px_16px_-6px_rgba(0,0,0,.5)] ring-1 ring-black/[0.03] dark:ring-white/[0.06]"
    >
      <!-- lg+ : pastilles horizontales. &lt; lg : grille lisible (Safari / PWA, beaucoup d’entrées). -->
      <div
        class="grid grid-cols-2 gap-2 px-3 py-3 sm:grid-cols-3 lg:flex lg:flex-nowrap lg:items-stretch lg:gap-1.5 lg:overflow-x-auto lg:px-2 lg:py-2.5 lg:scroll-pl-1 lg:scroll-pr-6 lg:touch-pan-x no-scrollbar"
      >
        <button
          v-for="item in settingsNavItems"
          :key="item.id"
          type="button"
          :aria-current="activeSectionId === item.id ? 'true' : undefined"
          class="inline-flex min-h-[44px] min-w-0 items-center gap-2 rounded-xl border px-3 py-2.5 text-left text-[12px] font-semibold tracking-tight transition focus:outline-none focus-visible:ring-2 focus-visible:ring-pink-700 dark:focus-visible:ring-pink-600 focus-visible:ring-offset-2 sm:text-[12px] lg:min-h-0 lg:w-auto lg:shrink-0 lg:justify-center lg:rounded-full lg:px-3 lg:py-2 lg:text-center lg:text-[11px]"
          :class="
            activeSectionId === item.id
              ? 'border-pink-700 dark:border-pink-600 bg-pink-700 dark:bg-pink-600 text-white shadow-md shadow-pink-700/25'
              : 'border-neutral-200 dark:border-neutral-600 bg-neutral-50/90 dark:bg-neutral-800/90 text-neutral-700 dark:text-neutral-200 hover:bg-white dark:hover:bg-neutral-800 hover:border-pink-300 dark:hover:border-pink-700/60 dark:border-pink-600/60'
          "
          @click="scrollToSettingsSection(item.id)"
        >
          <span class="material-symbols-outlined shrink-0 text-[20px] leading-none lg:text-[18px]" aria-hidden="true">{{ item.icon }}</span>
          <span class="min-w-0 leading-snug lg:whitespace-nowrap">{{ item.label }}</span>
        </button>
      </div>
    </nav>

    <!-- Success message -->
    <div
      v-if="saved"
      class="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm"
    >
      <span class="material-symbols-outlined text-lg">check_circle</span>
      {{ t('settings.saved') }}
    </div>

    <div class="flex-1 flex flex-col min-h-0">
      <div class="space-y-8">
      <!-- Profile section -->
      <section id="settings-profile" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.profile.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.profile.subtitle') }}</p>
        </div>

        <div class="p-4 sm:p-6 space-y-5">
          <div class="flex flex-col gap-3 rounded-xl border border-neutral-200 bg-neutral-50/50 px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900/40 sm:flex-row sm:items-center sm:justify-between">
            <div class="min-w-0">
              <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">{{ t('lang.title') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('lang.description') }}</p>
            </div>
            <LanguageSwitcher class="shrink-0" />
          </div>

          <!-- Avatar -->
          <div class="flex flex-col items-stretch gap-4 sm:flex-row sm:items-center sm:gap-5">
            <AvatarDisc
              v-if="currentUser"
              :color="currentUser.avatarColor"
              frame-class="w-20 h-20 text-3xl shrink-0"
              text-class="text-white"
              :has-image="!!avatarPreview"
            >
              <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
              <span v-else class="text-center leading-none px-1">{{ displayInitials(displayName) }}</span>
            </AvatarDisc>
            <div class="min-w-0">
              <input
                ref="fileInput"
                type="file"
                accept="image/*"
                class="hidden"
                @change="handleFileChange"
              />
              <button
                class="app-btn app-btn-secondary app-btn-sm text-sm w-full sm:w-auto"
                @click="triggerFileInput"
              >
                {{ t('settings.profile.changePhoto') }}
              </button>
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{{ t('settings.profile.photoHint') }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.fullName') }}</label>
              <input
                v-model="displayName"
                type="text"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.username') }}</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">@</span>
                <input
                  v-model="username"
                  type="text"
                  class="w-full pl-8 pr-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.bio') }}</label>
            <textarea
              v-model="bio"
              rows="3"
              :placeholder="t('settings.profile.bioPlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition resize-none placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
            />
            <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{{ t('settings.profile.bioCount', { count: bio.length }) }}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.email') }}</label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.birthDate') }}</label>
              <input
                v-model="birthDate"
                type="date"
                autocomplete="bday"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.currency') }}</label>
            <select
              v-model="preferredCurrency"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 text-sm bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
            >
              <option
                v-for="currency in supportedCurrencies"
                :key="currency"
                :value="currency"
              >
                {{ currencyOptionLabel(currency) }}
              </option>
            </select>
            <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">
              {{ t('settings.profile.detectedCountry', { country: detectedCountryCode || 'N/A' }) }}
            </p>
          </div>

          <div class="flex justify-end">
            <button
              class="app-btn app-btn-primary text-sm flex items-center gap-2"
              :disabled="saving"
              @click="handleSave"
            >
              <svg v-if="saving" class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ saving ? t('settings.profile.saving') : t('settings.profile.save') }}
            </button>
          </div>
        </div>
      </section>

      <!-- Notifications preferences -->
      <section id="settings-notifications" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.notifications.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.notifications.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.followers') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.followers.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="notificationsFollowers" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.saves') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.saves.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="notificationsSaves" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.recommendations') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.recommendations.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="notificationsRecommendations" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 flex flex-col gap-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.web.title') }}</p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.web.desc') }}</p>
              </div>
              <div class="flex flex-col gap-2 shrink-0 self-stretch sm:self-auto sm:min-w-[11rem]">
                <button
                  v-if="!webNotificationsEnabled"
                  type="button"
                  class="px-4 py-2 rounded-full text-xs font-semibold transition text-center bg-neutral-900 text-white hover:bg-neutral-800 disabled:opacity-50"
                  :disabled="webNotificationsLoading || !isWebPushSupported()"
                  @click="activateWebNotifications"
                >
                  {{
                    webNotificationsLoading
                      ? t('settings.notifications.web.activating')
                      : t('settings.notifications.web.enable')
                  }}
                </button>
                <button
                  v-else
                  type="button"
                  class="px-4 py-2 rounded-full text-xs font-semibold transition text-center border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-900 text-neutral-800 dark:text-neutral-100 hover:bg-neutral-50 dark:hover:bg-neutral-800 disabled:opacity-50"
                  :disabled="webNotificationsLoading"
                  @click="deactivateWebNotifications"
                >
                  {{
                    webNotificationsLoading
                      ? t('settings.notifications.web.disabling')
                      : t('settings.notifications.web.disable')
                  }}
                </button>
              </div>
            </div>
            <p
              v-if="webNotificationsEnabled"
              class="text-[11px] text-neutral-500 dark:text-neutral-400 leading-snug"
            >
              {{ t('settings.notifications.web.deviceHint') }}
            </p>
          </div>
          <p v-if="webNotificationsError" class="text-xs text-pink-700">{{ webNotificationsError }}</p>
          <div class="flex items-center justify-end">
            <button
              class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
              :disabled="notificationsSaving"
              @click="persistNotificationSettings"
            >
              {{ notificationsSaving ? t('settings.notifications.saving') : t('settings.notifications.save') }}
            </button>
          </div>
          <p v-if="notificationsSaved" class="text-xs text-emerald-700">{{ t('settings.notifications.saved') }}</p>
        </div>
      </section>

      <!-- Privacy -->
      <section id="settings-privacy" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.privacy.title') }}</h2>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.privacy.private') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.privacy.private.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="privateProfile" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.privacy.search') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.privacy.search.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="discoverableProfile" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
        </div>
        <div class="px-4 pb-4 sm:px-6 sm:pb-6 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-end sm:gap-3">
          <button
            class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
            :disabled="privacySaving"
            @click="persistPrivacySettings"
          >
            {{ privacySaving ? t('settings.privacy.saving') : t('settings.privacy.save') }}
          </button>
          <p v-if="privacySaved" class="text-xs text-emerald-700">{{ t('settings.privacy.saved') }}</p>
        </div>
      </section>

      <!-- Apparence -->
      <section
        id="settings-appearance"
        class="scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.appearance.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.appearance.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.appearance.modeLabel') }}</p>
          <div class="flex flex-wrap gap-2">
            <button
              type="button"
              class="px-4 py-2 rounded-full text-sm font-semibold border transition"
              :class="
                appearanceMode === 'light'
                  ? 'border-pink-700 dark:border-pink-600 bg-pink-50 text-pink-900 dark:bg-pink-950/60 dark:text-pink-50'
                  : 'border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:border-pink-300'
              "
              @click="setAppearanceMode('light')"
            >
              {{ t('settings.appearance.light') }}
            </button>
            <button
              type="button"
              class="px-4 py-2 rounded-full text-sm font-semibold border transition"
              :class="
                appearanceMode === 'dark'
                  ? 'border-pink-700 dark:border-pink-600 bg-pink-50 text-pink-900 dark:bg-pink-950/60 dark:text-pink-50'
                  : 'border-neutral-200 dark:border-neutral-600 text-neutral-700 dark:text-neutral-200 hover:border-pink-300'
              "
              @click="setAppearanceMode('dark')"
            >
              {{ t('settings.appearance.dark') }}
            </button>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">{{ t('settings.appearance.hint') }}</p>
        </div>
      </section>

      <!-- Application / installation (navigateur / écran d’accueil) -->
      <section
        id="settings-pwa-install"
        class="scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 bg-white dark:bg-neutral-900 rounded-2xl border border-neutral-100 dark:border-neutral-800 shadow-sm overflow-hidden"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.pwaInstall.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.pwaInstall.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-3">
          <p v-if="isStandalone" class="text-xs text-neutral-500 dark:text-neutral-400 leading-relaxed">
            {{ t('settings.pwaInstall.standaloneHint') }}
          </p>
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-pink-700 text-white text-sm font-semibold hover:bg-pink-800 transition dark:bg-pink-600 dark:hover:bg-pink-500"
            @click="openPwaInstallGuideFromSettings"
          >
            <span class="material-symbols-outlined text-[20px]">install_mobile</span>
            {{ t('settings.pwaInstall.openGuide') }}
          </button>
        </div>
      </section>

      <section id="settings-blocked" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b app-divider-subtle">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.blocked.title') }}</h2>
          <p class="text-xs app-text-muted mt-0.5">{{ t('settings.blocked.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6">
          <div v-if="blockedLoading" class="text-sm app-text-muted">{{ t('common.loading') }}</div>
          <p v-else-if="blockedRows.length === 0" class="text-sm app-text-muted">{{ t('settings.blocked.empty') }}</p>
          <ul v-else class="rounded-xl border app-divider-subtle overflow-hidden">
            <li
              v-for="row in blockedRows"
              :key="row.id"
              class="app-list-item flex items-center justify-between gap-3 px-4 py-3 border-b app-divider-subtle last:border-b-0"
            >
              <div class="min-w-0">
                <p class="text-sm font-medium text-neutral-900 dark:text-neutral-100 truncate">
                  {{ row.display_name || row.displayName || row.username }}
                </p>
                <p class="text-xs app-text-muted">@{{ row.username }}</p>
              </div>
              <button
                type="button"
                class="app-btn app-btn-secondary app-btn-sm shrink-0 text-xs"
                @click="handleUnblockUser(row)"
              >
                {{ t('settings.blocked.unblock') }}
              </button>
            </li>
          </ul>
        </div>
      </section>

      <!-- Accessibilité & données -->
      <section id="settings-access" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b app-divider-subtle">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.access.title') }}</h2>
          <p class="text-xs app-text-muted mt-0.5">{{ t('settings.access.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <div>
            <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 mb-2">{{ t('settings.access.dataSaver') }}</p>
            <p class="text-xs text-neutral-600 dark:text-neutral-300 mb-3">{{ t('settings.access.dataSaver.desc') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="app-btn app-btn-sm text-xs"
                :class="dataSaverOverride === 'auto' ? 'app-btn-primary' : 'app-btn-secondary'"
                @click="handleDataSaverMode('auto')"
              >
                {{ t('settings.access.dataSaver.auto') }}
              </button>
              <button
                type="button"
                class="app-btn app-btn-sm text-xs"
                :class="dataSaverOverride === 'on' ? 'app-btn-primary' : 'app-btn-secondary'"
                @click="handleDataSaverMode('on')"
              >
                {{ t('settings.access.dataSaver.on') }}
              </button>
              <button
                type="button"
                class="app-btn app-btn-sm text-xs"
                :class="dataSaverOverride === 'off' ? 'app-btn-primary' : 'app-btn-secondary'"
                @click="handleDataSaverMode('off')"
              >
                {{ t('settings.access.dataSaver.off') }}
              </button>
            </div>
            <p class="text-[11px] text-neutral-600 dark:text-neutral-300 mt-2">{{ t('settings.access.dataSaver.hint', { active: isLowDataMode ? t('settings.access.dataSaver.yes') : t('settings.access.dataSaver.no') }) }}</p>
          </div>

          <div v-if="isVerifiedAdultForSensitiveSettings" class="pt-2 border-t app-divider-subtle space-y-3">
            <div>
              <p class="text-sm font-medium text-neutral-800">{{ t('settings.access.sensitiveMedia.title') }}</p>
              <p class="text-xs text-neutral-600 mt-0.5">{{ t('settings.access.sensitiveMedia.subtitle') }}</p>
            </div>
            <fieldset class="space-y-2">
              <legend class="sr-only">{{ t('settings.access.sensitiveMedia.title') }}</legend>
              <label class="flex gap-3 p-3 rounded-xl border cursor-pointer transition" :class="sensitiveMediaViewerPref === 'blur' ? 'border-pink-700 bg-pink-50/50 dark:bg-pink-950/35 dark:border-pink-600/70' : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/70'">
                <input v-model="sensitiveMediaViewerPref" type="radio" value="blur" class="mt-1" />
                <span>
                  <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ t('settings.access.sensitiveMedia.optionBlur') }}</span>
                  <span class="block text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{{ t('settings.access.sensitiveMedia.optionBlurDesc') }}</span>
                </span>
              </label>
              <label
                class="flex gap-3 p-3 rounded-xl border transition"
                :class="[
                  !canShowUnblurredSensitiveOption ? 'opacity-55 cursor-not-allowed' : 'cursor-pointer',
                  sensitiveMediaViewerPref === 'show' ? 'border-pink-700 bg-pink-50/50 dark:bg-pink-950/35 dark:border-pink-600/70' : 'border-neutral-200 dark:border-neutral-700',
                  canShowUnblurredSensitiveOption ? 'hover:bg-neutral-50 dark:hover:bg-neutral-800/70' : '',
                ]"
              >
                <input v-model="sensitiveMediaViewerPref" type="radio" value="show" class="mt-1 shrink-0" :disabled="!canShowUnblurredSensitiveOption" />
                <span>
                  <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ t('settings.access.sensitiveMedia.optionShow') }}</span>
                  <span class="block text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{{ t('settings.access.sensitiveMedia.optionShowDesc') }}</span>
                  <span v-if="!canShowUnblurredSensitiveOption" class="block text-[11px] text-amber-800 mt-1">{{ t('settings.access.sensitiveMedia.optionShowBadge') }}</span>
                </span>
              </label>
              <label class="flex gap-3 p-3 rounded-xl border cursor-pointer transition" :class="sensitiveMediaViewerPref === 'hide' ? 'border-pink-700 bg-pink-50/50 dark:bg-pink-950/35 dark:border-pink-600/70' : 'border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/70'">
                <input v-model="sensitiveMediaViewerPref" type="radio" value="hide" class="mt-1" />
                <span>
                  <span class="text-sm font-medium text-neutral-900 dark:text-neutral-100">{{ t('settings.access.sensitiveMedia.optionHide') }}</span>
                  <span class="block text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{{ t('settings.access.sensitiveMedia.optionHideDesc') }}</span>
                </span>
              </label>
            </fieldset>
            <div class="flex justify-end mt-2">
              <button
                type="button"
                class="app-btn app-btn-primary app-btn-sm text-xs"
                :disabled="sensitiveMediaPrefsSaving"
                @click="persistSensitiveMediaPreferences"
              >
                {{ sensitiveMediaPrefsSaving ? t('settings.access.sensitiveMedia.saving') : t('settings.access.sensitiveMedia.save') }}
              </button>
            </div>
            <p v-if="sensitiveMediaPrefsSaved" class="text-xs text-emerald-700">{{ t('settings.access.sensitiveMedia.saved') }}</p>
          </div>

          <div v-if="currentPlan === 'pro'" class="pt-2 border-t app-divider-subtle">
            <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
              <div class="min-w-0 flex-1 pr-1">
                <p class="text-sm font-medium text-neutral-800">{{ t('settings.access.digestWeekly') }}</p>
                <p class="text-xs text-neutral-600">{{ t('settings.access.digestWeekly.desc') }}</p>
              </div>
              <div class="relative shrink-0">
                <input v-model="digestWeekly" type="checkbox" class="sr-only peer" />
                <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-amber-500 rounded-full transition-colors"></div>
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
              </div>
            </label>
            <div class="flex justify-end mt-2">
              <button
                type="button"
                class="app-btn app-btn-primary app-btn-sm text-xs"
                :disabled="digestSaving"
                @click="persistDigestWeekly"
              >
                {{ digestSaving ? t('settings.access.digestSaving') : t('settings.access.digestSave') }}
              </button>
            </div>
            <p v-if="digestSaved" class="text-xs text-emerald-700 mt-2">{{ t('settings.access.digestSaved') }}</p>
          </div>
        </div>
      </section>

      <section id="settings-tips" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.tips.title') }}</h2>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.tips.subtitle') }}</p>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 shrink-0 self-start">
            {{ currentPlan.toUpperCase() }}
          </span>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.tips.enable') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.tips.enable.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="tipsEnabled" type="checkbox" class="sr-only peer" :disabled="currentPlan !== 'pro'" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <div>
            <label class="block text-xs font-medium text-neutral-600 mb-1">{{ t('settings.tips.url') }}</label>
            <input
              v-model="tipsUrl"
              type="url"
              :disabled="currentPlan !== 'pro'"
              :placeholder="t('settings.tips.url.placeholder')"
              class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm disabled:bg-neutral-50 dark:disabled:bg-neutral-900/50 disabled:text-neutral-400"
            />
          </div>
          <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 pt-1">
            <p class="text-xs text-neutral-500 dark:text-neutral-400 min-w-0">{{ t('settings.tips.note') }}</p>
            <button
              class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition shrink-0 self-end sm:self-auto"
              :disabled="tipsSaving"
              @click="persistTipsSettings"
            >
              {{ tipsSaving ? t('settings.tips.saving') : t('settings.tips.save') }}
            </button>
          </div>
          <p v-if="tipsSaved" class="text-xs text-emerald-700">{{ t('settings.tips.saved') }}</p>
        </div>
      </section>

      <section
        v-if="currentUser"
        id="settings-seats"
        class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b app-divider-subtle">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.seats.title') }}</h2>
          <p class="text-xs app-text-muted mt-0.5">{{ t('settings.seats.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4 text-sm">
          <p v-if="seatHubLoading" class="text-xs text-neutral-400">{{ t('settings.seats.loading') }}</p>
          <template v-else-if="seatHub">
            <!-- Invitations entrantes -->
            <div v-if="seatHub.incoming_invitations?.length" class="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/25 p-3">
              <p class="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.seats.incoming') }}</p>
              <div v-for="row in seatHub.incoming_invitations" :key="row.id" class="space-y-2 app-card-soft rounded-lg p-2">
                <p class="text-xs text-neutral-700">
                  {{ row.owner_display_name || row.owner_username }}
                  <span class="text-neutral-400">(@{{ row.owner_username }})</span>
                </p>
                <div class="flex flex-wrap gap-2">
                  <button
                    type="button"
                    class="app-btn app-btn-primary app-btn-sm text-[11px]"
                    :disabled="seatBusy"
                    @click="respondSeatInvite(row.id, 'accept')"
                  >
                    {{ t('settings.seats.accept') }}
                  </button>
                  <button
                    type="button"
                    class="app-btn app-btn-secondary app-btn-sm text-[11px]"
                    :disabled="seatBusy"
                    @click="respondSeatInvite(row.id, 'decline')"
                  >
                    {{ t('settings.seats.decline') }}
                  </button>
                </div>
              </div>
            </div>

            <template v-if="seatHub.role === 'member'">
              <p class="text-xs text-neutral-700">
                {{ t('settings.seats.memberOf', { username: seatHub.sponsor_display_name || seatHub.sponsor_username || '' }) }}
              </p>
              <button
                type="button"
                class="app-btn app-btn-primary app-btn-sm text-xs"
                :disabled="seatBusy"
                @click="leaveSeatGroup"
              >
                {{ t('settings.seats.leave') }}
              </button>
            </template>

            <template v-else-if="seatHub.role === 'owner'">
              <p class="text-xs text-neutral-600">
                {{
                  t('settings.seats.ownerSummary', {
                    used: seatHub.used_slots,
                    max: seatHub.max_invitees,
                    bundle: seatHub.seat_bundle,
                  })
                }}
              </p>
              <div class="space-y-2">
                <button
                  type="button"
                  class="app-btn app-btn-secondary w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl text-xs border-pink-300 text-pink-700 dark:text-pink-600 disabled:opacity-50"
                  :disabled="seatBusy"
                  @click="seatInviteSearchOpen = true"
                >
                  <span class="material-symbols-outlined text-lg" aria-hidden="true">person_search</span>
                  {{ t('settings.seats.inviteSearchMember') }}
                </button>
              </div>
              <p v-if="seatHub.members?.length" class="text-xs font-semibold text-neutral-800 pt-2">{{ t('settings.seats.members') }}</p>
              <ul v-if="seatHub.members?.length" class="space-y-1">
                <li
                  v-for="m in seatHub.members"
                  :key="m.username"
                  class="flex flex-col gap-2 text-xs py-2 border-b app-divider-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-1"
                >
                  <span class="min-w-0 truncate">@{{ m.username }}</span>
                  <button
                    type="button"
                    class="text-pink-700 font-semibold disabled:opacity-50 self-start sm:self-auto"
                    :disabled="seatBusy"
                    @click="removeSeatMember(m.username)"
                  >
                    {{ t('settings.seats.removeMember') }}
                  </button>
                </li>
              </ul>
              <p v-if="seatHub.pending_invitations?.length" class="text-xs font-semibold text-neutral-800 pt-2">{{ t('settings.seats.pendingOut') }}</p>
              <ul v-if="seatHub.pending_invitations?.length" class="space-y-1">
                <li
                  v-for="p in seatHub.pending_invitations"
                  :key="p.id"
                  class="flex flex-col gap-2 text-xs py-2 border-b app-divider-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-1"
                >
                  <span class="min-w-0 truncate">@{{ p.invitee_username }}</span>
                  <button
                    type="button"
                    class="text-neutral-600 font-semibold disabled:opacity-50 self-start sm:self-auto"
                    :disabled="seatBusy"
                    @click="revokeSeatInviteOutgoing(p.id)"
                  >
                    {{ t('settings.seats.revokeInvite') }}
                  </button>
                </li>
              </ul>
              <div class="pt-2 border-t app-divider-subtle mt-3">
                <button
                  type="button"
                  class="text-xs font-semibold text-rose-600 hover:underline disabled:opacity-50"
                  :disabled="seatBusy"
                  @click="revokeAllSeatGroup"
                >
                  {{ t('settings.seats.revokeAll') }}
                </button>
              </div>
            </template>

            <template v-else>
              <p v-if="!seatHub.incoming_invitations?.length" class="text-xs text-neutral-500">{{ t('settings.seats.none') }}</p>
            </template>
          </template>
        </div>
      </section>

      <section id="settings-subscription" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-start justify-between gap-3">
          <div class="min-w-0">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.subscription.title') }}</h2>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.subscription.subtitle') }}</p>
            <router-link to="/billing" class="inline-flex mt-2 text-xs font-semibold text-pink-700 hover:underline">
              {{ t('settings.subscription.viewBillingPage') }} →
            </router-link>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 text-neutral-600 shrink-0">
            {{ currentPlan.toUpperCase() }}
          </span>
        </div>
        <div class="p-4 sm:p-6 space-y-3">
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('settings.subscription.renewal', { date: subscriptionRenewalLabel }) }}
          </p>
          <p v-if="subscriptionScheduleHint" class="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
            {{ subscriptionScheduleHint }}
          </p>
          <div class="flex flex-wrap gap-2">
            <router-link
              to="/premium"
              class="px-4 py-2 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-xs font-semibold hover:bg-pink-800 dark:hover:opacity-90 transition inline-flex items-center"
            >
              {{ t('settings.subscription.managePlans') }}
            </router-link>
            <button
              class="px-4 py-2 rounded-full bg-pink-700 dark:bg-pink-600 text-white text-xs font-semibold hover:bg-pink-800 dark:hover:opacity-90 disabled:opacity-50 transition"
              :disabled="subscriptionActionPending || currentPlan === 'free'"
              @click="handleCancelAtPeriodEnd"
            >
              {{ t('settings.subscription.cancelAtEnd') }}
            </button>
            <button
              v-if="currentPlan === 'pro'"
              class="px-4 py-2 rounded-full bg-white border border-neutral-300 text-neutral-900 text-xs font-semibold hover:bg-neutral-50 disabled:opacity-50 transition"
              :disabled="subscriptionActionPending"
              @click="handleSchedulePlusAtRenewal"
            >
              {{ t('settings.subscription.scheduleToPlus') }}
            </button>
            <button
              v-if="currentUser?.subscription?.scheduledPlan"
              class="px-4 py-2 rounded-full bg-neutral-200 text-neutral-900 text-xs font-semibold hover:bg-neutral-300 disabled:opacity-50 transition"
              :disabled="subscriptionActionPending"
              @click="handleClearPlannedChange"
            >
              {{ t('settings.subscription.clearSchedule') }}
            </button>
            <button
              class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
              :disabled="subscriptionActionPending"
              @click="handleReactivateSubscription"
            >
              {{ t('settings.subscription.reactivate') }}
            </button>
          </div>
          <p v-if="subscriptionActionMessage" class="text-xs text-neutral-600">{{ subscriptionActionMessage }}</p>

          <div class="pt-4 mt-4 border-t border-neutral-100">
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p class="text-xs font-semibold text-neutral-800">{{ t('settings.subscription.billingHistory') }}</p>
              <router-link to="/billing" class="text-[11px] font-semibold text-pink-700 hover:underline">
                {{ t('settings.subscription.viewBillingPage') }}
              </router-link>
            </div>
            <div v-if="billingInvoicesLoading" aria-busy="true">
              <span class="sr-only">{{ t('settings.subscription.billingLoading') }}</span>
              <BillingInvoicesSkeleton />
            </div>
            <div v-else-if="!billingInvoices.length" class="text-xs text-neutral-400">{{ t('settings.subscription.billingEmpty') }}</div>
            <ul v-else class="space-y-2 max-h-64 overflow-y-auto pr-1">
              <li
                v-for="inv in billingInvoices"
                :key="inv.id"
                class="rounded-xl border border-neutral-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-100 break-words">
                    {{ inv.plan.toUpperCase() }} · {{ inv.billing_cycle }} · {{ invoiceAmountLabel(inv) }}
                  </p>
                  <p class="text-[11px] text-neutral-500 dark:text-neutral-400 break-words">
                    {{ formatInvoiceWhen(inv.created_at) }} · {{ inv.status }}
                    <span v-if="inv.promo_bundle && inv.promo_bundle !== 'solo'"> · {{ inv.promo_bundle }}</span>
                  </p>
                </div>
                <div class="flex flex-wrap gap-2 shrink-0">
                  <template v-if="inv.status === 'approved'">
                    <button
                      type="button"
                      class="text-[11px] font-semibold text-pink-700 hover:underline disabled:opacity-50"
                      :disabled="billingReceiptLoadingId === inv.id"
                      @click="viewBillingReceipt(inv)"
                    >
                      {{
                        billingReceiptLoadingId === inv.id
                          ? t('billing.fetchReceiptBusy')
                          : inv.invoice_url
                            ? t('settings.subscription.openReceipt')
                            : t('billing.fetchReceipt')
                      }}
                    </button>
                  </template>
                  <a
                    v-else-if="inv.checkout_url && inv.status === 'pending'"
                    :href="inv.checkout_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[11px] font-semibold text-neutral-700 hover:underline"
                  >
                    {{ t('settings.subscription.openCheckout') }}
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section
        v-if="isStandalone"
        id="settings-pwa-reload"
        class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('pwa.reload.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('pwa.reload.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6">
          <button
            type="button"
            class="inline-flex items-center gap-2 px-5 py-2.5 rounded-full bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 transition dark:bg-neutral-100 dark:text-neutral-900 dark:hover:bg-white"
            @click="onReloadPwaFromSettings"
          >
            <span class="material-symbols-outlined text-[20px]">refresh</span>
            {{ t('pwa.reload.title') }}
          </button>
        </div>
      </section>

      <section id="settings-support" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.support.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.support.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-3">
          <input
            v-model="supportSubject"
            type="text"
            :placeholder="t('settings.support.subject')"
            class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500"
          />
          <textarea
            v-model="supportMessage"
            rows="3"
            :placeholder="t('settings.support.message')"
            class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 dark:placeholder:text-neutral-500 resize-none"
          />
          <div class="flex items-center justify-end">
            <button
              class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
              :disabled="supportSubmitting || !supportSubject.trim() || !supportMessage.trim()"
              @click="submitSupportTicket"
            >
              {{ supportSubmitting ? t('settings.support.submitting') : t('settings.support.submit') }}
            </button>
          </div>
          <div v-if="supportTickets.length" class="space-y-2 pt-2 border-t border-neutral-100">
            <p class="text-xs font-semibold text-neutral-700">{{ t('settings.support.history') }}</p>
            <div
              v-for="ticket in supportTickets.slice(0, 5)"
              :key="ticket.id"
              class="rounded-xl border border-neutral-200 px-3 py-2"
            >
              <p class="text-xs font-semibold text-neutral-800">{{ ticket.subject }}</p>
              <p class="text-[11px] text-neutral-500">
                {{ supportTicketStatusLabel(ticket.status) }} · {{ supportTicketPriorityLabel(ticket.priority) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <!-- Password section -->
      <section id="settings-password" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div class="min-w-0 flex-1">
            <h2 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.password.title') }}</h2>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
              {{ needsPasswordSetup ? t('settings.password.socialSubtitle') : t('settings.password.subtitle') }}
            </p>
          </div>
          <div v-if="passwordSaved" class="text-green-600 flex items-center gap-1 text-xs font-bold animate-fade-in shrink-0">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            {{ t('settings.password.saved') }}
          </div>
        </div>

        <div v-if="needsPasswordSetup" class="p-4 sm:p-6 space-y-4">
          <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ t('settings.password.socialSectionLead') }}</p>
          <button
            type="button"
            class="app-btn app-btn-primary text-sm w-full sm:w-auto"
            @click="openInitialPasswordModal"
          >
            {{ t('settings.password.socialBannerCta') }}
          </button>
        </div>

        <div v-else class="p-4 sm:p-6 space-y-5">
          <div v-if="passwordError" class="px-4 py-3 rounded-xl bg-pink-50 border border-pink-100 text-pink-700 text-xs">
            {{ passwordError }}
          </div>

          <div class="grid grid-cols-1 lg:grid-cols-3 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.password.current') }}</label>
              <input
                v-model="oldPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.password.new') }}</label>
              <input
                v-model="newPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.password.confirm') }}</label>
              <input
                v-model="confirmNewPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
            </div>
          </div>

          <div class="flex justify-end">
            <button
              class="px-6 py-2.5 rounded-full bg-neutral-900 text-white text-sm font-semibold hover:bg-neutral-800 disabled:opacity-50 transition flex items-center gap-2"
              :disabled="passwordChanging || !oldPassword || !newPassword"
              @click="handlePasswordChange"
            >
              <svg v-if="passwordChanging" class="animate-spin h-4 w-4 text-white" viewBox="0 0 24 24">
                <circle class="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" stroke-width="4" fill="none" />
                <path class="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
              {{ passwordChanging ? t('settings.password.submitting') : t('settings.password.submit') }}
            </button>
          </div>
        </div>
      </section>
      </div>

      <section
        id="settings-danger"
        class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl border-pink-300/55 overflow-hidden mt-auto pt-8"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-pink-300/50 dark:border-pink-700/50">
          <h2 class="text-lg font-semibold text-pink-700 dark:text-pink-600">{{ t('settings.danger.title') }}</h2>
        </div>
        <div
          v-if="scheduledAccountDeletion"
          class="p-4 sm:p-6 border-b border-rose-200/60 dark:border-rose-800/50 bg-rose-50/90 dark:bg-rose-950/30"
        >
          <p class="font-semibold text-sm text-rose-950 dark:text-rose-100">{{ t('settings.danger.delete.bannerTitle') }}</p>
          <p class="mt-1 text-xs leading-relaxed text-rose-900 dark:text-rose-100/90">
            {{ t('settings.danger.delete.bannerBody', { date: scheduledAccountDeletionLabel }) }}
          </p>
          <button
            type="button"
            class="mt-3 app-btn app-btn-secondary app-btn-sm border-rose-200 dark:border-rose-700/70 text-rose-900 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30"
            :disabled="accountDeletionBusy"
            @click="cancelAccountDeletion()"
          >
            {{ t('settings.danger.delete.cancelSchedule') }}
          </button>
        </div>
        <div class="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-pink-200/45 dark:border-pink-800/40">
          <div>
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.danger.logout') }}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.danger.logout.desc') }}</p>
          </div>
          <button
            type="button"
            class="app-btn app-btn-secondary text-sm border-pink-300 text-pink-700 dark:text-pink-600"
            @click="handleLogout"
          >
            {{ t('settings.danger.logout.cta') }}
          </button>
        </div>
        <div class="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4 bg-rose-50/45 dark:bg-rose-950/20">
          <div class="max-w-xl flex-1 space-y-2">
            <p class="text-sm font-bold text-rose-900">{{ t('settings.danger.delete.title') }}</p>
            <p class="text-xs text-neutral-700 leading-relaxed">{{ t('settings.danger.delete.warningBody') }}</p>
          </div>
          <div class="w-full sm:w-auto shrink-0 flex flex-col gap-2">
            <button
              type="button"
              class="app-btn app-btn-danger text-sm text-center"
              :disabled="accountDeletionBusy || !!scheduledAccountDeletion"
              @click="requestAccountDeletion()"
            >
              {{ t('settings.danger.delete.scheduleCta') }}
            </button>
            <p v-if="scheduledAccountDeletion" class="text-[11px] text-rose-800 text-center sm:text-right max-w-[14rem] sm:max-w-none">
              {{ t('settings.danger.delete.useBannerCancel') }}
            </p>
          </div>
        </div>
      </section>
    </div>
  </div>

  <Teleport to="body">
    <div
      v-if="initialPasswordModalOpen"
      class="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/50 backdrop-blur-[2px]"
      role="dialog"
      aria-modal="true"
      :aria-label="t('settings.password.setInitialModalTitle')"
      @click.self="closeInitialPasswordModal"
    >
      <div
        class="w-full max-w-md rounded-2xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl p-4 sm:p-6 space-y-4"
        @click.stop
      >
        <div class="flex items-start justify-between gap-3">
          <h3 class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">
            {{ t('settings.password.setInitialModalTitle') }}
          </h3>
          <button
            type="button"
            class="rounded-full p-1 text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-800"
            :aria-label="t('common.close')"
            @click="closeInitialPasswordModal"
          >
            <span class="material-symbols-outlined text-xl">close</span>
          </button>
        </div>
        <p class="text-sm text-neutral-600 dark:text-neutral-300">{{ t('settings.password.setInitialModalBody') }}</p>
        <div v-if="initialPwError" class="px-3 py-2 rounded-xl bg-pink-50 dark:bg-pink-950/40 border border-pink-100 text-pink-700 text-xs">
          {{ initialPwError }}
        </div>
        <div class="space-y-3">
          <div>
            <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{{
              t('settings.password.new')
            }}</label>
            <input
              v-model="initialPw1"
              type="password"
              autocomplete="new-password"
              class="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-sm"
            />
          </div>
          <div>
            <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{{
              t('settings.password.confirm')
            }}</label>
            <input
              v-model="initialPw2"
              type="password"
              autocomplete="new-password"
              class="w-full px-3 py-2.5 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-950 text-sm"
            />
          </div>
        </div>
        <div class="flex justify-end gap-2 pt-2">
          <button type="button" class="app-btn app-btn-secondary app-btn-sm" @click="closeInitialPasswordModal">
            {{ t('common.cancel') }}
          </button>
          <button
            type="button"
            class="app-btn app-btn-primary app-btn-sm disabled:opacity-50"
            :disabled="initialPwBusy || !initialPw1 || !initialPw2"
            @click="submitInitialPassword"
          >
            {{ initialPwBusy ? t('settings.password.submitting') : t('settings.password.setInitialSubmit') }}
          </button>
        </div>
      </div>
    </div>
  </Teleport>

  <BillingReceiptPdfModal :open="receiptPdfOpen" :url="receiptPdfUrl" @close="closeReceiptPdf" />

  <UserSearchPickModal
    v-if="seatHub?.role === 'owner'"
    v-model="seatInviteSearchOpen"
    :title="t('settings.seats.invitePickTitle')"
    :message="t('settings.seats.invitePickMessage')"
    :input-placeholder="t('settings.seats.invitePlaceholder')"
    :disambiguation-rows="seatInviteDisambiguation"
    @pick="onSeatInviteUserPick"
  />
</template>
