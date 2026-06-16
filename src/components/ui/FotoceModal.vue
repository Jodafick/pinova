<script setup lang="ts">
/**
 * FotoceModal — système de modales unifié inspiré de iOS 18, Apple Music,
 * TikTok et React Native Bottom Sheet.
 *
 * UN seul composant pour TOUS les cas :
 *
 *   <FotoceModal v-model:open="show" presentation="bottomSheet" title="Filtres">
 *     ... contenu ...
 *   </FotoceModal>
 *
 * Types supportés :
 *  - 'center'      : modal centré classique (confirmation, choix court)
 *  - 'bottomSheet' : sheet ~50% viewport, drag-to-dismiss, snap half/expanded
 *  - 'tallSheet'   : feuille haute ; hauteur adaptative (borne max), option `tallSheetMobileFullBleed` pour un plafond plus large sur mobile
 *  - 'fullscreen'  : couvre tout l'écran (édition pleine, story viewer)
 *  - 'floating'    : carte flottante centrée sans backdrop opaque (toasts, picker discret)
 *
 * Caractéristiques :
 *  - Glass iOS (saturate + blur) aligné clair/sombre neutre
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
 * FotoceModal est destinée aux modales LOCALES déclenchées par un état
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
import { acquireFotoceBodyScrollLock, releaseFotoceBodyScrollLock } from '../../utils/fotoceModalBodyLock'
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
   * `tallSheet` sur viewport &lt; lg : plafond de hauteur un peu plus haut (~96svh max)
   * tout en restant adaptatif au contenu (évite une feuille figée à 100vh sur Safari).
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
    shell.style.transition = `transform var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)), filter var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1))`
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
      acquireFotoceBodyScrollLock()
      bodyScrollLockHeld.value = true
    } else if (bodyScrollLockHeld.value) {
      releaseFotoceBodyScrollLock()
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
    releaseFotoceBodyScrollLock()
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
      /*
       * Hauteur pilotée par le contenu ; borne max pour le scroll interne.
       * Évite `height: 100svh` sur full-bleed : sur Safari/PWA la feuille peut
       * dépasser la zone visible → bande vide sous la surface.
       */
      base.height = 'auto'
      base.maxHeight = tallSheetUsesFullBleed.value
        ? 'min(96svh, 100lvh, 100dvh)'
        : 'min(92svh, 100lvh, 100dvh)'
    } else {
      base.height = 'auto'
      base.maxHeight = 'min(78svh, 92svh)'
    }
  } else if (isFullscreen) {
    base.borderRadius = '0'
    base.height = '100%'
    base.maxHeight = '100lvh'
    base.width = '100%'
    base.maxWidth = '100%'
    base.paddingTop = `${safeTop.value}px`
    base.paddingBottom = `${safeBottom.value + keyboardHeight.value}px`
  } else {
    /* center / floating */
    base.borderRadius = `${GLASS.radius.md}px`
    base.maxWidth = `${props.maxWidth}px`
    /* Borne la hauteur pour que `.fotoce-modal-body` (flex + overflow) scrolle au lieu de dépasser l'écran. */
    base.maxHeight = 'min(90svh, calc(100lvh - 32px), calc(100svh - 32px))'
    base.paddingBottom = `${keyboardHeight.value}px`
  }

  return base
})

/* Classes selon presentation : transitions distinctes (sheet bottom, center pop, etc.). */
const transitionName = computed(() => {
  if (isReducedMotion()) return 'fotoce-modal-fade'
  switch (resolvedPresentation.value) {
    case 'bottomSheet':
    case 'tallSheet':   return 'fotoce-modal-sheet'
    case 'center':      return 'fotoce-modal-pop'
    case 'fullscreen':  return 'fotoce-modal-fs'
    case 'floating':    return 'fotoce-modal-floating'
  }
})

const ariaLabelledByFinal = computed(() => props.ariaLabelledBy || undefined)
</script>

