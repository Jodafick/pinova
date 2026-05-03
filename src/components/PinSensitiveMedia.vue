<script setup lang="ts">
import { ref, computed, onMounted, watch } from 'vue'
import { useI18n } from '../i18n'
import { useDoubleVerification } from '../composables/useDoubleVerification'
import { useAuth } from '../composables/useAuth'

defineOptions({ inheritAttrs: false })

const props = withDefaults(
  defineProps<{
    sensitive: boolean
    viewerCanReveal: boolean
    /** Si false (Plus/Pro + préférence), pas de flou par défaut pour un spectateur majeur. */
    blurByDefault?: boolean
    wrapperClass?: string
    /** Pour la double vérification frontend lors de l'affichage */
    mediaUrl?: string
    mediaType?: 'image' | 'video'
  }>(),
  { blurByDefault: true },
)

const { t } = useI18n()
const { isAuthenticated, currentUser } = useAuth()
const { scanRemoteMedia } = useDoubleVerification()

const revealed = ref(false)
const clientSideLevel = ref<'ok' | 'blur' | 'block'>('ok')
const isScanning = ref(false)

const showOverlay = computed(() => {
  // 1. Si le client-side scan a bloqué l'image
  if (clientSideLevel.value === 'block') return true
  
  // 2. Si le serveur OU le client-side scan a demandé un flou
  const isSensitive = props.sensitive || clientSideLevel.value === 'blur'
  
  if (!isSensitive) return false
  if (!props.viewerCanReveal) return true
  if (!props.blurByDefault) return false
  return !revealed.value
})

const overlayMessage = computed(() => {
  if (clientSideLevel.value === 'block') return t('moderation.blockedByClient')
  return t('moderation.sensitiveOverlay')
})

const canRevealClientBlock = computed(() => {
  // On ne permet pas de révéler un contenu bloqué par le client-side scan
  // sauf si l'utilisateur est un adulte vérifié et que c'est juste un flou.
  if (clientSideLevel.value === 'block') return false
  return props.viewerCanReveal && props.blurByDefault
})

async function runClientScan() {
  if (!props.mediaUrl || isScanning.value) return
  
  isScanning.value = true
  try {
    const result = await scanRemoteMedia(props.mediaUrl, props.mediaType || 'image', {
      birthDate: currentUser.value?.birthDate,
      isAuthenticated: isAuthenticated.value,
    })
    clientSideLevel.value = result.level
  } catch (err) {
    console.warn('Double verification failed for', props.mediaUrl)
  } finally {
    isScanning.value = false
  }
}

onMounted(() => {
  runClientScan()
})

watch(() => props.mediaUrl, () => {
  clientSideLevel.value = 'ok'
  runClientScan()
})
</script>

<template>
  <div class="relative overflow-hidden w-full" :class="props.wrapperClass">
    <div
      class="transition-[filter,transform] duration-300 w-full"
      :class="showOverlay ? 'blur-2xl scale-[1.05]' : ''"
    >
      <slot />
    </div>
    <div
      v-if="showOverlay"
      class="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-black/40 px-4 text-center z-[25] pointer-events-none"
    >
      <span class="material-symbols-outlined text-white text-3xl opacity-90">
        {{ clientSideLevel === 'block' ? 'block' : 'visibility_off' }}
      </span>
      <p class="text-white text-sm font-semibold drop-shadow-md max-w-[240px] leading-snug">
        {{ overlayMessage }}
      </p>
      <button
        v-if="canRevealClientBlock"
        type="button"
        class="pointer-events-auto px-4 py-2 rounded-full bg-white text-neutral-900 text-sm font-bold shadow-lg hover:bg-neutral-100 transition-colors"
        @click.stop.prevent="revealed = true"
      >
        {{ t('moderation.revealContent') }}
      </button>
    </div>
  </div>
</template>
