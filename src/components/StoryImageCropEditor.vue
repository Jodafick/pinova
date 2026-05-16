<script setup lang="ts">
import { computed, nextTick, onMounted, onUnmounted, ref, watch } from 'vue'
import { useI18n } from '../i18n'

type AspectKey = 'free' | '1:1' | '4:5' | '9:16' | '16:9'

const props = withDefaults(
  defineProps<{
    file: File
    /** Sortie story 9:16 plein cadre ; pin conserve le ratio du rognage. */
    exportProfile?: 'story' | 'pin'
  }>(),
  { exportProfile: 'story' },
)

const emit = defineEmits<{
  (e: 'cancel'): void
  (e: 'apply', file: File): void
}>()

const { t } = useI18n()
const cropHeading = computed(() =>
  props.exportProfile === 'pin' ? t('create.pinMobile.cropTitle') : t('story.editor.cropTitle'),
)
const previewUrl = ref('')
const imageEl = ref<HTMLImageElement | null>(null)
const stageRef = ref<HTMLElement | null>(null)
const naturalW = ref(1)
const naturalH = ref(1)
const rotation = ref(0)
const flipH = ref(false)
const flipV = ref(false)
const busy = ref(false)

const imgBox = ref({ x: 0, y: 0, w: 1, h: 1 })
const crop = ref({ x: 0, y: 0, w: 100, h: 100 })
const aspectKey = ref<AspectKey>(props.exportProfile === 'pin' ? 'free' : '9:16')

const MIN = 44

type DragMode = 'move' | 'nw' | 'ne' | 'sw' | 'se' | null
const dragMode = ref<DragMode>(null)
const dragStart = ref<{
  px: number
  py: number
  crop: { x: number; y: number; w: number; h: number }
} | null>(null)

const aspectOptions = computed((): Array<{ key: AspectKey; label: string; icon: string }> => [
  { key: 'free', label: t('story.editor.aspectFree'), icon: 'crop_free' },
  { key: '1:1', label: '1:1', icon: 'crop_square' },
  { key: '4:5', label: '4:5', icon: 'crop_portrait' },
  { key: '9:16', label: '9:16', icon: 'crop_9_16' },
  { key: '16:9', label: '16:9', icon: 'crop_16_9' },
])

function aspectRatio(k: AspectKey): number | null {
  if (k === 'free') return null
  if (k === '1:1') return 1
  if (k === '4:5') return 4 / 5
  if (k === '9:16') return 9 / 16
  return 16 / 9
}

let ro: ResizeObserver | null = null

onMounted(() => {
  previewUrl.value = URL.createObjectURL(props.file)
})

watch(stageRef, (el) => {
  ro?.disconnect()
  ro = null
  if (!el) return
  ro = new ResizeObserver(() => {
    void nextTick(() => layout())
  })
  ro.observe(el)
})

onUnmounted(() => {
  ro?.disconnect()
  if (previewUrl.value) URL.revokeObjectURL(previewUrl.value)
})

function clientToStage(e: PointerEvent) {
  const s = stageRef.value?.getBoundingClientRect()
  if (!s) return { x: 0, y: 0 }
  return { x: e.clientX - s.left, y: e.clientY - s.top }
}

function clamp(n: number, lo: number, hi: number) {
  return Math.max(lo, Math.min(hi, n))
}

function layout() {
  const st = stageRef.value
  const img = imageEl.value
  if (!st || !img) return
  const sr = st.getBoundingClientRect()
  const ir = img.getBoundingClientRect()
  imgBox.value = {
    x: ir.left - sr.left,
    y: ir.top - sr.top,
    w: Math.max(1, ir.width),
    h: Math.max(1, ir.height),
  }
}

function maxCropInBox(boxW: number, boxH: number, ratio: number | null) {
  if (ratio == null) return { w: boxW, h: boxH }
  if (boxW / boxH > ratio) {
    return { w: boxH * ratio, h: boxH }
  }
  return { w: boxW, h: boxW / ratio }
}

