<script setup lang="ts">
/**
 * PinovaModal — système de modales unifié inspiré de iOS 18, Apple Music,
 * TikTok et React Native Bottom Sheet.
 *
 * UN seul composant pour TOUS les cas :
 *
 *   <PinovaModal v-model:open="show" presentation="bottomSheet" title="Filtres">
 *     ... contenu ...
 *   </PinovaModal>
 *
 * Types supportés :
 *  - 'center'      : modal centré classique (confirmation, choix court)
 *  - 'bottomSheet' : sheet ~50% viewport, drag-to-dismiss, snap half/expanded
 *  - 'tallSheet'   : feuille haute ; sur mobile hauteur adaptative (~92dvh max), sauf si `tallSheetMobileFullBleed`
 *  - 'fullscreen'  : couvre tout l'écran (édition pleine, story viewer)
 *  - 'floating'    : carte flottante centrée sans backdrop opaque (toasts, picker discret)
 *
 * Caractéristiques :
 *  - Glass system iOS (saturate + blur, light/dark, rose accent)
 *  - Drag interactif avec rubber band + velocity dismiss (sheet / fullscreen)
 *  - Multi snap points (bottomSheet)
 *  - Background interaction : scale + blur subtil du #app-shell pendant ouverture
 *  - Keyboard avoidance (offset auto via useSafeArea)
 *  - Focus trap + Esc dismiss + aria-modal
 *  - Haptics open / close / snap
 *  - Reduced motion respect (fade simple si activé)
 *  - Safe areas iOS (Dynamic Island, Home Indicator)
 *  - Teleport vers `body` pour échapper aux containers contraints
 *  - Body scroll lock en parallèle (sans casser le scroll interne du sheet)
 *
 * IMPORTANT : pour les modales liées à une route (`/settings`, etc.), préférez
 * le système layers (`installRouterLayerBridge`) qui synchronise l'URL.
 * PinovaModal est destinée aux modales LOCALES déclenchées par un état
 * réactif (filtres, confirmation, picker, etc.).
 */
import { computed, nextTick, onBeforeUnmount, ref, watch } from 'vue'
import { useGestureEngine } from '../../composables/useGestureEngine'
import { useSpring } from '../../composables/useSpring'
import { useFocusTrap } from '../../composables/useFocusTrap'
import { useSafeArea } from '../../composables/useSafeArea'
import { emitMicroFeedback } from '../../composables/useMicroFeedback'
import { SPRINGS } from '../../theme/motion'
import { getAdaptiveGesture } from '../../navigation/adaptiveNavigator'
import { GLASS } from '../../theme/glass'
import { acquirePinovaBodyScrollLock, releasePinovaBodyScrollLock } from '../../utils/pinovaModalBodyLock'
import ModalHeader from './ModalHeader.vue'

type Presentation = 'center' | 'bottomSheet' | 'tallSheet' | 'fullscreen' | 'floating'

interface Props {
  /** Contrôle d'ouverture (v-model:open). */
  open: boolean
  /** Type de présentation. Default 'center'. */
  presentation?: Presentation
  /** Titre (header). */
  title?: string
  /** Sous-titre (header). */
  subtitle?: string
  /** Afficher un header automatique. Default true. Pose false si custom. */
  showHeader?: boolean
  /** Afficher la drag handle (auto pour sheets). */
  handle?: boolean
  /** Dismiss au clic du backdrop. Default true. */
  dismissOnBackdropClick?: boolean
  /** Dismiss à Escape. Default true. */
  dismissOnEscape?: boolean
  /** Désactiver le gesture drag-to-dismiss. */
  disableGesture?: boolean
  /** Style rose accent (pour modales actions Pinova : création, etc.). */
  rose?: boolean
  /** Intensité du scrim (0..1). Default selon presentation. */
  scrim?: number
  /** Largeur max (center / floating). Default 480. */
  maxWidth?: number
  /**
   * À partir de `presentationLgMinWidth` (défaut 1024px = Tailwind `lg`), remplace `presentation` par cette valeur.
   * Ex. `tallSheet` + `presentationLg: 'center'` → feuille sur petit écran, modale centrée au-delà du seuil.
   */
  presentationLg?: Presentation
  /** Largeur min (px) pour activer `presentationLg`. Ex. 1280 pour n’activer la modale « desktop » qu’à partir de `xl`. */
  presentationLgMinWidth?: number
  /** Active la scale+blur du background #app-shell. Default true. */
  depthEffect?: boolean
  /**
   * `tallSheet` sur viewport &lt; lg : occupe toute la hauteur (ancien comportement).
   * Par défaut false : hauteur adaptative (max ~92dvh) pour les feuilles « liste / formulaire ».
   */
  tallSheetMobileFullBleed?: boolean
  /**
   * aria-labelledby personnalisé (si pas de `title`).
   * Sinon le `title` est utilisé en `aria-labelledby` auto.
   */
  ariaLabelledBy?: string
  ariaDescribedBy?: string
}