<template>
  <Teleport to="body">
    <transition :name="`${transitionName}-backdrop`" appear>
      <div
        v-if="mounted"
        class="fotoce-modal-root"
        :class="[`fotoce-modal-root--${resolvedPresentation}`]"
        :data-open="isOpenInternal || undefined"
      >
        <div
          v-if="resolvedPresentation !== 'floating'"
          class="fotoce-modal-backdrop"
          :style="{ backgroundColor: scrimColor }"
          @click="onBackdropClick"
        />

        <transition :name="transitionName" appear>
          <div
            v-if="isOpenInternal"
            ref="surfaceRef"
            class="fotoce-modal-surface"
            :class="[`fotoce-modal-surface--${resolvedPresentation}`]"
            :style="surfaceStyles"
            role="dialog"
            aria-modal="true"
            :aria-labelledby="ariaLabelledByFinal"
            :aria-describedby="ariaDescribedBy"
          >
            <div
              v-if="!showHeader && (resolvedPresentation === 'bottomSheet' || resolvedPresentation === 'tallSheet')"
              class="fotoce-modal-sheet-drag-affordance"
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

            <div ref="modalBodyRef" class="fotoce-modal-body">
              <slot />
            </div>

            <div v-if="$slots.footer" class="fotoce-modal-footer">
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
.fotoce-modal-root {
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

.fotoce-modal-root--center,
.fotoce-modal-root--floating {
  align-items: center;
  padding: 16px;
  padding-bottom: calc(16px + env(safe-area-inset-bottom, 0px));
  box-sizing: border-box;
  /* Ancrage viewport : svh + léger filet PWA (Safari). */
  height: 100svh;
  height: 100lvh;
  min-height: 100svh;
  min-height: -webkit-fill-available;
  max-height: 100lvh;
  overflow: hidden;
}

.fotoce-modal-root--bottomSheet,
.fotoce-modal-root--tallSheet {
  flex-direction: column;
  justify-content: flex-end;
  align-items: stretch;
  /*
   * Ne pas forcer height/min-height ici : `inset:0` sur le root fixe définit
   * déjà la boîte viewport. `align-items:flex-end` en row + enfant stretch
   * laissait parfois une hauteur de ligne flex incorrecte sous WebKit.
   */
  overflow: hidden;
  box-sizing: border-box;
}

.fotoce-modal-root--fullscreen {
  align-items: stretch;
  align-content: stretch;
}

.fotoce-modal-backdrop {
  position: absolute;
  inset: 0;
  /* La couleur est appliquée inline via scrimColor. */
  cursor: pointer;
  backdrop-filter: blur(10px) saturate(1.08);
  -webkit-backdrop-filter: blur(10px) saturate(1.08);
}

.fotoce-modal-root--fullscreen .fotoce-modal-backdrop {
  backdrop-filter: blur(16px) saturate(1.1);
  -webkit-backdrop-filter: blur(16px) saturate(1.1);
}

.fotoce-modal-root--tallSheet .fotoce-modal-backdrop,
.fotoce-modal-root--bottomSheet .fotoce-modal-backdrop {
  backdrop-filter: blur(14px) saturate(1.1);
  -webkit-backdrop-filter: blur(14px) saturate(1.1);
}

/* ─── Surface (glass) ─── */
.fotoce-modal-surface {
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

.fotoce-modal-surface--center,
.fotoce-modal-surface--floating {
  max-width: 480px;
  width: 100%;
  margin: auto;
}

.fotoce-modal-surface--floating {
  /* Pas de shadow agressive pour les floating cards. */
  box-shadow: var(--glass-shadow-md);
}

.fotoce-modal-surface--fullscreen {
  max-width: none;
  border: 0;
  border-radius: 0;
}

.fotoce-modal-surface--bottomSheet,
.fotoce-modal-surface--tallSheet {
  height: auto;
  align-self: stretch;
  width: 100%;
  max-width: 100%;
}

/* Hauteur pilotée par les styles inline pour `tallSheet` (100dvh). */
.fotoce-modal-surface--tallSheet {
  min-height: 0;
}

.fotoce-modal-surface--bottomSheet .fotoce-modal-body,
.fotoce-modal-surface--tallSheet .fotoce-modal-body {
  flex: 1 1 auto;
  min-height: 0;
}

/* Header / poignée : le navigateur ne doit pas prendre le pan vertical à la place du drag JS (surtout iOS). */
.fotoce-modal-surface--bottomSheet :deep(.modal-header),
.fotoce-modal-surface--tallSheet :deep(.modal-header),
.fotoce-modal-surface--fullscreen :deep(.modal-header) {
  touch-action: none;
}

.fotoce-modal-surface--bottomSheet .fotoce-modal-body,
.fotoce-modal-surface--tallSheet .fotoce-modal-body {
  touch-action: pan-y;
}

.fotoce-modal-sheet-drag-affordance {
  flex-shrink: 0;
  display: flex;
  justify-content: center;
  padding: 8px 0 4px;
  cursor: grab;
  touch-action: none;
}

.fotoce-modal-surface--tallSheet .fotoce-modal-sheet-drag-affordance {
  padding-top: calc(env(safe-area-inset-top, 0px) + 8px);
}

.fotoce-modal-sheet-drag-affordance::after {
  content: '';
  width: 38px;
  height: 4px;
  border-radius: 999px;
  background-color: rgba(120, 120, 128, 0.36);
}

:global(.dark) .fotoce-modal-sheet-drag-affordance::after {
  background-color: rgba(255, 255, 255, 0.22);
}

.fotoce-modal-body {
  flex: 1;
  min-height: 0;
  overflow-y: auto;
  overscroll-behavior: contain;
  -webkit-overflow-scrolling: touch;
  padding: 4px 16px 16px;
  /* Évite que la translation drag fasse apparaître du blanc en bas. */
  background: transparent;
}

/*
 * Safe-area bas : déjà dans `paddingBottom` inline de la surface (useSafeArea).
 * Pas de fond / blur séparé : la surface vitrée du modal continue derrière les boutons.
 */
.fotoce-modal-footer {
  flex-shrink: 0;
  padding: 10px 16px 12px;
  background: transparent;
  border-top: none;
}

/* ─── Backdrop transitions ─── */
.fotoce-modal-sheet-backdrop-enter-active,
.fotoce-modal-sheet-backdrop-leave-active,
.fotoce-modal-pop-backdrop-enter-active,
.fotoce-modal-pop-backdrop-leave-active,
.fotoce-modal-fs-backdrop-enter-active,
.fotoce-modal-fs-backdrop-leave-active,
.fotoce-modal-floating-backdrop-enter-active,
.fotoce-modal-floating-backdrop-leave-active,
.fotoce-modal-fade-backdrop-enter-active,
.fotoce-modal-fade-backdrop-leave-active {
  transition: opacity var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.fotoce-modal-sheet-backdrop-enter-from,
.fotoce-modal-pop-backdrop-enter-from,
.fotoce-modal-fs-backdrop-enter-from,
.fotoce-modal-floating-backdrop-enter-from,
.fotoce-modal-fade-backdrop-enter-from,
.fotoce-modal-sheet-backdrop-leave-to,
.fotoce-modal-pop-backdrop-leave-to,
.fotoce-modal-fs-backdrop-leave-to,
.fotoce-modal-floating-backdrop-leave-to,
.fotoce-modal-fade-backdrop-leave-to { opacity: 0; }

/* ─── Sheet motion (bottom slide + spring) ─── */
.fotoce-modal-sheet-enter-active,
.fotoce-modal-sheet-leave-active {
  transition:
    transform var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--fotoce-dur-fast, 180ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.fotoce-modal-sheet-enter-from,
.fotoce-modal-sheet-leave-to {
  transform: translate3d(0, 100%, 0) !important;
  opacity: 0.6;
}

/* ─── Center pop ─── */
.fotoce-modal-pop-enter-active,
.fotoce-modal-pop-leave-active {
  transition:
    transform var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--fotoce-dur-fast, 180ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.fotoce-modal-pop-enter-from,
.fotoce-modal-pop-leave-to {
  transform: scale3d(0.88, 0.88, 1) !important;
  opacity: 0;
}

/* ─── Fullscreen slide-up ─── */
.fotoce-modal-fs-enter-active,
.fotoce-modal-fs-leave-active {
  transition:
    transform var(--fotoce-dur-slow, 380ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1)),
    opacity var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.fotoce-modal-fs-enter-from,
.fotoce-modal-fs-leave-to {
  transform: translate3d(0, 100%, 0) !important;
  opacity: 0;
}

/* ─── Floating spring small ─── */
.fotoce-modal-floating-enter-active,
.fotoce-modal-floating-leave-active {
  transition:
    transform var(--fotoce-dur-medium, 260ms) var(--fotoce-ease-iosOvershoot, cubic-bezier(0.34, 1.56, 0.64, 1)),
    opacity var(--fotoce-dur-fast, 180ms) var(--fotoce-ease-iosOut, cubic-bezier(0.22, 1, 0.36, 1));
}
.fotoce-modal-floating-enter-from,
.fotoce-modal-floating-leave-to {
  transform: scale3d(0.92, 0.92, 1) translate3d(0, 12px, 0) !important;
  opacity: 0;
}

/* ─── Fade fallback (reduced motion) ─── */
.fotoce-modal-fade-enter-active,
.fotoce-modal-fade-leave-active {
  transition: opacity var(--fotoce-dur-fast, 180ms) ease;
}
.fotoce-modal-fade-enter-from,
.fotoce-modal-fade-leave-to { opacity: 0; }

@media (prefers-reduced-motion: reduce) {
  .fotoce-modal-sheet-enter-from,
  .fotoce-modal-sheet-leave-to,
  .fotoce-modal-pop-enter-from,
  .fotoce-modal-pop-leave-to,
  .fotoce-modal-fs-enter-from,
  .fotoce-modal-fs-leave-to,
  .fotoce-modal-floating-enter-from,
  .fotoce-modal-floating-leave-to {
    transform: none !important;
  }
}
</style>

<!-- Body scroll-lock global : ajouté hors scoped pour cibler body. -->
<style>
body.fotoce-modal-scroll-lock {
  overflow: hidden;
}
</style>