function fitCropToAspect() {
  const ib = imgBox.value
  const r = aspectRatio(aspectKey.value)
  const { w: fw, h: fh } = maxCropInBox(ib.w, ib.h, r)
  crop.value = {
    x: ib.x + (ib.w - fw) / 2,
    y: ib.y + (ib.h - fh) / 2,
    w: fw,
    h: fh,
  }
  clampCropInsideImage()
}

function initCropAfterLayout() {
  fitCropToAspect()
}

function clampCropInsideImage() {
  const ib = imgBox.value
  let { x, y, w, h } = crop.value
  w = Math.max(MIN, w)
  h = Math.max(MIN, h)
  x = clamp(x, ib.x, ib.x + ib.w - w)
  y = clamp(y, ib.y, ib.y + ib.h - h)
  if (x + w > ib.x + ib.w) x = ib.x + ib.w - w
  if (y + h > ib.y + ib.h) y = ib.y + ib.h - h
  crop.value = { x, y, w, h }
}

watch(aspectKey, () => {
  void nextTick(() => {
    layout()
    fitCropToAspect()
  })
})

watch([rotation, flipH, flipV], () => {
  void nextTick(() => {
    layout()
    clampCropInsideImage()
  })
})

const imageTransformStyle = computed(() => ({
  transform: [
    `rotate(${rotation.value}deg)`,
    `scaleX(${flipH.value ? -1 : 1})`,
    `scaleY(${flipV.value ? -1 : 1})`,
  ].join(' '),
  transformOrigin: 'center center',
}))

function onImageLoad(e: Event) {
  const img = e.target as HTMLImageElement
  naturalW.value = img.naturalWidth || 1
  naturalH.value = img.naturalHeight || 1
  void nextTick(() => {
    layout()
    initCropAfterLayout()
  })
}

function cropStyle() {
  const c = crop.value
  return {
    left: `${c.x}px`,
    top: `${c.y}px`,
    width: `${c.w}px`,
    height: `${c.h}px`,
  }
}

function dimStyle(side: 't' | 'b' | 'l' | 'r') {
  const c = crop.value
  const dim = 'rgba(6,4,8,0.55)'
  if (side === 't') return { position: 'absolute' as const, left: 0, top: 0, right: 0, height: `${c.y}px`, backgroundColor: dim }
  if (side === 'b')
    return {
      position: 'absolute' as const,
      left: 0,
      top: `${c.y + c.h}px`,
      right: 0,
      bottom: 0,
      backgroundColor: dim,
    }
  if (side === 'l')
    return {
      position: 'absolute' as const,
      left: 0,
      top: `${c.y}px`,
      width: `${c.x}px`,
      height: `${c.h}px`,
      backgroundColor: dim,
    }
  return {
    position: 'absolute' as const,
    left: `${c.x + c.w}px`,
    top: `${c.y}px`,
    right: 0,
    height: `${c.h}px`,
    backgroundColor: dim,
  }
}

function onPointerDownRoot(e: PointerEvent) {
  const raw = e.target as HTMLElement | null
  if (!raw) return
  const handle = raw.closest<HTMLElement>('[data-crop-handle]')
  const move = raw.closest<HTMLElement>('[data-crop-move="1"]')
  if (handle?.dataset?.cropHandle) {
    dragMode.value = handle.dataset.cropHandle as DragMode
  } else if (move) {
    dragMode.value = 'move'
  } else {
    return
  }
  ;(e.currentTarget as HTMLElement).setPointerCapture?.(e.pointerId)
  const p = clientToStage(e)
  dragStart.value = { px: p.x, py: p.y, crop: { ...crop.value } }
}