const props = withDefaults(defineProps<Props>(), {
  presentation: 'center',
  showHeader: true,
  dismissOnBackdropClick: true,
  dismissOnEscape: true,
  disableGesture: false,
  rose: false,
  depthEffect: true,
  maxWidth: 480,
  tallSheetMobileFullBleed: false,
})

const emit = defineEmits<{
  (e: 'update:open', open: boolean): void
  (e: 'close', reason: 'backdrop' | 'escape' | 'gesture' | 'manual'): void
  (e: 'opened'): void
  (e: 'closed'): void
}>()

const { keyboardHeight, top: safeTop, bottom: safeBottom } = useSafeArea()

/** `true` quand la fenêtre atteint `presentationLgMinWidth` (pour appliquer `presentationLg`). */
const mediaPresentationLg = ref(false)
let removePresentationLgMql: (() => void) | null = null

function syncPresentationLgMql() {
  removePresentationLgMql?.()
  removePresentationLgMql = null
  if (typeof window === 'undefined') return
  if (props.presentationLg == null) {
    mediaPresentationLg.value = false
    return
  }
  const px = Math.max(0, props.presentationLgMinWidth ?? 1024)
  const mql = window.matchMedia(`(min-width: ${px}px)`)
  mediaPresentationLg.value = mql.matches
  const onChange = () => {
    mediaPresentationLg.value = mql.matches
  }
  mql.addEventListener('change', onChange)
  removePresentationLgMql = () => mql.removeEventListener('change', onChange)
}

watch(
  () => [props.presentationLg, props.presentationLgMinWidth] as const,
  () => {
    syncPresentationLgMql()
  },
  { immediate: true },
)

const resolvedPresentation = computed<Presentation>(() => {
  if (props.presentationLg != null && mediaPresentationLg.value) return props.presentationLg
  return props.presentation
})

/** Viewport &lt; Tailwind `lg` : utilisé seulement si `tallSheetMobileFullBleed` est activé. */
const viewportBelowLg = ref(false)
let removeTallSheetBleedMql: (() => void) | null = null

function syncTallSheetBleedMql() {
  removeTallSheetBleedMql?.()
  removeTallSheetBleedMql = null
  if (typeof window === 'undefined') return
  const mql = window.matchMedia('(max-width: 1023px)')
  viewportBelowLg.value = mql.matches
  const onChange = () => {
    viewportBelowLg.value = mql.matches
  }
  mql.addEventListener('change', onChange)
  removeTallSheetBleedMql = () => mql.removeEventListener('change', onChange)
}

syncTallSheetBleedMql()

const tallSheetUsesFullBleed = computed(
  () => !!props.tallSheetMobileFullBleed && viewportBelowLg.value,
)

const surfaceRef = ref<HTMLElement | null>(null)
const modalBodyRef = ref<HTMLElement | null>(null)
const isOpenInternal = ref(props.open)
const mounted = ref(props.open)
const isClosing = ref(false)
const bodyScrollLockHeld = ref(false)

