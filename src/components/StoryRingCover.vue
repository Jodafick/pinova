<script setup lang="ts">
import { computed } from 'vue'
import {
  PIN_MEDIA_ANTI_LEAK_CLASS,
  pinMediaAntiLeakImgBindings,
  pinMediaAntiLeakVideoBindings,
} from '../composables/mediaAntiLeak'
import { DEFAULT_AVATAR_COLOR_CLASS } from '../composables/useAuth'
import { displayInitials } from '../utils/displayInitials'
import { avatarBgStyle, avatarBgTailwindClass } from '../utils/avatarBackground'

const props = defineProps<{
  coverUrl: string
  displayName?: string
  username?: string
  avatarUrl?: string
  avatarColor?: string
}>()

const initialsBgClass = computed(() =>
  avatarBgTailwindClass(props.avatarColor ?? null, DEFAULT_AVATAR_COLOR_CLASS),
)
const initialsBgStyle = computed(() => avatarBgStyle(props.avatarColor ?? null))

function isVideoCover(url: string) {
  const u = url.trim()
  if (!u) return false
  return /\.(mp4|webm|mov)(\?|#|$)/i.test(u)
}

function onVideoPosterMeta(ev: Event) {
  const v = ev.target as HTMLVideoElement
  requestAnimationFrame(() => {
    try {
      const d = v.duration
      if (Number.isFinite(d) && d > 0.15) {
        v.currentTime = Math.min(0.25, d * 0.06)
      }
    } catch {
      /* média distant / fragment : ignorer */
    }
  })
}
</script>

<template>
  <template v-if="coverUrl.trim()">
    <img
      v-if="!isVideoCover(coverUrl)"
      :src="coverUrl"
      :alt="displayName || username || ''"
      :class="[
        PIN_MEDIA_ANTI_LEAK_CLASS,
        'w-full h-full rounded-full object-cover bg-neutral-100 pointer-events-none select-none',
      ]"
      v-bind="pinMediaAntiLeakImgBindings()"
    />
    <!-- Vignette : frame après metadata sans contrôles ni son -->
    <video
      v-else
      :src="coverUrl"
      muted
      playsinline
      preload="metadata"
      disablepictureinpicture
      :class="[
        PIN_MEDIA_ANTI_LEAK_CLASS,
        'w-full h-full rounded-full object-cover bg-black pointer-events-none select-none block',
      ]"
      v-bind="pinMediaAntiLeakVideoBindings(false)"
      @loadedmetadata="onVideoPosterMeta"
    />
  </template>
  <template v-else-if="avatarUrl?.trim()">
    <img
      :src="avatarUrl"
      :alt="displayName || username || ''"
      :class="[
        PIN_MEDIA_ANTI_LEAK_CLASS,
        'w-full h-full rounded-full object-cover bg-neutral-100 pointer-events-none select-none',
      ]"
      v-bind="pinMediaAntiLeakImgBindings()"
    />
  </template>
  <div
    v-else
    class="w-full h-full rounded-full flex items-center justify-center text-[11px] font-bold text-white leading-none px-1 text-center"
    :class="initialsBgClass"
    :style="initialsBgStyle"
  >
    {{ displayInitials((displayName || username || '').trim()) }}
  </div>
</template>