function onPointerMoveRoot(e: PointerEvent) {
  if (!dragMode.value || !dragStart.value) return
  const p = clientToStage(e)
  const dx = p.x - dragStart.value.px
  const dy = p.y - dragStart.value.py
  const s = dragStart.value.crop
  const ib = imgBox.value
  const r = aspectRatio(aspectKey.value)

  if (dragMode.value === 'move') {
    let nx = s.x + dx
    let ny = s.y + dy
    nx = clamp(nx, ib.x, ib.x + ib.w - s.w)
    ny = clamp(ny, ib.y, ib.y + ib.h - s.h)
    crop.value = { x: nx, y: ny, w: s.w, h: s.h }
    return
  }

  let x = s.x
  let y = s.y
  let w = s.w
  let h = s.h

  if (dragMode.value === 'se') {
    w = clamp(s.w + dx, MIN, ib.x + ib.w - s.x)
    h = clamp(s.h + dy, MIN, ib.y + ib.h - s.y)
    if (r != null) {
      if (Math.abs(dx) >= Math.abs(dy)) {
        h = w / r
      } else {
        w = h * r
      }
    }
  } else if (dragMode.value === 'ne') {
    w = clamp(s.w + dx, MIN, ib.x + ib.w - s.x)
    const ny0 = s.y + dy
    h = clamp(s.y + s.h - ny0, MIN, s.y + s.h - ib.y)
    y = s.y + s.h - h
    if (r != null) {
      const cand = Math.abs(dx) > Math.abs(dy) ? { w, h: w / r } : { w: h * r, h }
      w = cand.w
      h = cand.h
      y = s.y + s.h - h
    }
  } else if (dragMode.value === 'sw') {
    const nx0 = s.x + dx
    w = clamp(s.x + s.w - nx0, MIN, s.x + s.w - ib.x)
    x = s.x + s.w - w
    h = clamp(s.h + dy, MIN, ib.y + ib.h - s.y)
    if (r != null) {
      const cand = Math.abs(dx) > Math.abs(dy) ? { w, h: w / r } : { w: h * r, h }
      w = cand.w
      h = cand.h
      x = s.x + s.w - w
    }
  } else if (dragMode.value === 'nw') {
    const nx0 = s.x + dx
    const ny0 = s.y + dy
    w = clamp(s.x + s.w - nx0, MIN, s.x + s.w - ib.x)
    h = clamp(s.y + s.h - ny0, MIN, s.y + s.h - ib.y)
    x = s.x + s.w - w
    y = s.y + s.h - h
    if (r != null) {
      const cand = Math.abs(dx) > Math.abs(dy) ? { w, h: w / r } : { w: h * r, h }
      w = cand.w
      h = cand.h
      x = s.x + s.w - w
      y = s.y + s.h - h
    }
  }

  x = clamp(x, ib.x, ib.x + ib.w - MIN)
  y = clamp(y, ib.y, ib.y + ib.h - MIN)
  w = clamp(w, MIN, ib.x + ib.w - x)
  h = clamp(h, MIN, ib.y + ib.h - y)
  crop.value = { x, y, w, h }
  clampCropInsideImage()
}

function onPointerUpRoot() {
  dragMode.value = null
  dragStart.value = null
}

function reset() {
  rotation.value = 0
  flipH.value = false
  flipV.value = false
  void nextTick(() => {
    layout()
    fitCropToAspect()
  })
}

function canvasToBlob(canvas: HTMLCanvasElement, type: string, quality?: number) {
  return new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('canvas_export_failed'))), type, quality)
  })
}

function renderRotatedNaturalToCanvas(img: HTMLImageElement) {
  const w = naturalW.value
  const h = naturalH.value
  const rot = ((rotation.value % 360) + 360) % 360
  const rad = (rot * Math.PI) / 180
  const sin = Math.abs(Math.sin(rad))
  const cos = Math.abs(Math.cos(rad))
  const rw = w * cos + h * sin
  const rh = w * sin + h * cos
  const c = document.createElement('canvas')
  c.width = Math.ceil(rw)
  c.height = Math.ceil(rh)
  const ctx = c.getContext('2d')
  if (!ctx) throw new Error('canvas_context_failed')
  ctx.fillStyle = '#060408'
  ctx.fillRect(0, 0, c.width, c.height)
  ctx.translate(rw / 2, rh / 2)
  ctx.rotate(rad)
  ctx.scale(flipH.value ? -1 : 1, flipV.value ? -1 : 1)
  ctx.drawImage(img, -w / 2, -h / 2, w, h)
  return c
}