watch(() => props.open, async (next) => {
  if (next) {
    mounted.value = true
    isClosing.value = false
    isOpenInternal.value = false
    /* RAF deux fois → laisse le DOM se monter + le browser appliquer les
       styles "entrée" avant le passage à l'état ouvert (pour la transition). */
    await nextTick()
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        isOpenInternal.value = true
        emitMicroFeedback(resolvedPresentation.value === 'fullscreen' ? 'modalOpenHeavy' : 'modalOpen')
        emit('opened')
      })
    })
  } else {
    closeAnimated('manual')
  }
}, { immediate: true })

function closeAnimated(reason: 'backdrop' | 'escape' | 'gesture' | 'manual') {
  if (!mounted.value) return
  isClosing.value = true
  isOpenInternal.value = false
  emit('close', reason)
  emitMicroFeedback('modalClose')
  /* Laisse l'animation de sortie se jouer puis démonter. */
  const exitDelay = isReducedMotion() ? 80 : 360
  setTimeout(() => {
    mounted.value = false
    isClosing.value = false
    emit('closed')
    /* Synchronise le v-model:open au cas où la fermeture vient d'une gesture. */
    if (props.open) emit('update:open', false)
  }, exitDelay)
}

function isReducedMotion(): boolean {
  if (typeof window === 'undefined') return false
  try { return window.matchMedia('(prefers-reduced-motion: reduce)').matches } catch { return false }
}

/* ─────────────────────── Drag-to-dismiss (sheet/fullscreen) ─────────────────────── */

const yDrag = useSpring(0, SPRINGS.sheetSpring)

const gestureEnabled = computed(() =>
  !props.disableGesture &&
  (resolvedPresentation.value === 'bottomSheet' || resolvedPresentation.value === 'tallSheet' || resolvedPresentation.value === 'fullscreen'),
)

useGestureEngine(surfaceRef, {
  axis: 'vertical',
  directionThreshold: 8,
  disabled: () => !gestureEnabled.value || !isOpenInternal.value || isClosing.value,
  canAcceptPointerDown: (e) => {
    const surface = surfaceRef.value
    const body = modalBodyRef.value
    if (!surface || !surface.contains(e.target as Node)) return false
    if (!body || !body.contains(e.target as Node)) return true
    return body.scrollTop <= 1
  },
  preventScroll: (state) => {
    if (!gestureEnabled.value) return false
    if (state.direction !== 'vertical') return false
    return state.dy > 0
  },
  onStart: () => {
    yDrag.stop()
  },
  onMove: ({ dy }) => {
    if (dy <= 0) {
      /* Drag vers le haut : rubber band (sheets seulement). */
      const elastic = Math.max(-60, dy / 4)
      yDrag.setImmediate(elastic)
      return
    }
    yDrag.setImmediate(dy)
  },
  onEnd: ({ dy, vy }) => {
    if (dy <= 0) {
      yDrag.set(0, { velocity: vy * 1000 })
      return 0
    }
    const surface = surfaceRef.value
    const h = surface?.clientHeight ?? 400
    const isFling = vy >= getAdaptiveGesture().flickVelocity
    const threshold = Math.max(56, Math.min(180, h * 0.28))
    if (isFling || dy >= threshold) {
      yDrag.set(h, {
        velocity: vy * 1000,
        onRest: () => {
          closeAnimated('gesture')
        },
      })
      return dy
    }
    yDrag.set(0, { velocity: vy * 1000 })
    return 0
  },
  onCancel: () => yDrag.set(0),
})

/* ─────────────────────── Background interaction (depth effect) ─────────────────────── */

let lastDepthApplied = false
watch(isOpenInternal, (open) => {
  if (!props.depthEffect) return
  const shell = document.getElementById('app-shell')
  if (!shell) return
  if (open && !lastDepthApplied) {
    shell.style.transition = `transform var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1))`
    /* Sheet/fullscreen → scale léger + saturate réduit. Center / floating → moins agressif. */
    const intense = resolvedPresentation.value === 'fullscreen' || resolvedPresentation.value === 'bottomSheet' || resolvedPresentation.value === 'tallSheet'
    shell.style.transform = intense ? 'scale3d(0.97, 0.97, 1)' : 'scale3d(0.99, 0.99, 1)'
    shell.style.filter = intense ? 'saturate(0.9)' : 'saturate(0.96)'
    lastDepthApplied = true
  } else if (!open && lastDepthApplied) {
    shell.style.transform = ''
    shell.style.filter = ''
    lastDepthApplied = false
  }
})

