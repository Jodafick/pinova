<script setup lang="ts">
import { ref, onMounted, computed } from 'vue'
import { useRouter } from 'vue-router'
import { useAuth } from '../composables/useAuth'
import { useI18n } from '../i18n'
import api from '../api'
import { displayInitials } from '../utils/displayInitials'
import { useDataSaver } from '../composables/useDataSaver'
import type { DataSaverOverride } from '../composables/useDataSaver'

const router = useRouter()
const { currentUser, updateProfile, logout, manageSubscription, fetchSupportTickets, createSupportTicket, fetchSubscriptionInvoices } = useAuth()
const { t, currentLang } = useI18n()
const {
  override: dataSaverOverride,
  isLowDataMode,
  setOverride: setDataSaverOverride,
} = useDataSaver()

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
const adPrefsSaving = ref(false)
const adAdsEnabled = ref(true)
const partnerAdsEnabled = ref(true)
const adPrefsSaved = ref(false)
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
const supportSubject = ref('')
const supportMessage = ref('')
const supportSubmitting = ref(false)
const supportTickets = ref<any[]>([])

const currentPlan = ref<'free' | 'plus' | 'pro'>('free')

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

const urlBase64ToUint8Array = (base64String: string) => {
  const padding = '='.repeat((4 - (base64String.length % 4)) % 4)
  const base64 = (base64String + padding).replace(/-/g, '+').replace(/_/g, '/')
  const rawData = window.atob(base64)
  const outputArray = new Uint8Array(rawData.length)
  for (let i = 0; i < rawData.length; ++i) {
    outputArray[i] = rawData.charCodeAt(i)
  }
  return outputArray
}

const syncWebNotificationState = async () => {
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    webNotificationsEnabled.value = false
    return
  }
  if (Notification.permission !== 'granted') {
    webNotificationsEnabled.value = false
    return
  }
  try {
    const keyResp = await api.get('notifications/push_public_key/')
    const publicKey = String(keyResp.data?.public_key || '')
    const enabled = !!keyResp.data?.enabled && !!publicKey
    if (!enabled) {
      webNotificationsEnabled.value = false
      return
    }
    const registration = await navigator.serviceWorker.register('/pinova-push-sw.js', { scope: '/push/' })
    const existingSub = await registration.pushManager.getSubscription()
    if (!existingSub) {
      webNotificationsEnabled.value = false
      return
    }
    webNotificationsEnabled.value = true
  } catch {
    webNotificationsEnabled.value = false
  }
}

const activateWebNotifications = async () => {
  if (webNotificationsLoading.value) return
  if (typeof window === 'undefined' || !('serviceWorker' in navigator) || !('PushManager' in window)) {
    webNotificationsError.value = t('settings.notifications.web.errorUnsupported')
    return
  }
  webNotificationsLoading.value = true
  webNotificationsError.value = ''
  try {
    const permission = await Notification.requestPermission()
    if (permission !== 'granted') {
      webNotificationsEnabled.value = false
      webNotificationsError.value = t('settings.notifications.web.errorDenied')
      return
    }
    const keyResp = await api.get('notifications/push_public_key/')
    const publicKey = String(keyResp.data?.public_key || '')
    const enabled = !!keyResp.data?.enabled && !!publicKey
    if (!enabled) {
      webNotificationsError.value = t('settings.notifications.web.errorUnavailable')
      return
    }
    const registration = await navigator.serviceWorker.register('/pinova-push-sw.js', { scope: '/push/' })
    const existingSub = await registration.pushManager.getSubscription()
    const subscription = existingSub || await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(publicKey),
    })
    const json = subscription.toJSON() as any
    await api.post('notifications/push_subscribe/', {
      endpoint: json.endpoint,
      p256dh: json.keys?.p256dh,
      auth: json.keys?.auth,
    })
    webNotificationsEnabled.value = true
  } catch {
    webNotificationsError.value = t('settings.notifications.web.errorGeneric')
  } finally {
    webNotificationsLoading.value = false
  }
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
    adAdsEnabled.value = currentUser.value.subscription?.adAdsEnabled ?? true
    partnerAdsEnabled.value = currentUser.value.subscription?.partnerAdsEnabled ?? true
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
  enforceAdPreferencesByPlan()
  void loadSupportTickets()
  void loadBillingInvoices()
})

const canToggleAdAds = () => currentPlan.value === 'plus' || currentPlan.value === 'pro'
const canTogglePartnerAds = () => currentPlan.value === 'pro'