async function applyCrop() {
  const img = imageEl.value
  if (!img || !stageRef.value) return
  busy.value = true
  try {
    layout()
    const ib = imgBox.value
    const c = crop.value
    const u0 = clamp((c.x - ib.x) / ib.w, 0, 1)
    const v0 = clamp((c.y - ib.y) / ib.h, 0, 1)
    const uw = clamp(c.w / ib.w, 0.01, 1)
    const uh = clamp(c.h / ib.h, 0.01, 1)

    const srcCanvas = renderRotatedNaturalToCanvas(img)
    const sw = Math.max(1, Math.round(uw * srcCanvas.width))
    const sh = Math.max(1, Math.round(uh * srcCanvas.height))
    const sx = Math.max(0, Math.round(u0 * srcCanvas.width))
    const sy = Math.max(0, Math.round(v0 * srcCanvas.height))

    const patch = document.createElement('canvas')
    patch.width = sw
    patch.height = sh
    const pctx = patch.getContext('2d')
    if (!pctx) throw new Error('canvas_context_failed')
    pctx.drawImage(srcCanvas, sx, sy, sw, sh, 0, 0, sw, sh)

    let outW = sw
    let outH = sh
    if (props.exportProfile === 'story') {
      outW = 1080
      outH = 1920
    } else {
      const maxSide = 2048
      const scale = Math.min(1, maxSide / Math.max(sw, sh))
      outW = Math.max(1, Math.round(sw * scale))
      outH = Math.max(1, Math.round(sh * scale))
    }

    const out = document.createElement('canvas')
    out.width = outW
    out.height = outH
    const octx = out.getContext('2d')
    if (!octx) throw new Error('canvas_context_failed')
    octx.fillStyle = '#060408'
    octx.fillRect(0, 0, outW, outH)
    if (props.exportProfile === 'story') {
      const scale = Math.max(outW / sw, outH / sh)
      const dw = sw * scale
      const dh = sh * scale
      octx.drawImage(patch, (outW - dw) / 2, (outH - dh) / 2, dw, dh)
    } else {
      octx.drawImage(patch, 0, 0, sw, sh, 0, 0, outW, outH)
    }

    const blob = await canvasToBlob(out, 'image/jpeg', 0.92)
    const edited = new File(
      [blob],
      props.file.name.replace(/\.[^.]+$/, '') + '-crop.jpg',
      { type: 'image/jpeg' },
    )
    emit('apply', edited)
  } finally {
    busy.value = false
  }
}
</script>

