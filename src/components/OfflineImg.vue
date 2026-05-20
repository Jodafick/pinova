<script setup lang="ts">
/**
 * `<img>` dont le `src` bascule vers une URL blob Issue du Cache API hors ligne.
 */
import { onMounted, onUnmounted, ref, watch } from 'vue'
import { getOfflineMediaUrl } from '../media/offlineCache'

const props = defineProps<{
  src: string | null | undefined
}>()

const emit = defineEmits<(e: 'load', ev: Event) => void>()

const displaySrc = ref('')
let blobRevoke: string | null = null

function revokeBlob() {
  if (blobRevoke) {
    try {
      URL.revokeObjectURL(blobRevoke)
    } catch {
      /* ignore */
    }
    blobRevoke = null
  }
}

async function resolve() {
  revokeBlob()
  const url = (props.src || '').trim()
  if (!url) {
    displaySrc.value = ''
    return
  }
  if (typeof navigator !== 'undefined' && navigator.onLine) {
    displaySrc.value = url
    return
  }
  const blob = await getOfflineMediaUrl(url)
  if (blob) {
    blobRevoke = blob
    displaySrc.value = blob
  } else {
    displaySrc.value = url
  }
}

onMounted(() => {
  void resolve()
  if (typeof window !== 'undefined') {
    window.addEventListener('online', resolve)
    window.addEventListener('offline', resolve)
  }
})

onUnmounted(() => {
  revokeBlob()
  if (typeof window !== 'undefined') {
    window.removeEventListener('online', resolve)
    window.removeEventListener('offline', resolve)
  }
})

watch(
  () => props.src,
  () => {
    void resolve()
  },
)
</script>

<template>
  <img v-bind="$attrs" :src="displaySrc" @load="emit('load', $event)" />
</template>