const enforceAdPreferencesByPlan = () => {
  if (currentPlan.value === 'free') {
    adAdsEnabled.value = true
    partnerAdsEnabled.value = true
    return
  }
  if (currentPlan.value === 'plus') {
    partnerAdsEnabled.value = true
  }
}

const persistAdPreferences = async () => {
  adPrefsSaving.value = true
  try {
    enforceAdPreferencesByPlan()
    await updateProfile({
      adAdsEnabled: adAdsEnabled.value,
      partnerAdsEnabled: partnerAdsEnabled.value,
    })
    currentPlan.value = currentUser.value?.subscription?.plan || currentPlan.value
    adAdsEnabled.value = currentUser.value?.subscription?.adAdsEnabled ?? adAdsEnabled.value
    partnerAdsEnabled.value = currentUser.value?.subscription?.partnerAdsEnabled ?? partnerAdsEnabled.value
    adPrefsSaved.value = true
    setTimeout(() => (adPrefsSaved.value = false), 2500)
  } catch (err) {
    console.error('Failed to save ad preferences:', err)
  } finally {
    adPrefsSaving.value = false
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
    saved.value = true
    setTimeout(() => (saved.value = false), 3000)
    currentPlan.value = currentUser.value?.subscription?.plan || 'free'
    adAdsEnabled.value = currentUser.value?.subscription?.adAdsEnabled ?? adAdsEnabled.value
    partnerAdsEnabled.value = currentUser.value?.subscription?.partnerAdsEnabled ?? partnerAdsEnabled.value
    enforceAdPreferencesByPlan()
  } catch (err) {
    console.error('Failed to update profile:', err)
  } finally {
    saving.value = false
  }
}

const adSectionHint = () => {
  if (currentPlan.value === 'pro') return t('settings.ads.hint.pro')
  if (currentPlan.value === 'plus') return t('settings.ads.hint.plus')
  return t('settings.ads.hint.free')
}