/* ─────────────────────── Body scroll lock (compteur global) ─────────────────────── */

watch(
  mounted,
  (m) => {
    if (typeof document === 'undefined') return
    if (m) {
      acquirePinovaBodyScrollLock()
      bodyScrollLockHeld.value = true
    } else if (bodyScrollLockHeld.value) {
      releasePinovaBodyScrollLock()
      bodyScrollLockHeld.value = false
    }
  },
  { immediate: true },
)

/* ─────────────────────── Escape & focus trap ─────────────────────── */

function onKeydown(e: KeyboardEvent) {
  if (!isOpenInternal.value) return
  if (e.key === 'Escape' && props.dismissOnEscape) {
    e.preventDefault()
    closeAnimated('escape')
  }
}
watch(
  mounted,
  (m) => {
    if (m) document.addEventListener('keydown', onKeydown)
    else document.removeEventListener('keydown', onKeydown)
  },
  { immediate: true },
)
onBeforeUnmount(() => {
  removePresentationLgMql?.()
  removePresentationLgMql = null
  removeTallSheetBleedMql?.()
  removeTallSheetBleedMql = null
  document.removeEventListener('keydown', onKeydown)
  if (bodyScrollLockHeld.value) {
    releasePinovaBodyScrollLock()
    bodyScrollLockHeld.value = false
  }
  if (lastDepthApplied) {
    const shell = document.getElementById('app-shell')
    if (shell) {
      shell.style.transform = ''
      shell.style.filter = ''
    }
    lastDepthApplied = false
  }
})

useFocusTrap(surfaceRef, isOpenInternal)

/* ─────────────────────── Backdrop & styles ─────────────────────── */

function onBackdropClick() {
  if (!props.dismissOnBackdropClick) return
  closeAnimated('backdrop')
}

/* Scrim — utilise var CSS pour le dark mode. */
const scrimColor = computed(() => {
  if (typeof props.scrim === 'number') return `rgba(0, 0, 0, ${props.scrim})`
  switch (resolvedPresentation.value) {
    case 'fullscreen':
    case 'tallSheet':
      return 'var(--glass-scrim-strong)'
    case 'floating':
      return 'transparent'
    case 'center':
    case 'bottomSheet':
    default:
      return 'var(--glass-scrim)'
  }
})

const surfaceStyles = computed<Record<string, string>>(() => {
  const pres = resolvedPresentation.value
  const isSheet = pres === 'bottomSheet' || pres === 'tallSheet'
  const isFullscreen = pres === 'fullscreen'

  /* Base : translateY pour drag, ou translation d'entrée. */
  let translateY = 0
  if (isOpenInternal.value && yDrag.value.value !== 0) {
    translateY = yDrag.value.value
  }

  const base: Record<string, string> = {
    transform: `translate3d(0, ${translateY}px, 0)`,
  }

  if (isSheet) {
    base.borderTopLeftRadius = `${GLASS.radius.lg}px`
    base.borderTopRightRadius = `${GLASS.radius.lg}px`
    base.borderBottomLeftRadius = '0'
    base.borderBottomRightRadius = '0'
    base.paddingBottom = `calc(${safeBottom.value}px + ${keyboardHeight.value}px)`
    if (pres === 'tallSheet') {
      if (tallSheetUsesFullBleed.value) {
        base.height = '100dvh'
        base.maxHeight = '100dvh'
      } else {
        base.height = 'auto'
        base.maxHeight = 'min(92dvh, 100dvh)'
      }
    } else {
      base.height = 'auto'
      base.maxHeight = 'min(78dvh, 92dvh)'
    }
  } else if (isFullscreen) {
    base.borderRadius = '0'
    base.height = '100dvh'
    base.width = '100vw'
    base.paddingTop = `${safeTop.value}px`
    base.paddingBottom = `${safeBottom.value + keyboardHeight.value}px`
  } else {
    /* center / floating */
    base.borderRadius = `${GLASS.radius.md}px`
    base.maxWidth = `${props.maxWidth}px`
    /* Borne la hauteur pour que `.pinova-modal-body` (flex + overflow) scrolle au lieu de dépasser l'écran. */
    base.maxHeight = 'min(90dvh, calc(100dvh - 32px), calc(100svh - 32px))'
    base.paddingBottom = `${keyboardHeight.value}px`
  }

  return base
})