<template>
  <div
    class="story-editor-shell flex h-[100svh] max-h-[100dvh] flex-col overflow-hidden bg-[#060408] text-white"
  >
    <header
      class="flex shrink-0 items-center justify-between border-b border-white/10 px-4 pb-3 pt-[calc(env(safe-area-inset-top,0px)+0.75rem)]"
    >
      <button type="button" class="story-editor-icon-btn" @click="emit('cancel')">
        <span class="material-symbols-outlined text-xl">close</span>
      </button>
      <p class="text-sm font-black">{{ cropHeading }}</p>
      <button type="button" class="story-editor-text-btn" :disabled="busy" @click="applyCrop">
        {{ busy ? t('common.loading') : t('story.editor.apply') }}
      </button>
    </header>

    <main class="flex min-h-0 flex-1 flex-col overflow-hidden">
      <!-- Zone média ~ moitié d’écran, centrée, avec marge pour les poignées de rognage -->
      <div
        class="flex flex-1 min-h-0 items-center justify-center px-6 pb-3 pt-4 sm:px-8"
      >
        <div
          class="w-full max-w-full rounded-[1.75rem] border border-white/12 bg-black/35 p-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] sm:p-5"
        >
          <section
            ref="stageRef"
            class="story-crop-stage relative mx-auto aspect-[3/4] h-[min(50svh,50dvh)] w-full max-w-[min(100vw-3rem,420px)] touch-none overflow-hidden rounded-xl border border-white/15 bg-black"
          >
        <div class="absolute inset-0 overflow-hidden rounded-[inherit] bg-black">
          <div class="absolute inset-0 flex items-center justify-center">
            <div
              class="flex max-h-full max-w-full items-center justify-center will-change-transform"
              :style="imageTransformStyle"
            >
              <img
                ref="imageEl"
                :src="previewUrl"
                alt=""
                class="max-h-full max-w-full select-none object-contain"
                draggable="false"
                @load="onImageLoad"
              >
            </div>
          </div>

          <template v-if="imgBox.w > 2 && imgBox.h > 2">
            <div class="pointer-events-none" :style="dimStyle('t')" />
            <div class="pointer-events-none" :style="dimStyle('b')" />
            <div class="pointer-events-none" :style="dimStyle('l')" />
            <div class="pointer-events-none" :style="dimStyle('r')" />
          </template>
        </div>

        <div
          v-if="imgBox.w > 2 && imgBox.h > 2"
          class="absolute inset-0 z-[8] touch-none"
          @pointerdown="onPointerDownRoot"
          @pointermove="onPointerMoveRoot"
          @pointerup="onPointerUpRoot"
          @pointercancel="onPointerUpRoot"
        >
          <div
            class="absolute z-[2] box-border border-[2px] border-white shadow-[0_0_0_1px_rgba(0,0,0,0.35)]"
            :style="cropStyle()"
          >
            <div class="pointer-events-none absolute inset-0 border border-white/25" />
            <div class="pointer-events-none absolute inset-x-0 top-1/3 h-px bg-white/30" />
            <div class="pointer-events-none absolute inset-x-0 top-2/3 h-px bg-white/30" />
            <div class="pointer-events-none absolute inset-y-0 left-1/3 w-px bg-white/30" />
            <div class="pointer-events-none absolute inset-y-0 left-2/3 w-px bg-white/30" />

            <div data-crop-move="1" class="absolute inset-[10px] z-[1] cursor-move touch-none sm:inset-[14px]" />

            <button
              type="button"
              data-crop-handle="nw"
              class="absolute left-0 top-0 z-[3] grid h-8 w-8 touch-none place-items-center rounded-md border-2 border-white bg-pink-700 dark:bg-pink-600 shadow-md sm:h-9 sm:w-9"
              tabindex="-1"
              aria-hidden="true"
            />
            <button
              type="button"
              data-crop-handle="ne"
              class="absolute right-0 top-0 z-[3] grid h-8 w-8 touch-none place-items-center rounded-md border-2 border-white bg-pink-700 dark:bg-pink-600 shadow-md sm:h-9 sm:w-9"
              tabindex="-1"
              aria-hidden="true"
            />
            <button
              type="button"
              data-crop-handle="sw"
              class="absolute bottom-0 left-0 z-[3] grid h-8 w-8 touch-none place-items-center rounded-md border-2 border-white bg-pink-700 dark:bg-pink-600 shadow-md sm:h-9 sm:w-9"
              tabindex="-1"
              aria-hidden="true"
            />
            <button
              type="button"
              data-crop-handle="se"
              class="absolute bottom-0 right-0 z-[3] grid h-8 w-8 touch-none place-items-center rounded-md border-2 border-white bg-pink-700 dark:bg-pink-600 shadow-md sm:h-9 sm:w-9"
              tabindex="-1"
              aria-hidden="true"
            />
          </div>
        </div>
        </section>
        </div>
      </div>

      <!-- Actions collées au bas de l’écran -->
      <footer
        class="shrink-0 border-t border-white/10 bg-[#060408]/95 px-4 pb-[calc(env(safe-area-inset-bottom,0px)+1rem)] pt-3 backdrop-blur-xl"
      >
        <div class="mx-auto flex w-full max-w-[min(92vw,440px)] flex-nowrap justify-center gap-1 px-0.5">
        <button
          v-for="a in aspectOptions"
          :key="a.key"
          type="button"
          class="story-editor-aspect-chip flex min-w-0 flex-[1_1_0] flex-col items-center justify-center gap-0.5 rounded-xl border px-1 py-1 text-[8px] font-extrabold uppercase leading-none tracking-tight transition active:scale-[0.97] sm:text-[9px]"
          :class="
            aspectKey === a.key
              ? 'border-pink-700 bg-pink-700/20 dark:bg-pink-600/20 text-pink-100'
              : 'border-white/15 bg-white/[0.06] text-white/55'
          "
          @click.stop="aspectKey = a.key"
        >
          <span class="material-symbols-outlined shrink-0 text-[18px] leading-none sm:text-[20px]">{{ a.icon }}</span>
          <span class="line-clamp-2 w-full text-center leading-tight">{{ a.label }}</span>
        </button>
        </div>

        <section class="mx-auto mt-3 max-w-md space-y-3 rounded-[1.25rem] border border-white/10 bg-white/[0.055] p-3 backdrop-blur sm:p-4">
        <div class="grid grid-cols-4 gap-2">
          <button type="button" class="story-editor-tool-btn" @click.stop="rotation = (rotation + 270) % 360">
            <span class="material-symbols-outlined text-xl sm:text-2xl">rotate_left</span>
            <span class="story-editor-tool-caption">{{ t('story.editor.rotateLeft') }}</span>
          </button>
          <button type="button" class="story-editor-tool-btn" @click.stop="rotation = (rotation + 90) % 360">
            <span class="material-symbols-outlined text-xl sm:text-2xl">rotate_right</span>
            <span class="story-editor-tool-caption">{{ t('story.editor.rotateRight') }}</span>
          </button>
          <button type="button" class="story-editor-tool-btn" :class="{ 'story-editor-tool-btn--active': flipH }" @click.stop="flipH = !flipH">
            <span class="material-symbols-outlined text-xl sm:text-2xl">flip</span>
            <span class="story-editor-tool-caption">{{ t('story.editor.flipHorizontal') }}</span>
          </button>
          <button type="button" class="story-editor-tool-btn" :class="{ 'story-editor-tool-btn--active': flipV }" @click.stop="flipV = !flipV">
            <span class="material-symbols-outlined text-xl sm:text-2xl">swap_vert</span>
            <span class="story-editor-tool-caption">{{ t('story.editor.flipVertical') }}</span>
          </button>
        </div>
        <button type="button" class="w-full pb-0.5 text-xs font-bold text-white/50" @click.stop="reset">{{ t('story.editor.reset') }}</button>
        </section>
      </footer>
    </main>
  </div>