const handlePasswordChange = async () => {
  passwordError.value = ''
  if (newPassword.value !== confirmNewPassword.value) {
    passwordError.value = t('settings.password.error.mismatch')
    return
  }

  passwordChanging.value = true
  try {
    // dj-rest-auth provides auth/password/change/
    const api = (await import('../api')).default
    await api.post('auth/password/change/', {
      old_password: oldPassword.value,
      new_password1: newPassword.value,
      new_password2: confirmNewPassword.value
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

const loadSupportTickets = async () => {
  if (!currentUser.value) return
  try {
    supportTickets.value = await fetchSupportTickets()
  } catch {
    supportTickets.value = []
  }
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

const handleLogout = () => {
  logout()
  router.push('/login')
}
</script>

<template>
  <div class="max-w-3xl mx-auto px-4 sm:px-6 py-8 sm:py-12">
    <h1 class="text-2xl sm:text-3xl font-bold text-neutral-900 mb-2">{{ t('settings.title') }}</h1>
    <p class="text-sm text-neutral-500 mb-8">{{ t('settings.subtitle') }}</p>

    <!-- Success message -->
    <div
      v-if="saved"
      class="mb-6 flex items-center gap-2 px-4 py-3 rounded-xl bg-green-50 border border-green-200 text-green-700 text-sm"
    >
      <span class="material-symbols-outlined text-lg">check_circle</span>
      {{ t('settings.saved') }}
    </div>

    <div class="space-y-8">
      <!-- Profile section -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.profile.title') }}</h2>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.profile.subtitle') }}</p>
        </div>

        <div class="p-6 space-y-5">
          <!-- Avatar -->
          <div class="flex items-center gap-5">
            <div
              v-if="currentUser"
              class="w-20 h-20 rounded-full flex items-center justify-center text-3xl font-bold text-white shrink-0 overflow-hidden"
              :class="currentUser.avatarColor"
            >
              <img v-if="avatarPreview" :src="avatarPreview" class="w-full h-full object-cover" />
              <span v-else class="text-center leading-none px-1">{{ displayInitials(displayName) }}</span>
            </div>
            <div>
              <input 
                ref="fileInput"
                type="file" 
                accept="image/*" 
                class="hidden" 
                @change="handleFileChange" 
              />
              <button
                class="px-4 py-2 rounded-full bg-neutral-100 text-sm font-medium text-neutral-700 hover:bg-neutral-200 transition"
                @click="triggerFileInput"
              >
                {{ t('settings.profile.changePhoto') }}
              </button>
              <p class="text-xs text-neutral-400 mt-1">{{ t('settings.profile.photoHint') }}</p>
            </div>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.profile.fullName') }}</label>
              <input
                v-model="displayName"
                type="text"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.profile.username') }}</label>
              <div class="relative">
                <span class="absolute left-4 top-1/2 -translate-y-1/2 text-neutral-400 text-sm">@</span>
                <input
                  v-model="username"
                  type="text"
                  class="w-full pl-8 pr-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
                />
              </div>
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.profile.bio') }}</label>
            <textarea
              v-model="bio"
              rows="3"
              :placeholder="t('settings.profile.bioPlaceholder')"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition resize-none placeholder:text-neutral-400"
            />
            <p class="text-xs text-neutral-400 mt-1">{{ t('settings.profile.bioCount', { count: bio.length }) }}</p>
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.profile.email') }}</label>
              <input
                v-model="email"
                type="email"
                autocomplete="email"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.profile.birthDate') }}</label>
              <input
                v-model="birthDate"
                type="date"
                autocomplete="bday"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
          </div>

          <div>
            <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.profile.currency') }}</label>
            <select
              v-model="preferredCurrency"
              class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
            >
              <option
                v-for="currency in supportedCurrencies"
                :key="currency"
                :value="currency"
              >
                {{ currencyOptionLabel(currency) }}
              </option>
            </select>
            <p class="text-xs text-neutral-400 mt-1">
              {{ t('settings.profile.detectedCountry', { country: detectedCountryCode || 'N/A' }) }}
            </p>
          </div>

          <div class="flex justify-end">
            <button
              class="px-6 py-2.5 rounded-full bg-pink-600 text-white text-sm font-semibold hover:bg-pink-700 disabled:opacity-50 transition flex items-center gap-2"
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
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.notifications.title') }}</h2>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.notifications.subtitle') }}</p>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.notifications.followers') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.notifications.followers.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="notificationsFollowers" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.notifications.saves') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.notifications.saves.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="notificationsSaves" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.notifications.recommendations') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.notifications.recommendations.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="notificationsRecommendations" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <div class="rounded-xl border border-neutral-200 p-4 flex items-center justify-between gap-4">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.notifications.web.title') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.notifications.web.desc') }}</p>
            </div>
            <button
              class="px-4 py-2 rounded-full text-xs font-semibold transition"
              :class="webNotificationsEnabled ? 'bg-emerald-100 text-emerald-700' : 'bg-neutral-900 text-white hover:bg-neutral-800'"
              :disabled="webNotificationsLoading || webNotificationsEnabled"
              @click="activateWebNotifications"
            >
              {{
                webNotificationsEnabled
                  ? t('settings.notifications.web.enabled')
                  : (webNotificationsLoading ? t('settings.notifications.web.activating') : t('settings.notifications.web.enable'))
              }}
            </button>
          </div>
          <p v-if="webNotificationsError" class="text-xs text-pink-600">{{ webNotificationsError }}</p>
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
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.privacy.title') }}</h2>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.privacy.private') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.privacy.private.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="privateProfile" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.privacy.search') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.privacy.search.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="discoverableProfile" type="checkbox" class="sr-only peer" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>
        </div>
        <div class="px-6 pb-6 flex items-center justify-end gap-2">
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

      <!-- Accessibilité & données -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.access.title') }}</h2>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.access.subtitle') }}</p>
        </div>
        <div class="p-6 space-y-4">
          <div>
            <p class="text-sm font-medium text-neutral-800 mb-2">{{ t('settings.access.dataSaver') }}</p>
            <p class="text-xs text-neutral-600 mb-3">{{ t('settings.access.dataSaver.desc') }}</p>
            <div class="flex flex-wrap gap-2">
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                :class="dataSaverOverride === 'auto' ? 'border-pink-500 bg-pink-50 text-pink-900' : 'border-neutral-200 text-neutral-600'"
                @click="handleDataSaverMode('auto')"
              >
                {{ t('settings.access.dataSaver.auto') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                :class="dataSaverOverride === 'on' ? 'border-pink-500 bg-pink-50 text-pink-900' : 'border-neutral-200 text-neutral-600'"
                @click="handleDataSaverMode('on')"
              >
                {{ t('settings.access.dataSaver.on') }}
              </button>
              <button
                type="button"
                class="px-3 py-1.5 rounded-full text-xs font-semibold border transition"
                :class="dataSaverOverride === 'off' ? 'border-pink-500 bg-pink-50 text-pink-900' : 'border-neutral-200 text-neutral-600'"
                @click="handleDataSaverMode('off')"
              >
                {{ t('settings.access.dataSaver.off') }}
              </button>
            </div>
            <p class="text-[11px] text-neutral-600 mt-2">{{ t('settings.access.dataSaver.hint', { active: isLowDataMode ? t('settings.access.dataSaver.yes') : t('settings.access.dataSaver.no') }) }}</p>
          </div>

          <div v-if="currentPlan === 'pro'" class="pt-2 border-t border-neutral-100">
            <label class="flex items-center justify-between py-2 cursor-pointer">
              <div>
                <p class="text-sm font-medium text-neutral-800">{{ t('settings.access.digestWeekly') }}</p>
                <p class="text-xs text-neutral-600">{{ t('settings.access.digestWeekly.desc') }}</p>
              </div>
              <div class="relative">
                <input v-model="digestWeekly" type="checkbox" class="sr-only peer" />
                <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-amber-500 rounded-full transition-colors"></div>
                <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
              </div>
            </label>
            <div class="flex justify-end mt-2">
              <button
                type="button"
                class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50"
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

      <!-- Ads preferences -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.ads.title') }}</h2>
            <p class="text-xs text-neutral-500 mt-0.5">{{ adSectionHint() }}</p>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
            {{ currentPlan.toUpperCase() }}
          </span>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.ads.network.title') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.ads.network.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="adAdsEnabled" type="checkbox" class="sr-only peer" :disabled="!canToggleAdAds()" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>

          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.ads.partner.title') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.ads.partner.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="partnerAdsEnabled" type="checkbox" class="sr-only peer" :disabled="!canTogglePartnerAds()" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
              <div class="absolute top-0.5 left-0.5 w-5 h-5 bg-white rounded-full shadow peer-checked:translate-x-5 transition-transform"></div>
            </div>
          </label>

          <div class="flex items-center justify-between pt-2">
            <p class="text-xs text-neutral-500">
              {{ t('settings.ads.note') }}
            </p>
            <button
              class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
              :disabled="adPrefsSaving"
              @click="persistAdPreferences"
            >
              {{ adPrefsSaving ? t('settings.ads.saving') : t('settings.ads.save') }}
            </button>
          </div>
          <p v-if="adPrefsSaved" class="text-xs text-emerald-700">{{ t('settings.ads.saved') }}</p>
        </div>
      </section>

      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.tips.title') }}</h2>
            <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.tips.subtitle') }}</p>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
            {{ currentPlan.toUpperCase() }}
          </span>
        </div>
        <div class="p-6 space-y-4">
          <label class="flex items-center justify-between py-2 cursor-pointer">
            <div>
              <p class="text-sm font-medium text-neutral-700">{{ t('settings.tips.enable') }}</p>
              <p class="text-xs text-neutral-500">{{ t('settings.tips.enable.desc') }}</p>
            </div>
            <div class="relative">
              <input v-model="tipsEnabled" type="checkbox" class="sr-only peer" :disabled="currentPlan !== 'pro'" />
              <div class="w-11 h-6 bg-neutral-200 peer-checked:bg-pink-500 rounded-full transition-colors"></div>
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
              class="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm disabled:bg-neutral-50 disabled:text-neutral-400"
            />
          </div>
          <div class="flex items-center justify-between pt-1">
            <p class="text-xs text-neutral-500">{{ t('settings.tips.note') }}</p>
            <button
              class="px-4 py-2 rounded-full bg-neutral-900 text-white text-xs font-semibold hover:bg-neutral-800 disabled:opacity-50 transition"
              :disabled="tipsSaving"
              @click="persistTipsSettings"
            >
              {{ tipsSaving ? t('settings.tips.saving') : t('settings.tips.save') }}
            </button>
          </div>
          <p v-if="tipsSaved" class="text-xs text-emerald-700">{{ t('settings.tips.saved') }}</p>
        </div>
      </section>

      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.subscription.title') }}</h2>
            <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.subscription.subtitle') }}</p>
          </div>
          <span class="text-[11px] font-bold uppercase tracking-wider px-2 py-1 rounded-full bg-neutral-100 text-neutral-600">
            {{ currentPlan.toUpperCase() }}
          </span>
        </div>
        <div class="p-6 space-y-3">
          <p class="text-xs text-neutral-500">
            {{ t('settings.subscription.renewal', { date: subscriptionRenewalLabel }) }}
          </p>
          <p v-if="subscriptionScheduleHint" class="text-xs text-amber-800 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2 mt-2">
            {{ subscriptionScheduleHint }}
          </p>
          <div class="flex flex-wrap gap-2">
            <router-link
              to="/premium"
              class="px-4 py-2 rounded-full bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 transition inline-flex items-center"
            >
              {{ t('settings.subscription.managePlans') }}
            </router-link>
            <button
              class="px-4 py-2 rounded-full bg-pink-600 text-white text-xs font-semibold hover:bg-pink-700 disabled:opacity-50 transition"
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
            <p class="text-xs font-semibold text-neutral-800 mb-2">{{ t('settings.subscription.billingHistory') }}</p>
            <p v-if="billingInvoicesLoading" class="text-xs text-neutral-400">{{ t('settings.subscription.billingLoading') }}</p>
            <div v-else-if="!billingInvoices.length" class="text-xs text-neutral-400">{{ t('settings.subscription.billingEmpty') }}</div>
            <ul v-else class="space-y-2 max-h-64 overflow-y-auto pr-1">
              <li
                v-for="inv in billingInvoices"
                :key="inv.id"
                class="rounded-xl border border-neutral-200 px-3 py-2 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2"
              >
                <div>
                  <p class="text-xs font-semibold text-neutral-800">
                    {{ inv.plan.toUpperCase() }} · {{ inv.billing_cycle }} · {{ invoiceAmountLabel(inv) }}
                  </p>
                  <p class="text-[11px] text-neutral-500">
                    {{ formatInvoiceWhen(inv.created_at) }} · {{ inv.status }}
                    <span v-if="inv.promo_bundle && inv.promo_bundle !== 'solo'"> · {{ inv.promo_bundle }}</span>
                  </p>
                </div>
                <div class="flex flex-wrap gap-2 shrink-0">
                  <a
                    v-if="inv.invoice_url"
                    :href="inv.invoice_url"
                    target="_blank"
                    rel="noopener noreferrer"
                    class="text-[11px] font-semibold text-pink-600 hover:underline"
                  >
                    {{ t('settings.subscription.openReceipt') }}
                  </a>
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

      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100">
          <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.support.title') }}</h2>
          <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.support.subtitle') }}</p>
        </div>
        <div class="p-6 space-y-3">
          <input
            v-model="supportSubject"
            type="text"
            :placeholder="t('settings.support.subject')"
            class="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm"
          />
          <textarea
            v-model="supportMessage"
            rows="3"
            :placeholder="t('settings.support.message')"
            class="w-full px-3 py-2 rounded-xl border border-neutral-200 text-sm resize-none"
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
              <p class="text-[11px] text-neutral-500">{{ ticket.status }} · {{ ticket.priority }}</p>
            </div>
          </div>
        </div>
      </section>

      <!-- Password section -->
      <section class="bg-white rounded-2xl border border-neutral-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-neutral-100 flex items-center justify-between">
          <div>
            <h2 class="text-lg font-semibold text-neutral-900">{{ t('settings.password.title') }}</h2>
            <p class="text-xs text-neutral-500 mt-0.5">{{ t('settings.password.subtitle') }}</p>
          </div>
          <div v-if="passwordSaved" class="text-green-600 flex items-center gap-1 text-xs font-bold animate-fade-in">
            <span class="material-symbols-outlined text-sm">check_circle</span>
            {{ t('settings.password.saved') }}
          </div>
        </div>

        <div class="p-6 space-y-5">
          <div v-if="passwordError" class="px-4 py-3 rounded-xl bg-pink-50 border border-pink-100 text-pink-600 text-xs">
            {{ passwordError }}
          </div>

          <div class="grid grid-cols-1 sm:grid-cols-3 gap-5">
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.password.current') }}</label>
              <input
                v-model="oldPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.password.new') }}</label>
              <input
                v-model="newPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
              />
            </div>
            <div>
              <label class="block text-sm font-medium text-neutral-700 mb-1.5">{{ t('settings.password.confirm') }}</label>
              <input
                v-model="confirmNewPassword"
                type="password"
                placeholder="••••••••"
                class="w-full px-4 py-3 rounded-xl border border-neutral-200 text-sm focus:outline-none focus:ring-2 focus:ring-pink-500 focus:border-transparent transition"
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

      <!-- Danger zone -->
      <section class="bg-white rounded-2xl border border-pink-100 shadow-sm overflow-hidden">
        <div class="px-6 py-5 border-b border-pink-100">
          <h2 class="text-lg font-semibold text-pink-600">{{ t('settings.danger.title') }}</h2>
        </div>
        <div class="p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
          <div>
            <p class="text-sm font-medium text-neutral-700">{{ t('settings.danger.logout') }}</p>
            <p class="text-xs text-neutral-500">{{ t('settings.danger.logout.desc') }}</p>
          </div>
          <button
            class="px-5 py-2.5 rounded-full border border-pink-200 text-pink-600 text-sm font-semibold hover:bg-pink-50 transition"
            @click="handleLogout"
          >
            {{ t('settings.danger.logout.cta') }}
          </button>
        </div>
      </section>
    </div>
  </div>
</template>