/* Classes selon presentation : transitions distinctes (sheet bottom, center pop, etc.). */
const transitionName = computed(() => {
  if (isReducedMotion()) return 'pinova-modal-fade'
  switch (resolvedPresentation.value) {
    case 'bottomSheet':
    case 'tallSheet':   return 'pinova-modal-sheet'
    case 'center':      return 'pinova-modal-pop'
    case 'fullscreen':  return 'pinova-modal-fs'
    case 'floating':    return 'pinova-modal-floating'
  }
})

const ariaLabelledByFinal = computed(() => props.ariaLabelledBy || undefined)
</script>

<template>
  <Teleport to="body">
    <transition :name="`${transitionName}-backdrop`" appear>
      <div
        v-if="mounted"
        class="pinova-modal-root"
        :class="[`pinova-modal-root--${resolvedPresentation}`]"
        :data-open="isOpenInternal || undefined"
      >
        <div
          v-if="resolvedPresentation !== 'floating'"
          class="pinova-modal-backdrop"
          :style="{ backgroundColor: scrimColor }"
          @click="onBackdropClick"
        />

        <transition :name="transitionName" appear>
          <div
            v-if="isOpenInternal"
            ref="surfaceRef"
            class="pinova-modal-surface"
            :class="[
              `pinova-modal-surface--${resolvedPresentation}`,
              rose ? 'pinova-modal-surface--rose' : '',
            ]"
            :style="surfaceStyles"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="ariaLabelledByFinal"
            :aria-describedby="ariaDescribedBy"
          >
            <div
              v-if="!showHeader && (resolvedPresentation === 'bottomSheet' || resolvedPresentation === 'tallSheet')"
              class="pinova-modal-sheet-drag-affordance"
              aria-hidden="true"
            />
            <ModalHeader
              v-if="showHeader"
              :title="title"
              :subtitle="subtitle"
              :handle="handle || resolvedPresentation === 'bottomSheet' || resolvedPresentation === 'tallSheet'"
              :sticky="resolvedPresentation === 'tallSheet' || resolvedPresentation === 'fullscreen'"
              :safe-top="resolvedPresentation === 'fullscreen' || resolvedPresentation === 'tallSheet'"
              :variant="resolvedPresentation === 'fullscreen' ? 'glass' : 'transparent'"
            >
              <template v-if="$slots.headerStart" #start><slot name="headerStart" /></template>
              <template v-if="$slots.headerEnd"   #end><slot name="headerEnd" /></template>
            </ModalHeader>

            <div ref="modalBodyRef" class="pinova-modal-body">
              <slot />
            </div>

            <div v-if="$slots.footer" class="pinova-modal-footer">
              <slot name="footer" />
            </div>
          </div>
        </transition>
      </div>
    </transition>
  </Teleport>
</template>

<style scoped>
/* ─── Root container ─── */
.pinova-modal-root {
  position: fixed;
  inset: 0;
  z-index: 100;
  display: flex;
  align-items: stretch;
  justify-content: center;
  pointer-events: auto;
  /* Disable selection on backdrop. */
  -webkit-user-select: none;
  user-select: none;
}

.pinova-modal-root--center,
.pinova-modal-root--floating {
  align-items: center;
  padding: 16px;
  box-sizing: border-box;
  /* Ancrage strict au viewport : centrage / max-h ne suivent pas la hauteur totale du document. */
  height: 100dvh;
  height: 100svh;
  min-height: 100dvh;
  min-height: 100svh;
  max-height: 100dvh;
  max-height: 100svh;
  overflow: hidden;
}

