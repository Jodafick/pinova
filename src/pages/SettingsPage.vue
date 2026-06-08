<script setup lang="ts">
import { ref, onMounted, onUnmounted, computed, watch, nextTick } from 'vue'
import { RouterLink, useRouter, useRoute } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { usePins } from '../composables/usePins'
import { useI18n } from '../i18n'
import api from '../api/index'
import { displayInitials } from '../utils/displayInitials'
import { useDataSaver } from '../composables/useDataSaver'
import BillingInvoicesSkeleton from '../components/BillingInvoicesSkeleton.vue'
import BillingReceiptPdfModal from '../components/BillingReceiptPdfModal.vue'
import UserSearchPickModal from '../components/UserSearchPickModal.vue'
import AvatarDisc from '../components/AvatarDisc.vue'
import LanguageSwitcher from '../components/LanguageSwitcher.vue'
import SettingsProfileExtended from '../components/settings/SettingsProfileExtended.vue'
import PinovaButton from '../components/ui/PinovaButton.vue'
import ProfileIdentityBlock from '../components/settings/ProfileIdentityBlock.vue'
import BirthDatePicker from '../components/BirthDatePicker.vue'
import { profileExtendedToApiPayload } from '../utils/mapProfileExtended'
import { loadCitiesForCountry, cityLabel } from '../data/reference'
import { isValidSettingsSectionId, resolveSettingsDetailPage, settingsDetailTitleKey, settingsPageShowsSection } from '../data/settingsHubConfig'
import type { DataSaverOverride } from '../composables/useDataSaver'
import { useAppModal } from '../composables/useAppModal'
import { useBillingReceiptPdfModal } from '../composables/useBillingReceiptPdfModal'
import { isVerifiedAdultFromBirthDate } from '../composables/moderationPolicy'
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
import { setMobileHeaderTitle } from '../composables/mobileHeaderContext'

