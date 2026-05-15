/**
 * Composable scroll preservation pour les éléments scrollables internes.
 *
 * Marque un élément avec `data-scroll-id` et sauvegarde/restaure
 * automatiquement la position quand la couche est démontée puis remontée.
 *
 * Le `layerManager` snapshote déjà le scroll global au push d'une couche ;
 * ce composable étend la mécanique aux scrollers internes (feed virtualisé,
 * onglets, etc.).
 */

import { onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'

const persistedScrolls = new Map<string, { x: number; y: number }>()

export interface UseScrollPreservationOptions {
  /** Identifiant unique (route + composant). */
  id: string
  /** Élément scrollable (par défaut window). */
  el?: Ref<HTMLElement | null>
  /** Restaurer automatiquement au mount. Par défaut `true`. */
  autoRestore?: boolean
}

export function useScrollPreservation(options: UseScrollPreservationOptions) {
  const { id, el, autoRestore = true } = options
  const restored = ref(false)

  function save() {
    const target = el?.value
    if (target) {
      persistedScrolls.set(id, { x: target.scrollLeft, y: target.scrollTop })
    } else if (typeof window !== 'undefined') {
      persistedScrolls.set(id, { x: window.scrollX, y: window.scrollY })
    }
  }

  function restore() {
    const saved = persistedScrolls.get(id)
    if (!saved) {
      restored.value = true
      return
    }
    const target = el?.value
    /* 2 rAF : laisser le rendu se stabiliser (images, layout). */
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        if (target) {
          target.scrollTop = saved.y
          target.scrollLeft = saved.x
        } else if (typeof window !== 'undefined') {
          window.scrollTo({ left: saved.x, top: saved.y, behavior: 'instant' as ScrollBehavior })
        }
        restored.value = true
      })
    })
  }

  function clear() {
    persistedScrolls.delete(id)
  }

  /** Attaché à l'élément cible pour intercepter les scrolls et tracker passivement. */
  let lastSave = 0
  function onScrollPassive() {
    /* Throttle léger 120ms pour ne pas Map.set à chaque pixel. */
    const now = performance.now()
    if (now - lastSave < 120) return
    lastSave = now
    save()
  }

  onMounted(() => {
    if (autoRestore) restore()
    const target = el?.value
    if (target) {
      target.addEventListener('scroll', onScrollPassive, { passive: true })
      target.setAttribute('data-scroll-id', id)
    } else if (typeof window !== 'undefined') {
      window.addEventListener('scroll', onScrollPassive, { passive: true })
    }
  })

  /* Si l'élément cible change après mount (ref Vue), on rebind. */
  if (el) {
    watch(el, (next, prev) => {
      if (prev) prev.removeEventListener('scroll', onScrollPassive)
      if (next) {
        next.addEventListener('scroll', onScrollPassive, { passive: true })
        next.setAttribute('data-scroll-id', id)
      }
    })
  }

  onBeforeUnmount(() => {
    save()
    const target = el?.value
    if (target) {
      target.removeEventListener('scroll', onScrollPassive)
    } else if (typeof window !== 'undefined') {
      window.removeEventListener('scroll', onScrollPassive)
    }
  })

  return {
    save,
    restore,
    clear,
    restored,
  }
}