.pinova-modal-root--bottomSheet,
.pinova-modal-root--tallSheet {
  align-items: flex-end;
  /* Même ancrage strict que `center` : évite tout dépassement visuel du document sur Safari. */
  height: 100dvh;
  height: 100svh;
  min-height: 100dvh;
  min-height: 100svh;
  max-height: 100dvh;
  max-height: 100svh;
  overflow: hidden;
  box-sizing: border-box;
}

.pinova-modal-backdrop {
  position: absolute;
  inset: 0;
  /* La couleur est appliquée inline via scrimColor. */
  cursor: pointer;
  backdrop-filter: blur(10px) saturate(1.08);
  -webkit-backdrop-filter: blur(10px) saturate(1.08);
}

.pinova-modal-root--fullscreen .pinova-modal-backdrop {
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
}

.pinova-modal-root--tallSheet .pinova-modal-backdrop,
.pinova-modal-root--bottomSheet .pinova-modal-backdrop {
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
}

/* ─── Surface (glass) ─── */
.pinova-modal-surface {
  position: relative;
  display: flex;
  flex-direction: column;
  width: 100%;
  background-color: var(--glass-fill);
  backdrop-filter: var(--glass-blur);
  -webkit-backdrop-filter: var(--glass-blur);
  border: 1px solid var(--glass-border);
  box-shadow: var(--glass-shadow-lg);
  color: var(--pn-text, #0f0a0d);
  overflow: hidden;
  isolation: isolate;
  will-change: transform, opacity;
  backface-visibility: hidden;
  -webkit-backface-visibility: hidden;
  /* Restaure les interactions normales dans la surface (le user-select root est OFF). */
  -webkit-user-select: auto;
  user-select: auto;
}

.pinova-modal-surface--rose {
  background-color: var(--glass-fill-rose);
}

.pinova-modal-surface--center,
.pinova-modal-surface--floating {
  max-width: 480px;
  width: 100%;
  margin: auto;
}

.pinova-modal-surface--floating {
  /* Pas de shadow agressive pour les floating cards. */
  box-shadow: var(--glass-shadow-md);
}

.pinova-modal-surface--fullscreen {
  max-width: none;
  border: 0;
  border-radius: 0;
}

.pinova-modal-surface--bottomSheet,
.pinova-modal-surface--tallSheet {
  height: auto;
}

/* Hauteur pilotée par les styles inline pour `tallSheet` (100dvh). */
.pinova-modal-surface--tallSheet {
  min-height: 0;
}

.pinova-modal-surface--bottomSheet .pinova-modal-body,
.pinova-modal-surface--tallSheet .pinova-modal-body {
  flex: 0 1 auto;
}

/* Header / poignée : le navigateur ne doit pas prendre le pan vertical à la place du drag JS (surtout iOS). */
.pinova-modal-surface--bottomSheet :deep(.modal-header),
.pinova-modal-surface--tallSheet :deep(.modal-header),
.pinova-modal-surface--fullscreen :deep(.modal-header) {
  touch-action: none;
}

.pinova-modal-surface--bottomSheet .pinova-modal-body,
.pinova-modal-surface--tallSheet .pinova-modal-body {
  touch-action: pan-y;
}

.pinova-modal-sheet-drag-affordance {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
  cursor: grab;
  touch-action: none;
}

.pinova-modal-surface--tallSheet .pinova-modal-sheet-drag-affordance {
  padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
}

.pinova-modal-sheet-drag-affordance::after {
  content: '';
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background-color: rgba(120, 120, 128, 0.36);
}

:global(.dark) .pinova-modal-sheet-drag-affordance::after {
  background-color: rgba(255, 255, 255, 0.22);
}

.pinova-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 4px 16px 16px;
  /* Évite que la translation drag fasse apparaître du blanc en bas. */
  background: transparent;
}