const SETTINGS_NAV_ROWS: { id: string; icon: string; labelKey: string }[] = [
  { id: 'settings-profile', icon: 'person', labelKey: 'settings.nav.profile' },
  { id: 'settings-social', icon: 'interests', labelKey: 'settings.nav.social' },
  { id: 'settings-personalization', icon: 'palette', labelKey: 'settings.nav.personalization' },
  { id: 'settings-presence', icon: 'online_prediction', labelKey: 'settings.nav.presence' },
  { id: 'settings-security', icon: 'shield', labelKey: 'settings.nav.security' },
  { id: 'settings-notifications', icon: 'notifications', labelKey: 'settings.nav.notifications' },
  { id: 'settings-privacy', icon: 'lock', labelKey: 'settings.nav.privacy' },
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
const { preference: appearancePreference, setPreference: setAppearancePreference } = useAppearance()

async function onAppearancePreference(pref: 'light' | 'dark' | 'system') {
  setAppearancePreference(pref)
  try {
    await updateProfile({ themeMode: pref } as { themeMode?: string })
  } catch {
    /* localStorage déjà persisté par useAppearance */
  }
}
const { isStandalone, canOfferInstallExperience } = usePwaContext()

const appearanceSelect = computed({
  get: () => appearancePreference.value,
  set: (value: 'light' | 'dark' | 'system') => {
    void onAppearancePreference(value)
  },
})

const pwaDeviceAction = ref('')

async function onReloadPwaFromSettings() {
  await reloadPwaApplication()
}

function openPwaInstallGuideFromSettings() {
  requestPwaInstallModalOpen()
}

function onPwaDeviceActionChange() {
  const action = pwaDeviceAction.value
  pwaDeviceAction.value = ''
  if (action === 'install') openPwaInstallGuideFromSettings()
  else if (action === 'reload') void onReloadPwaFromSettings()
}
const { showAlert, showPrompt, showConfirm } = useAppModal()
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
const firstName = ref('')
const lastName = ref('')
const jobTitle = ref('')
const school = ref('')
const company = ref('')
const website = ref('')
const gender = ref('')
const pronouns = ref('')
const favoriteQuote = ref('')
const profileCountryCode = ref('')
const profileCityId = ref('')
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
const tipWallet = ref<{
  balance_available: number
  balance_reserved: number
  currency_iso: string
  payout_phone: string
  payout_label: string
  commission_percent: number
  min_withdrawal_amount: number
} | null>(null)
const tipWalletLoading = ref(false)
const payoutPhone = ref('')
const payoutLabel = ref('')
const withdrawAmount = ref('')
const payoutSaving = ref(false)
const withdrawBusy = ref(false)
const adAdsEnabled = ref(true)
const partnerAdsEnabled = ref(true)
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
const notificationsStreakReminders = ref(true)
const notificationsReactivationEmails = ref(true)
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
const dataExportBusy = ref(false)

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
    firstName.value = currentUser.value.firstName || ''
    lastName.value = currentUser.value.lastName || ''
    jobTitle.value = currentUser.value.jobTitle || ''
    school.value = currentUser.value.school || ''
    company.value = currentUser.value.company || ''
    website.value = currentUser.value.website || ''
    gender.value = currentUser.value.gender || ''
    pronouns.value = currentUser.value.pronouns || ''
    favoriteQuote.value = currentUser.value.favoriteQuote || ''
    profileCountryCode.value = currentUser.value.countryCode || ''
    const cityName = currentUser.value.city || ''
    if (profileCountryCode.value && cityName) {
      void loadCitiesForCountry(profileCountryCode.value).then((cities) => {
        const cityMatch = cities.find((c) => cityLabel(c, currentLang.value) === cityName)
        profileCityId.value = cityMatch?.id || ''
      })
    } else {
      profileCityId.value = ''
    }
    avatarPreview.value = currentUser.value.avatarUrl || null
    currentPlan.value = currentUser.value.subscription?.plan || 'free'
    tipsEnabled.value = currentUser.value.subscription?.tipsEnabled ?? false
    if (currentPlan.value === 'pro') void loadTipWallet()
    adAdsEnabled.value = true
    partnerAdsEnabled.value = true
    preferredCurrency.value = currentUser.value.preferredCurrency || 'XOF'
    detectedCountryCode.value = currentUser.value.countryCode || ''
    notificationsFollowers.value = currentUser.value.notificationsFollowers ?? true
    notificationsSaves.value = currentUser.value.notificationsSaves ?? true
    notificationsRecommendations.value = currentUser.value.notificationsRecommendations ?? false
    notificationsStreakReminders.value = currentUser.value.notificationsStreakReminders ?? true
    notificationsReactivationEmails.value = currentUser.value.notificationsReactivationEmails ?? true
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
    const formData = new FormData()
    if (displayName.value.trim()) formData.append('display_name', displayName.value.trim())
    if (username.value.trim()) formData.append('username', username.value.trim())
    formData.append('bio', bio.value)
    if (email.value.trim()) formData.append('email', email.value.trim())
    if (avatarFile.value) formData.append('avatar', avatarFile.value)
    if (currentLang.value) formData.append('preferred_language', currentLang.value)
    if (preferredCurrency.value) formData.append('preferred_currency', preferredCurrency.value)
    const bd = birthDate.value.trim().slice(0, 10)
    if (bd) formData.append('birth_date', bd)

    const profileCities = profileCountryCode.value
      ? await loadCitiesForCountry(profileCountryCode.value)
      : []
    const pickedCity = profileCities.find((c) => c.id === profileCityId.value)
    const cityName = pickedCity ? cityLabel(pickedCity, currentLang.value) : ''
    Object.entries(
      profileExtendedToApiPayload({
        firstName: firstName.value,
        lastName: lastName.value,
        city: cityName,
        jobTitle: jobTitle.value,
        school: school.value,
        company: company.value,
        website: website.value,
        gender: gender.value,
        pronouns: pronouns.value,
        favoriteQuote: favoriteQuote.value,
      }),
    ).forEach(([k, v]) => {
      if (Array.isArray(v)) formData.append(k, JSON.stringify(v))
      else formData.append(k, String(v))
    })
    if (profileCountryCode.value) formData.append('country_code', profileCountryCode.value)

    await api.patch('me/', formData, { headers: { 'Content-Type': 'multipart/form-data' } })
    await fetchCurrentUser({ force: true })
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

async function loadTipWallet() {
  if (currentPlan.value !== 'pro') {
    tipWallet.value = null
    return
  }
  tipWalletLoading.value = true
  try {
    const res = await api.get<{ wallet: typeof tipWallet.value }>('monetization/tips/wallet/')
    tipWallet.value = res.data.wallet
    payoutPhone.value = res.data.wallet?.payout_phone || ''
    payoutLabel.value = res.data.wallet?.payout_label || ''
  } catch {
    tipWallet.value = null
  } finally {
    tipWalletLoading.value = false
  }
}

const persistTipsSettings = async () => {
  tipsSaving.value = true
  try {
    await updateProfile({
      tipsEnabled: currentPlan.value === 'pro' ? tipsEnabled.value : false,
    })
    tipsEnabled.value = currentUser.value?.subscription?.tipsEnabled ?? false
    if (tipsEnabled.value && currentPlan.value === 'pro') await loadTipWallet()
    tipsSaved.value = true
    setTimeout(() => (tipsSaved.value = false), 2500)
  } catch (err) {
    console.error('Failed to save tips settings:', err)
  } finally {
    tipsSaving.value = false
  }
}

const persistPayoutSettings = async () => {
  payoutSaving.value = true
  try {
    const res = await api.patch<{ wallet: NonNullable<typeof tipWallet.value> }>('monetization/tips/wallet/', {
      payout_phone: payoutPhone.value.trim(),
      payout_label: payoutLabel.value.trim(),
    })
    tipWallet.value = res.data.wallet
    tipsSaved.value = true
    setTimeout(() => (tipsSaved.value = false), 2500)
  } catch (err) {
    console.error('Failed to save payout settings:', err)
  } finally {
    payoutSaving.value = false
  }
}

const requestTipWithdrawal = async () => {
  const amount = parseInt(withdrawAmount.value, 10)
  if (!Number.isFinite(amount) || amount <= 0) return
  withdrawBusy.value = true
  try {
    const res = await api.post<{ wallet: NonNullable<typeof tipWallet.value> }>('monetization/tips/withdraw/', {
      amount,
    })
    tipWallet.value = res.data.wallet
    withdrawAmount.value = ''
    tipsSaved.value = true
    setTimeout(() => (tipsSaved.value = false), 2500)
    await loadTipWallet()
  } catch (err: unknown) {
    const msg = (err as { response?: { data?: { error?: string } } })?.response?.data?.error
    console.error(msg || 'withdraw failed')
  } finally {
    withdrawBusy.value = false
  }
}

const persistNotificationSettings = async () => {
  notificationsSaving.value = true
  try {
    await updateProfile({
      notificationsFollowers: notificationsFollowers.value,
      notificationsSaves: notificationsSaves.value,
      notificationsRecommendations: notificationsRecommendations.value,
      notificationsStreakReminders: notificationsStreakReminders.value,
      notificationsReactivationEmails: notificationsReactivationEmails.value,
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
  if (currentUser.value.subscription?.hasBillingHistory === false) {
    billingInvoices.value = []
    billingInvoicesLoading.value = false
    return
  }
  billingInvoicesLoading.value = true
  try {
    billingInvoices.value = await fetchSubscriptionInvoices()
  } catch {
    billingInvoices.value = []
  } finally {
    billingInvoicesLoading.value = false
  }
}

watch(
  () => currentUser.value?.subscription?.hasBillingHistory,
  (has) => {
    if (has === true) void loadBillingInvoices()
    if (has === false) {
      billingInvoices.value = []
      billingInvoicesLoading.value = false
    }
  },
)

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

async function requestDataExport() {
  dataExportBusy.value = true
  try {
    await api.post('account/export-data/')
    await showAlert(t('settings.gdpr.exportStarted'), { variant: 'success' })
  } catch {
    await showAlert(t('settings.gdpr.exportError'), { variant: 'danger', title: t('modal.errorTitle') })
  } finally {
    dataExportBusy.value = false
  }
}

async function requestAccountDeletion() {
  await showAlert(t('settings.danger.delete.warningBody'), {
    variant: 'danger',
    title: t('settings.danger.delete.title'),
  })
  const wantExport = await showConfirm({
    title: t('settings.gdpr.exportBeforeDeleteTitle'),
    message: t('settings.gdpr.exportBeforeDeleteBody'),
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
    await api.post('me/account-deletion/request/', { confirm, request_export: wantExport })
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
const detailSectionId = computed(() => String(route.params.sectionId || ''))

/** Bandeau global uniquement sur la liste paramètres — pas sur chaque sous-page détail. */
const showPasswordSetupBanner = computed(
  () => needsPasswordSetup.value && !detailSectionId.value,
)

const detailHeaderTitle = computed(() =>
  detailSectionId.value ? t(settingsDetailTitleKey(detailSectionId.value)) : t('settings.title'),
)

/** En-têtes de carte masqués en vue détail mobile/tablette (titre déjà dans AppMobilePageHeader). */
const detailCardHeaderHiddenBelowLg = computed(() =>
  detailSectionId.value ? 'hidden lg:block' : '',
)

function showSettingsSection(id: string): boolean {
  if (!detailSectionId.value) return true
  return settingsPageShowsSection(detailSectionId.value, id)
}

watch(
  detailSectionId,
  (id) => {
    if (!id) return
    if (!isValidSettingsSectionId(id)) {
      void router.replace({ name: 'settings' })
      return
    }
    const resolved = resolveSettingsDetailPage(id)
    if (resolved !== id) {
      void router.replace({ name: 'settings-section', params: { sectionId: resolved } })
    }
  },
  { immediate: true },
)

watch(
  detailHeaderTitle,
  (title) => {
    setMobileHeaderTitle(detailSectionId.value ? title : null)
  },
  { immediate: true },
)
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
  if (detailSectionId.value) return
  attachSettingsScrollListeners()
  window.addEventListener('resize', onResizeSettingsNav, { passive: true })
  void nextTick(() => scheduleRefreshSettingsActiveSection())
})

onUnmounted(() => {
  setMobileHeaderTitle(null)
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
    class="pinova-settings-page max-w-3xl mx-auto w-full min-w-0 overflow-x-clip px-4 sm:px-6 flex flex-col h-full min-h-0 pt-2 lg:pt-12 pb-[calc(2rem+env(safe-area-inset-bottom,0px))] sm:pb-12 min-h-[min(100dvh,100svh)]"
  >
    <div v-if="detailSectionId" class="pointer-events-none fixed inset-0 overflow-hidden" aria-hidden="true">
      <div class="settings-detail-orb settings-detail-orb--rose" />
      <div class="settings-detail-orb settings-detail-orb--violet" />
    </div>

    <header
      v-if="detailSectionId"
      class="relative z-[2] mb-6 hidden lg:block rounded-2xl border border-neutral-200/85 dark:border-neutral-700/90 bg-white/80 dark:bg-neutral-900/80 backdrop-blur-xl backdrop-saturate-150 shadow-[0_4px_24px_-8px_rgba(0,0,0,.12)] dark:shadow-[0_4px_24px_-8px_rgba(0,0,0,.45)] ring-1 ring-black/[0.03] dark:ring-white/[0.06] overflow-hidden"
    >
      <RouterLink
        :to="{ name: 'settings' }"
        class="flex items-center gap-3 px-4 py-3.5 text-neutral-800 dark:text-neutral-100 hover:bg-rose-500/5 transition"
      >
        <span class="material-symbols-outlined text-[22px] text-rose-600 dark:text-rose-400">arrow_back</span>
        <div class="min-w-0 flex-1">
          <p class="text-xs font-semibold uppercase tracking-wider text-neutral-500 dark:text-neutral-400">
            {{ t('settings.title') }}
          </p>
          <h1 class="text-lg font-auth-title font-auth-title--black truncate text-neutral-900 dark:text-neutral-50">
            {{ detailHeaderTitle }}
          </h1>
        </div>
      </RouterLink>
    </header>

    <div
      v-if="showPasswordSetupBanner"
      class="mb-6 rounded-2xl border border-amber-300/80 bg-amber-50 dark:bg-amber-950/40 dark:border-amber-700/60 px-4 py-4 text-sm text-amber-950 dark:text-amber-100"
    >
      <p class="font-semibold">{{ t('settings.password.socialBannerTitle') }}</p>
      <p class="mt-1 text-xs leading-relaxed opacity-90">{{ t('settings.password.socialBannerBody') }}</p>
      <PinovaButton variant="primary" size="sm" class="mt-3" @click="openInitialPasswordModal">
        {{ t('settings.password.socialBannerCta') }}
      </PinovaButton>
    </div>


    <!-- Success message -->
    <div
      v-if="saved"
      class="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm"
    >
      <span class="material-symbols-outlined text-lg">check_circle</span>
      {{ t('settings.saved') }}
    </div>

    <div class="flex-1 flex flex-col min-h-0">
      <div class="space-y-8 pinova-settings-detail-sections relative z-[1]">
      <!-- Profile section -->
      <section v-if="showSettingsSection('settings-profile')" id="settings-profile" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div v-if="!detailSectionId" class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 dark:border-neutral-800">
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.profile.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.profile.subtitle') }}</p>
        </div>

        <div class="p-4 sm:p-6 space-y-5">
          <p v-if="detailSectionId" class="hidden lg:block text-xs text-neutral-500 dark:text-neutral-400 -mt-1 mb-1">{{ t('settings.profile.subtitle') }}</p>
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
              <PinovaButton variant="secondary" size="sm" class="text-sm w-full sm:w-auto" @click="triggerFileInput">
                {{ t('settings.profile.changePhoto') }}
              </PinovaButton>
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{{ t('settings.profile.photoHint') }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.displayName') }}</label>
              <input
                v-model="displayName"
                type="text"
                autocomplete="nickname"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
              />
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{{ t('settings.profile.displayNameHint') }}</p>
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 dark:text-neutral-200 mb-1.5">{{ t('settings.profile.username') }}</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 dark:text-neutral-500 text-sm">@</span>
                <input
                  v-model="username"
                  type="text"
                  autocomplete="username"
                  class="w-full pl-8 pr-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition"
                />
              </div>
              <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-1">{{ t('settings.profile.usernameHint') }}</p>
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
              <BirthDatePicker v-model="birthDate" select-class="w-full px-4 py-3 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 text-sm focus:outline-none focus:ring-2 focus:ring-pink-700 dark:focus:ring-pink-600 focus:border-transparent transition" />
            </div>
          </div>

          <ProfileIdentityBlock
            v-model:first-name="firstName"
            v-model:last-name="lastName"
            v-model:job-title="jobTitle"
            v-model:school="school"
            v-model:company="company"
            v-model:website="website"
            v-model:gender="gender"
            v-model:pronouns="pronouns"
            v-model:favorite-quote="favoriteQuote"
            v-model:country-code="profileCountryCode"
            v-model:city-id="profileCityId"
          />

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
            <PinovaButton
              variant="primary"
              class="text-sm flex items-center gap-2"
              :loading="saving"
              @click="handleSave"
            >
              {{ saving ? t('settings.profile.saving') : t('settings.profile.save') }}
            </PinovaButton>
          </div>
        </div>
      </section>

      <section v-if="showSettingsSection('settings-social')" id="settings-social" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden p-4 sm:p-6">
        <p class="settings-subsection-label">{{ t('settings.hub.subsectionSocial') }}</p>
        <SettingsProfileExtended section="social" />
      </section>
      <section v-if="showSettingsSection('settings-personalization')" id="settings-personalization" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden p-4 sm:p-6">
        <p class="settings-subsection-label">{{ t('settings.hub.subsectionPersonalization') }}</p>
        <SettingsProfileExtended section="personalization" />
      </section>
      <section v-if="showSettingsSection('settings-presence')" id="settings-presence" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden p-4 sm:p-6">
        <p class="settings-subsection-label">{{ t('settings.hub.subsectionPresence') }}</p>
        <SettingsProfileExtended section="presence" />
      </section>
      <section v-if="showSettingsSection('settings-security')" id="settings-security" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden p-4 sm:p-6">
        <p class="settings-subsection-label">{{ t('settings.hub.subsectionSecurity') }}</p>
        <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-white mb-2">{{ t('settings.nav.security') }}</h2>
        <p class="text-sm text-neutral-500 dark:text-neutral-400">{{ t('settings.security.sessionsSoon') }}</p>
        <p class="text-sm text-neutral-500 dark:text-neutral-400 mt-2">{{ t('settings.security.phoneSoon') }}</p>
        <p class="text-xs text-neutral-400 dark:text-neutral-500 mt-4">{{ t('settings.security.passwordHint') }}</p>
      </section>

      <!-- Notifications preferences -->
      <section v-if="showSettingsSection('settings-notifications')" id="settings-notifications" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div v-if="!detailSectionId" class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.notifications.title') }}</h2>
          <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.notifications.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <p v-if="detailSectionId" class="hidden lg:block text-xs text-neutral-500 dark:text-neutral-400 mb-2">{{ t('settings.notifications.subtitle') }}</p>

          <p class="settings-subsection-label">{{ t('settings.hub.subsectionDisplay') }}</p>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div class="min-w-0">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.appearance.modeLabel') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.appearance.hint') }}</p>
            </div>
            <select
              v-model="appearanceSelect"
              class="w-full sm:w-auto sm:min-w-[10.5rem] rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-100 pinova-focus-ring"
              :aria-label="t('settings.appearance.modeLabel')"
            >
              <option value="light">{{ t('settings.appearance.light') }}</option>
              <option value="dark">{{ t('settings.appearance.dark') }}</option>
              <option value="system">{{ t('settings.appearance.system') }}</option>
            </select>
          </div>

          <p class="settings-subsection-label">{{ t('settings.hub.subsectionAppOnDevice') }}</p>
          <div class="grid gap-3 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-center">
            <div class="min-w-0">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.pwa.onDevice.label') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                {{
                  isStandalone
                    ? t('settings.pwa.onDevice.standaloneHint')
                    : t('settings.pwa.onDevice.browserHint')
                }}
              </p>
            </div>
            <select
              v-if="isStandalone || canOfferInstallExperience"
              v-model="pwaDeviceAction"
              class="w-full sm:w-auto sm:min-w-[12rem] rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-900 px-3 py-2.5 text-sm font-medium text-neutral-800 dark:text-neutral-100 pinova-focus-ring"
              :aria-label="t('settings.pwa.onDevice.label')"
              @change="onPwaDeviceActionChange"
            >
              <option value="">{{ t('settings.pwa.onDevice.actionNone') }}</option>
              <option v-if="!isStandalone && canOfferInstallExperience" value="install">
                {{ t('settings.pwaInstall.openGuide') }}
              </option>
              <option v-if="isStandalone" value="reload">{{ t('pwa.reload.title') }}</option>
            </select>
            <p v-else class="text-xs text-neutral-500 dark:text-neutral-400 sm:text-right">
              {{ t('settings.pwa.onDevice.unavailable') }}
            </p>
          </div>

          <p class="settings-subsection-label">{{ t('settings.hub.subsectionEmailPush') }}</p>
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
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.streakReminders') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.streakReminders.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="notificationsStreakReminders" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.reactivationEmails') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.reactivationEmails.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="notificationsReactivationEmails" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <p class="settings-subsection-label">{{ t('settings.hub.subsectionPush') }}</p>
          <div class="rounded-xl border border-neutral-200 dark:border-neutral-700 p-4 flex flex-col gap-3">
            <div class="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4">
              <div class="min-w-0 flex-1">
                <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.notifications.web.title') }}</p>
                <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.notifications.web.desc') }}</p>
              </div>
              <div class="flex flex-col gap-2 shrink-0 self-stretch sm:self-auto sm:min-w-[11rem]">
                <PinovaButton
                  v-if="!webNotificationsEnabled"
                  variant="primary"
                  size="sm"
                  block
                  :loading="webNotificationsLoading"
                  :disabled="webNotificationsLoading || !isWebPushSupported()"
                  @click="activateWebNotifications"
                >
                  {{ t('settings.notifications.web.enable') }}
                </PinovaButton>
                <PinovaButton
                  v-else
                  variant="secondary"
                  size="sm"
                  block
                  :loading="webNotificationsLoading"
                  :disabled="webNotificationsLoading"
                  @click="deactivateWebNotifications"
                >
                  {{ t('settings.notifications.web.disable') }}
                </PinovaButton>
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
            <PinovaButton
              variant="primary"
              size="sm"
              :loading="notificationsSaving"
              :disabled="notificationsSaving"
              @click="persistNotificationSettings"
            >
              {{ notificationsSaving ? t('settings.notifications.saving') : t('settings.notifications.save') }}
            </PinovaButton>
          </div>
          <p v-if="notificationsSaved" class="text-xs text-emerald-700">{{ t('settings.notifications.saved') }}</p>
        </div>
      </section>

      <!-- Privacy -->
      <section v-if="showSettingsSection('settings-privacy')" id="settings-privacy" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div v-if="!detailSectionId" class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.privacy.title') }}</h2>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <p v-if="detailSectionId" class="hidden lg:block text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.privacy.pageLead') }}</p>
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

      <section v-if="showSettingsSection('settings-blocked')" id="settings-blocked" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b app-divider-subtle">
          <p class="settings-subsection-label mb-2">{{ t('settings.hub.subsectionBlocked') }}</p>
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.blocked.title') }}</h2>
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
              <PinovaButton variant="secondary" size="sm" class="shrink-0 text-xs" @click="handleUnblockUser(row)">
                {{ t('settings.blocked.unblock') }}
              </PinovaButton>
            </li>
          </ul>
        </div>
      </section>

      <!-- Accessibilité & données -->
      <section v-if="showSettingsSection('settings-access')" id="settings-access" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b app-divider-subtle">
          <p class="settings-subsection-label mb-2">{{ t('settings.hub.subsectionAccess') }}</p>
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.access.title') }}</h2>
          <p class="text-xs app-text-muted mt-0.5">{{ t('settings.access.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <div>
            <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100 mb-2">{{ t('settings.access.dataSaver') }}</p>
            <p class="text-xs text-neutral-600 dark:text-neutral-300 mb-3">{{ t('settings.access.dataSaver.desc') }}</p>
            <div class="flex flex-wrap gap-2">
              <PinovaButton
                size="sm"
                class="text-xs"
                :variant="dataSaverOverride === 'auto' ? 'primary' : 'secondary'"
                @click="handleDataSaverMode('auto')"
              >
                {{ t('settings.access.dataSaver.auto') }}
              </PinovaButton>
              <PinovaButton
                size="sm"
                class="text-xs"
                :variant="dataSaverOverride === 'on' ? 'primary' : 'secondary'"
                @click="handleDataSaverMode('on')"
              >
                {{ t('settings.access.dataSaver.on') }}
              </PinovaButton>
              <PinovaButton
                size="sm"
                class="text-xs"
                :variant="dataSaverOverride === 'off' ? 'primary' : 'secondary'"
                @click="handleDataSaverMode('off')"
              >
                {{ t('settings.access.dataSaver.off') }}
              </PinovaButton>
            </div>
            <p class="text-[11px] text-neutral-600 dark:text-neutral-300 mt-2">{{ t('settings.access.dataSaver.hint', { active: isLowDataMode ? t('settings.access.dataSaver.yes') : t('settings.access.dataSaver.no') }) }}</p>
          </div>

          <div v-if="isVerifiedAdultForSensitiveSettings" class="pt-2 border-t app-divider-subtle space-y-3">
            <div>
              <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">{{ t('settings.access.sensitiveMedia.title') }}</p>
              <p class="text-xs text-neutral-600 dark:text-neutral-300 mt-0.5">{{ t('settings.access.sensitiveMedia.subtitle') }}</p>
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
              <PinovaButton
                variant="primary"
                size="sm"
                class="text-xs"
                :disabled="sensitiveMediaPrefsSaving"
                @click="persistSensitiveMediaPreferences"
              >
                {{ sensitiveMediaPrefsSaving ? t('settings.access.sensitiveMedia.saving') : t('settings.access.sensitiveMedia.save') }}
              </PinovaButton>
            </div>
            <p v-if="sensitiveMediaPrefsSaved" class="text-xs text-emerald-700">{{ t('settings.access.sensitiveMedia.saved') }}</p>
          </div>

          <div v-if="currentPlan === 'pro'" class="pt-2 border-t app-divider-subtle">
            <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
              <div class="min-w-0 flex-1 pr-1">
                <p class="text-sm font-medium text-neutral-800 dark:text-neutral-100">{{ t('settings.access.digestWeekly') }}</p>
                <p class="text-xs text-neutral-600 dark:text-neutral-300">{{ t('settings.access.digestWeekly.desc') }}</p>
              </div>
              <div class="relative shrink-0">
                <input v-model="digestWeekly" type="checkbox" class="sr-only peer" />
                <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-amber-500 rounded-full transition-colors"></div>
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
              </div>
            </label>
            <div class="flex justify-end mt-2">
              <PinovaButton
                variant="primary"
                size="sm"
                class="text-xs"
                :disabled="digestSaving"
                @click="persistDigestWeekly"
              >
                {{ digestSaving ? t('settings.access.digestSaving') : t('settings.access.digestSave') }}
              </PinovaButton>
            </div>
            <p v-if="digestSaved" class="text-xs text-emerald-700 mt-2">{{ t('settings.access.digestSaved') }}</p>
          </div>
        </div>
      </section>

      <section v-if="showSettingsSection('settings-tips')" id="settings-tips" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-4" :class="detailCardHeaderHiddenBelowLg">
          <div class="min-w-0">
            <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.tips.title') }}</h2>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.tips.subtitle') }}</p>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shrink-0 self-start">
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
          <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.tips.internalNote') }}</p>
          <template v-if="currentPlan === 'pro' && tipsEnabled">
            <div v-if="tipWalletLoading" class="text-xs text-neutral-500">{{ t('settings.tips.walletLoading') }}</div>
            <div v-else-if="tipWallet" class="space-y-4 rounded-xl border app-divider-subtle p-4">
              <div>
                <p class="text-xs text-neutral-500">{{ t('settings.tips.balance') }}</p>
                <p class="text-xl font-bold text-neutral-900 dark:text-neutral-50">
                  {{ tipWallet.balance_available }} {{ tipWallet.currency_iso }}
                </p>
                <p v-if="tipWallet.balance_reserved > 0" class="text-xs text-neutral-500 mt-1">
                  {{ t('settings.tips.reserved', { amount: tipWallet.balance_reserved, currency: tipWallet.currency_iso }) }}
                </p>
                <p class="text-xs text-neutral-500 mt-1">
                  {{ t('settings.tips.commissionInfo', { percent: tipWallet.commission_percent }) }}
                </p>
              </div>
              <div>
                <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">{{ t('settings.tips.payoutPhone') }}</label>
                <input
                  v-model="payoutPhone"
                  type="tel"
                  :placeholder="t('settings.tips.payoutPhone.placeholder')"
                  class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
              </div>
              <div>
                <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">{{ t('settings.tips.payoutLabel') }}</label>
                <input
                  v-model="payoutLabel"
                  type="text"
                  maxlength="80"
                  class="w-full px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                />
              </div>
              <button
                type="button"
                class="px-4 py-2 rounded-full bg-neutral-800 text-white text-xs font-semibold disabled:opacity-50"
                :disabled="payoutSaving"
                @click="persistPayoutSettings"
              >
                {{ payoutSaving ? t('settings.tips.saving') : t('settings.tips.savePayout') }}
              </button>
              <div class="pt-2 border-t app-divider-subtle">
                <label class="block text-xs font-medium text-neutral-600 dark:text-neutral-300 mb-1">{{ t('settings.tips.withdrawAmount') }}</label>
                <div class="flex gap-2">
                  <input
                    v-model="withdrawAmount"
                    type="number"
                    :min="tipWallet.min_withdrawal_amount"
                    class="flex-1 px-3 py-2 rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 text-sm"
                  />
                  <button
                    type="button"
                    class="px-4 py-2 rounded-full bg-amber-600 text-white text-xs font-semibold disabled:opacity-50 shrink-0"
                    :disabled="withdrawBusy"
                    @click="requestTipWithdrawal"
                  >
                    {{ t('settings.tips.withdraw') }}
                  </button>
                </div>
                <p class="text-xs text-neutral-500 mt-1">{{ t('settings.tips.withdrawNote') }}</p>
              </div>
            </div>
          </template>
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

      <section v-if="showSettingsSection('settings-ads')" id="settings-ads" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <p class="settings-subsection-label mb-2">{{ t('settings.hub.subsectionAds') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4">
          <p class="text-xs text-neutral-500 dark:text-neutral-400 rounded-lg bg-neutral-50 dark:bg-neutral-900/50 px-3 py-2">
            {{ t('pin.boost.hint') }}
          </p>
          <div class="flex flex-wrap gap-2">
            <router-link
              :to="{ name: 'boost-promote' }"
              class="inline-flex items-center gap-2 rounded-full bg-pink-700 px-4 py-2 text-xs font-semibold text-white hover:bg-pink-800"
            >
              {{ t('promote.boost.title') }}
            </router-link>
            <router-link
              :to="{ name: 'pin-promo-campaigns' }"
              class="inline-flex items-center gap-2 rounded-full border border-pink-200 px-4 py-2 text-xs font-semibold text-pink-800 dark:border-pink-500/40 dark:text-pink-200"
            >
              {{ t('promote.campaigns.title') }}
            </router-link>
          </div>
          <p class="text-xs text-neutral-500 dark:text-neutral-400">
            {{ t('settings.ads.hint.all') }}
          </p>
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.ads.network.title') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.ads.network.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="adAdsEnabled" type="checkbox" class="sr-only peer" disabled />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors peer-disabled:opacity-50"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-start sm:items-center justify-between gap-3 py-2 cursor-pointer">
            <div class="min-w-0 flex-1 pr-1">
              <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.ads.partner.title') }}</p>
              <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.ads.partner.desc') }}</p>
            </div>
            <div class="relative shrink-0">
              <input v-model="partnerAdsEnabled" type="checkbox" class="sr-only peer" disabled />
              <div class="w-11 h-6 bg-neutral-200 dark:bg-neutral-700 peer-checked:bg-pink-700 dark:peer-checked:bg-pink-600 rounded-full transition-colors peer-disabled:opacity-50"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <p v-if="currentUser?.isStaff" class="text-xs text-neutral-500 dark:text-neutral-400 mt-3">
            {{ t('settings.ads.staffHint') }}
          </p>
          <router-link
            v-if="currentUser?.isStaff"
            to="/staff/partner-ads"
            class="inline-flex items-center gap-2 text-sm font-semibold text-pink-700 dark:text-pink-400 hover:underline mt-2"
          >
            <span class="material-symbols-outlined text-lg" aria-hidden="true">campaign</span>
            {{ t('settings.nav.partnerAdsStaff') }}
          </router-link>
        </div>
      </section>

      <section
        v-if="currentUser && showSettingsSection('settings-seats')"
        id="settings-seats"
        class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b app-divider-subtle" :class="detailCardHeaderHiddenBelowLg">
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.seats.title') }}</h2>
          <p class="text-xs app-text-muted mt-0.5">{{ t('settings.seats.subtitle') }}</p>
        </div>
        <div class="p-4 sm:p-6 space-y-4 text-sm">
          <p v-if="seatHubLoading" class="text-xs text-neutral-400 dark:text-neutral-500">{{ t('settings.seats.loading') }}</p>
          <template v-else-if="seatHub">
            <!-- Invitations entrantes -->
            <div v-if="seatHub.incoming_invitations?.length" class="space-y-3 rounded-xl border border-amber-300/60 bg-amber-50/80 dark:bg-amber-950/25 p-3">
              <p class="text-xs font-semibold text-neutral-900 dark:text-neutral-100">{{ t('settings.seats.incoming') }}</p>
              <div v-for="row in seatHub.incoming_invitations" :key="row.id" class="space-y-2 app-card-soft rounded-lg p-2">
                <p class="text-xs text-neutral-700 dark:text-neutral-300">
                  {{ row.owner_display_name || row.owner_username }}
                  <span class="text-neutral-400 dark:text-neutral-500">(@{{ row.owner_username }})</span>
                </p>
                <div class="flex flex-wrap gap-2">
                  <PinovaButton
                    variant="primary"
                    size="sm"
                    class="text-[11px]"
                    :disabled="seatBusy"
                    @click="respondSeatInvite(row.id, 'accept')"
                  >
                    {{ t('settings.seats.accept') }}
                  </PinovaButton>
                  <PinovaButton
                    variant="secondary"
                    size="sm"
                    class="text-[11px]"
                    :disabled="seatBusy"
                    @click="respondSeatInvite(row.id, 'decline')"
                  >
                    {{ t('settings.seats.decline') }}
                  </PinovaButton>
                </div>
              </div>
            </div>

            <template v-if="seatHub.role === 'member'">
              <p class="text-xs text-neutral-700 dark:text-neutral-300">
                {{ t('settings.seats.memberOf', { username: seatHub.sponsor_display_name || seatHub.sponsor_username || '' }) }}
              </p>
              <PinovaButton
                variant="primary"
                size="sm"
                class="text-xs"
                :disabled="seatBusy"
                @click="leaveSeatGroup"
              >
                {{ t('settings.seats.leave') }}
              </PinovaButton>
            </template>

            <template v-else-if="seatHub.role === 'owner'">
              <p class="text-xs text-neutral-600 dark:text-neutral-300">
                {{
                  t('settings.seats.ownerSummary', {
                    used: seatHub.used_slots,
                    max: seatHub.max_invitees,
                    bundle: seatHub.seat_bundle,
                  })
                }}
              </p>
              <div class="space-y-2">
                <PinovaButton
                  variant="secondary"
                  class="w-full sm:w-auto inline-flex items-center justify-center gap-2 rounded-xl text-xs border-pink-300 text-pink-700 dark:text-pink-600"
                  :disabled="seatBusy"
                  @click="seatInviteSearchOpen = true"
                >
                  <span class="material-symbols-outlined text-lg" aria-hidden="true">person_search</span>
                  {{ t('settings.seats.inviteSearchMember') }}
                </PinovaButton>
              </div>
              <p v-if="seatHub.members?.length" class="text-xs font-semibold text-neutral-800 dark:text-neutral-100 pt-2">{{ t('settings.seats.members') }}</p>
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
              <p v-if="seatHub.pending_invitations?.length" class="text-xs font-semibold text-neutral-800 dark:text-neutral-100 pt-2">{{ t('settings.seats.pendingOut') }}</p>
              <ul v-if="seatHub.pending_invitations?.length" class="space-y-1">
                <li
                  v-for="p in seatHub.pending_invitations"
                  :key="p.id"
                  class="flex flex-col gap-2 text-xs py-2 border-b app-divider-subtle sm:flex-row sm:items-center sm:justify-between sm:gap-2 sm:py-1"
                >
                  <span class="min-w-0 truncate">@{{ p.invitee_username }}</span>
                  <button
                    type="button"
                    class="text-neutral-600 dark:text-neutral-300 font-semibold disabled:opacity-50 self-start sm:self-auto"
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
              <p v-if="!seatHub.incoming_invitations?.length" class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.seats.none') }}</p>
            </template>
          </template>
        </div>
      </section>

      <section v-if="showSettingsSection('settings-subscription')" id="settings-subscription" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-wrap items-start justify-between gap-3" :class="detailCardHeaderHiddenBelowLg">
          <div class="min-w-0">
            <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.subscription.title') }}</h2>
            <p class="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{{ t('settings.subscription.subtitle') }}</p>
            <router-link
              v-if="currentUser?.subscription?.hasBillingHistory !== false"
              to="/billing"
              class="inline-flex mt-2 text-xs font-semibold text-pink-700 hover:underline"
            >
              {{ t('settings.subscription.viewBillingPage') }} →
            </router-link>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 dark:bg-neutral-800 text-neutral-600 dark:text-neutral-300 shrink-0">
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
            <PinovaButton variant="primary" size="sm" :to="{ name: 'premium' }">
              {{ t('settings.subscription.managePlans') }}
            </PinovaButton>
            <PinovaButton
              variant="primary"
              size="sm"
              :disabled="subscriptionActionPending || currentPlan === 'free'"
              :loading="subscriptionActionPending"
              @click="handleCancelAtPeriodEnd"
            >
              {{ t('settings.subscription.cancelAtEnd') }}
            </PinovaButton>
            <PinovaButton
              v-if="currentPlan === 'pro'"
              variant="secondary"
              size="sm"
              :disabled="subscriptionActionPending"
              :loading="subscriptionActionPending"
              @click="handleSchedulePlusAtRenewal"
            >
              {{ t('settings.subscription.scheduleToPlus') }}
            </PinovaButton>
            <PinovaButton
              v-if="currentUser?.subscription?.scheduledPlan"
              variant="ghost"
              size="sm"
              :disabled="subscriptionActionPending"
              @click="handleClearPlannedChange"
            >
              {{ t('settings.subscription.clearSchedule') }}
            </PinovaButton>
            <PinovaButton
              variant="secondary"
              size="sm"
              :disabled="subscriptionActionPending"
              :loading="subscriptionActionPending"
              @click="handleReactivateSubscription"
            >
              {{ t('settings.subscription.reactivate') }}
            </PinovaButton>
          </div>
          <p v-if="subscriptionActionMessage" class="text-xs text-neutral-600 dark:text-neutral-300">{{ subscriptionActionMessage }}</p>

          <div
            v-if="currentUser?.subscription?.hasBillingHistory !== false"
            class="pt-4 mt-4 border-t border-neutral-100 dark:border-neutral-800"
          >
            <div class="flex flex-wrap items-center justify-between gap-2 mb-2">
              <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-100">{{ t('settings.subscription.billingHistory') }}</p>
              <router-link to="/billing" class="text-[11px] font-semibold text-pink-700 hover:underline">
                {{ t('settings.subscription.viewBillingPage') }}
              </router-link>
            </div>
            <div v-if="billingInvoicesLoading" aria-busy="true">
              <span class="sr-only">{{ t('settings.subscription.billingLoading') }}</span>
              <BillingInvoicesSkeleton />
            </div>
            <div v-else-if="!billingInvoices.length" class="text-xs text-neutral-400 dark:text-neutral-500">{{ t('settings.subscription.billingEmpty') }}</div>
            <ul v-else class="space-y-2 max-h-64 overflow-y-auto pr-1">
              <li
                v-for="inv in billingInvoices"
                :key="inv.id"
                class="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
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
                    class="text-[11px] font-semibold text-neutral-700 dark:text-neutral-300 hover:underline"
                  >
                    {{ t('settings.subscription.openCheckout') }}
                  </a>
                </div>
              </li>
            </ul>
          </div>
        </div>
      </section>

      <section v-if="showSettingsSection('settings-support')" id="settings-support" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800" :class="detailCardHeaderHiddenBelowLg">
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.support.title') }}</h2>
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
          <div v-if="supportTickets.length" class="space-y-2 pt-2 border-t border-neutral-100 dark:border-neutral-800">
            <p class="text-xs font-semibold text-neutral-700 dark:text-neutral-200">{{ t('settings.support.history') }}</p>
            <div
              v-for="ticket in supportTickets.slice(0, 5)"
              :key="ticket.id"
              class="rounded-xl border border-neutral-200 dark:border-neutral-700 px-3 py-2"
            >
              <p class="text-xs font-semibold text-neutral-800 dark:text-neutral-100">{{ ticket.subject }}</p>
              <p class="text-[11px] text-neutral-500 dark:text-neutral-400">
                {{ supportTicketStatusLabel(ticket.status) }} · {{ supportTicketPriorityLabel(ticket.priority) }}
              </p>
            </div>
          </div>
        </div>
      </section>

      <section v-if="showSettingsSection('settings-legal')" id="settings-legal" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800">
          <p class="settings-subsection-label mb-2">{{ t('settings.hub.subsectionLegalLinks') }}</p>
        </div>
        <div class="divide-y divide-neutral-100 dark:divide-neutral-800">
          <RouterLink to="/faq" class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-rose-500/5 transition">
            <span class="material-symbols-outlined text-[20px] text-rose-600 dark:text-rose-400">help</span>
            {{ t('nav.faq') }}
          </RouterLink>
          <RouterLink to="/legal/privacy" class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-rose-500/5 transition">
            <span class="material-symbols-outlined text-[20px] text-rose-600 dark:text-rose-400">shield</span>
            {{ t('legal.badgePrivacy') }}
          </RouterLink>
          <RouterLink to="/legal/terms" class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-rose-500/5 transition">
            <span class="material-symbols-outlined text-[20px] text-rose-600 dark:text-rose-400">description</span>
            {{ t('legal.badgeTerms') }}
          </RouterLink>
          <RouterLink to="/contact" class="flex items-center gap-3 px-4 py-3.5 text-sm font-medium text-neutral-800 dark:text-neutral-100 hover:bg-rose-500/5 transition">
            <span class="material-symbols-outlined text-[20px] text-rose-600 dark:text-rose-400">mail</span>
            {{ t('app.footer.contact') }}
          </RouterLink>
        </div>
      </section>

      <!-- Password section -->
      <section v-if="showSettingsSection('settings-password')" id="settings-password" class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl overflow-hidden">
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-neutral-100 dark:border-neutral-800 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between" :class="detailCardHeaderHiddenBelowLg">
          <div class="min-w-0 flex-1">
            <h2 v-if="!detailSectionId" class="text-lg font-semibold text-neutral-900 dark:text-neutral-50">{{ t('settings.password.title') }}</h2>
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
          <PinovaButton variant="primary" class="text-sm w-full sm:w-auto" @click="openInitialPasswordModal">
            {{ t('settings.password.socialBannerCta') }}
          </PinovaButton>
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
        v-if="showSettingsSection('settings-danger')" id="settings-danger"
        class="app-card scroll-mt-[min(46vh,20.5rem)] lg:scroll-mt-44 rounded-2xl border-pink-300/55 overflow-hidden mt-auto pt-8"
      >
        <div class="px-4 py-4 sm:px-6 sm:py-5 border-b border-pink-300/50 dark:border-pink-700/50">
          <h2 v-if="!detailSectionId" class="text-lg font-semibold text-pink-700 dark:text-pink-600">{{ t('settings.danger.title') }}</h2>
        </div>
        <div
          v-if="scheduledAccountDeletion"
          class="p-4 sm:p-6 border-b border-rose-200/60 dark:border-rose-800/50 bg-rose-50/90 dark:bg-rose-950/30"
        >
          <p class="font-semibold text-sm text-rose-950 dark:text-rose-100">{{ t('settings.danger.delete.bannerTitle') }}</p>
          <p class="mt-1 text-xs leading-relaxed text-rose-900 dark:text-rose-100/90">
            {{ t('settings.danger.delete.bannerBody', { date: scheduledAccountDeletionLabel }) }}
          </p>
          <PinovaButton
            variant="secondary"
            size="sm"
            class="mt-3 border-rose-200 dark:border-rose-700/70 text-rose-900 dark:text-rose-300 hover:bg-rose-100 dark:hover:bg-rose-900/30"
            :disabled="accountDeletionBusy"
            @click="cancelAccountDeletion()"
          >
            {{ t('settings.danger.delete.cancelSchedule') }}
          </PinovaButton>
        </div>
        <div class="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-pink-200/45 dark:border-pink-800/40">
          <div>
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.gdpr.exportTitle') }}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.gdpr.exportDesc') }}</p>
          </div>
          <PinovaButton
            variant="secondary"
            class="text-sm border-pink-300 text-pink-700 dark:text-pink-600"
            :disabled="dataExportBusy"
            data-testid="settings-export-data"
            @click="requestDataExport()"
          >
            {{ t('settings.gdpr.exportCta') }}
          </PinovaButton>
        </div>
        <div class="p-4 sm:p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4 border-b border-pink-200/45 dark:border-pink-800/40">
          <div>
            <p class="text-sm font-medium text-neutral-700 dark:text-neutral-200">{{ t('settings.danger.logout') }}</p>
            <p class="text-xs text-neutral-500 dark:text-neutral-400">{{ t('settings.danger.logout.desc') }}</p>
          </div>
          <PinovaButton
            variant="secondary"
            class="text-sm border-pink-300 text-pink-700 dark:text-pink-600"
            @click="handleLogout"
          >
            {{ t('settings.danger.logout.cta') }}
          </PinovaButton>
        </div>
        <div class="p-4 sm:p-6 flex flex-col sm:flex-row items-start gap-4 bg-rose-50/45 dark:bg-rose-950/20">
          <div class="max-w-xl flex-1 space-y-2">
            <p class="text-sm font-bold text-rose-900">{{ t('settings.danger.delete.title') }}</p>
            <p class="text-xs text-neutral-700 leading-relaxed">{{ t('settings.danger.delete.warningBody') }}</p>
          </div>
          <div class="w-full sm:w-auto shrink-0 flex flex-col gap-2">
            <PinovaButton
              variant="danger"
              class="text-sm text-center"
              :disabled="accountDeletionBusy || !!scheduledAccountDeletion"
              @click="requestAccountDeletion()"
            >
              {{ t('settings.danger.delete.scheduleCta') }}
            </PinovaButton>
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
          <PinovaButton variant="secondary" size="sm" @click="closeInitialPasswordModal">
            {{ t('common.cancel') }}
          </PinovaButton>
          <PinovaButton
            variant="primary"
            size="sm"
            :disabled="initialPwBusy || !initialPw1 || !initialPw2"
            @click="submitInitialPassword"
          >
            {{ initialPwBusy ? t('settings.password.submitting') : t('settings.password.setInitialSubmit') }}
          </PinovaButton>
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

<style scoped>
.settings-detail-orb {
  position: absolute;
  border-radius: 9999px;
  filter: blur(80px);
  opacity: 0.42;
  pointer-events: none;
}
.settings-detail-orb--rose {
  width: 260px;
  height: 260px;
  top: -48px;
  left: -36px;
  background: rgba(244, 63, 94, 0.34);
}
.settings-detail-orb--violet {
  width: 220px;
  height: 220px;
  top: 140px;
  right: -44px;
  background: rgba(139, 92, 246, 0.26);
}
.pinova-settings-detail-sections :deep(section) {
  backdrop-filter: blur(24px);
  -webkit-backdrop-filter: blur(24px);
}
.settings-subsection-label {
  margin-top: 0;
  margin-bottom: 0.35rem;
  font-size: 0.7rem;
  font-weight: 800;
  letter-spacing: 0.08em;
  text-transform: uppercase;
}
</style>