</template>

<style scoped>
.story-editor-icon-btn {
  display: grid;
  height: 2.5rem;
  width: 2.5rem;
  place-items: center;
  border-radius: 999px;
  background: rgb(255 255 255 / 0.08);
}

.story-editor-text-btn {
  min-width: 4.5rem;
  border-radius: 999px;
  background: #ec4899;
  padding: 0.6rem 0.9rem;
  font-size: 0.8rem;
  font-weight: 900;
}

.story-editor-text-btn:disabled {
  opacity: 0.6;
}

.story-editor-tool-btn {
  display: flex;
  min-height: 4.25rem;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 0.2rem;
  border-radius: 1rem;
  background: rgb(255 255 255 / 0.08);
  font-weight: 800;
  color: rgb(255 255 255 / 0.8);
}

.story-editor-tool-caption {
  max-width: 100%;
  padding: 0 0.15rem;
  font-size: 0.6rem;
  line-height: 1.1;
  text-align: center;
  text-transform: uppercase;
  letter-spacing: 0.04em;
  color: rgb(255 255 255 / 0.55);
}

@media (min-width: 380px) {
  .story-editor-tool-caption {
    font-size: 0.65rem;
  }
}

.story-editor-tool-btn--active {
  background: rgb(236 72 153 / 0.22);
  color: #f9a8d4;
}

.story-editor-tool-btn--active .story-editor-tool-caption {
  color: rgb(249 168 212 / 0.85);
}
</style>