.pinova-modal-footer {
  padding: 10px 16px calc(env(safe-area-inset-bottom, 0px) + 10px);
  border-top: 1px solid var(--glass-border);
  background: color-mix(in srgb, var(--glass-fill) 88%, transparent);
  backdrop-filter: blur(14px) saturate(1.15);
  -webkit-backdrop-filter: blur(14px) saturate(1.15);
}

:global(.dark) .pinova-modal-footer {
  background: color-mix(in srgb, rgb(18 18 22) 92%, transparent);
  border-top-color: rgba(255, 255, 255, 0.08);
}

/* ─── Backdrop transitions ─── */
.pinova-modal-sheet-backdrop-enter-active,
.pinova-modal-sheet-backdrop-leave-active,
.pinova-modal-pop-backdrop-enter-active,
.pinova-modal-pop-backdrop-leave-active,
.pinova-modal-fs-backdrop-enter-active,
.pinova-modal-fs-backdrop-leave-active,
.pinova-modal-floating-backdrop-enter-active,
.pinova-modal-floating-backdrop-leave-active,
.pinova-modal-fade-backdrop-enter-active,
.pinova-modal-fade-backdrop-leave-active {
  transition: opacity var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.pinova-modal-sheet-backdrop-enter-from,
.pinova-modal-pop-backdrop-enter-from,
.pinova-modal-fs-backdrop-enter-from,
.pinova-modal-floating-backdrop-enter-from,
.pinova-modal-fade-backdrop-enter-from,
.pinova-modal-sheet-backdrop-leave-to,
.pinova-modal-pop-backdrop-leave-to,
.pinova-modal-fs-backdrop-leave-to,
.pinova-modal-floating-backdrop-leave-to,
.pinova-modal-fade-backdrop-leave-to { opacity: 0; }

/* ─── Sheet motion (bottom slide + spring) ─── */
.pinova-modal-sheet-enter-active,
.pinova-modal-sheet-leave-active {
  transition:
    transform var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.pinova-modal-sheet-enter-from,
.pinova-modal-sheet-leave-to {
  transform: translate3d(0, 100%, 0) !important;
  opacity: 0.6;
}

/* ─── Center pop ─── */
.pinova-modal-pop-enter-active,
.pinova-modal-pop-leave-active {
  transition:
    transform var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.pinova-modal-pop-enter-from,
.pinova-modal-pop-leave-to {
  transform: scale3d(0.88, 0.88, 1) !important;
  opacity: 0;
}

/* ─── Fullscreen slide-up ─── */
.pinova-modal-fs-enter-active,
.pinova-modal-fs-leave-active {
  transition:
    transform var(--pinova-dur-slow, 380ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)),
    opacity var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.pinova-modal-fs-enter-from,
.pinova-modal-fs-leave-to {
  transform: translate3d(0, 100%, 0) !important;
  opacity: 0;
}

/* ─── Floating spring small ─── */
.pinova-modal-floating-enter-active,
.pinova-modal-floating-leave-active {
  transition:
    transform var(--pinova-dur-medium, 260ms) var(--pinova-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--pinova-dur-fast, 180ms) var(--pinova-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.pinova-modal-floating-enter-from,
.pinova-modal-floating-leave-to {
  transform: scale3d(0.92, 0.92, 1) translate3d(0, 12px, 0) !important;
  opacity: 0;
}

/* ─── Fade fallback (reduced motion) ─── */
.pinova-modal-fade-enter-active,
.pinova-modal-fade-leave-active {
  transition: opacity var(--pinova-dur-fast, 180ms) ease;
}
.pinova-modal-fade-enter-from,
.pinova-modal-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .pinova-modal-sheet-enter-from,
  .pinova-modal-sheet-leave-to,
  .pinova-modal-pop-enter-from,
  .pinova-modal-pop-leave-to,
  .pinova-modal-fs-enter-from,
  .pinova-modal-fs-leave-to,
  .pinova-modal-floating-enter-from,
  .pinova-modal-floating-leave-to {
    transform: none !important;
  }
}
</style>

<!-- Body scroll-lock global : ajouté hors scoped pour cibler body. -->
<style>
body.pinova-modal-scroll-lock {
  overflow: hidden;
}
</style>
