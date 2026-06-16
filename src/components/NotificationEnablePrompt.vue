<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import FotoceModal from './ui/FotoceModal.vue'
import FotoceButton from './ui/FotoceButton.vue'
import { useI18n } from '../i18n'
import api from '../api/index'
import {
  activateWebPushNotifications,
  isWebPushSupported,
  type WebPushActivateError,
} from '../utils/webPushClient'
import { notificationPromptMarkCompleted } from '../composables/useNotificationPrompt'
import { pushToast } from '../composables/useToast'

const props = defineProps<{ open: boolean }>()
const emit = defineEmits<{
  'update:open': [boolean]
  snooze: []
  decline: []
}>()

const { t } = useI18n()
const promptBody = computed(() => t('notifications.prompt.body'))
const loading = ref(false)
const error = ref('')

watch(
  () => props.open,
  (v) => {
    if (v) error.value = ''
  },
)

function close() {
  emit('update:open', false)
}

async function onEnable() {
  if (!isWebPushSupported()) {
    error.value = t('settings.notifications.web.errorUnsupported')
    return
  }
  loading.value = true
  error.value = ''
  const result = await activateWebPushNotifications(api)
  loading.value = false
  if (result.ok) {
    notificationPromptMarkCompleted()
    pushToast({ message: t('notifications.prompt.enabledToast'), kind: 'success' })
    close()
    return
  }
  const map: Record<WebPushActivateError, string> = {
    unsupported: t('settings.notifications.web.errorUnsupported'),
    denied: t('settings.notifications.web.errorDenied'),
    unavailable: t('settings.notifications.web.errorUnavailable'),
    generic: t('settings.notifications.web.errorGeneric'),
  }
  error.value = map[result.error]
}

function onLater() {
  emit('snooze')
  close()
}

function onDecline() {
  emit('decline')
  close()
}
</script>

<template>
  <FotoceModal
    :open="open"
    presentation="bottomSheet"
    presentation-lg="center"
    :presentation-lg-min-width="1024"
    :title="t('notifications.prompt.title')"
    @update:open="emit('update:open', $event)"
  >
    <p class="text-sm text-neutral-600 dark:text-neutral-300 leading-relaxed">
      {{ promptBody }}
    </p>
    <p v-if="error" class="mt-3 text-xs font-medium text-pink-700 dark:text-pink-500">{{ error }}</p>

    <template #footer>
      <div class="flex w-full flex-col gap-2">
        <FotoceButton
          variant="primary"
          block
          class="min-h-[48px] justify-center"
          :loading="loading"
          @click="onEnable"
        >
          {{ loading ? t('settings.notifications.web.activating') : t('notifications.prompt.enable') }}
        </FotoceButton>
        <FotoceButton variant="secondary" block class="min-h-[44px] justify-center" @click="onLater">
          {{ t('notifications.prompt.later') }}
        </FotoceButton>
        <button type="button" class="text-xs font-semibold text-neutral-500 hover:text-neutral-700 dark:hover:text-neutral-300 py-2" @click="onDecline">
          {{ t('notifications.prompt.decline') }}
        </button>
      </div>
    </template>
  </FotoceModal>
</template>
