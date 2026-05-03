import { computed, type Ref } from 'vue'
import {
  autoUpdate,
  flip,
  offset,
  shift,
  size,
  useFloating,
  type Middleware,
  type Placement,
  type Strategy,
} from '@floating-ui/vue'

type Options = {
  open: Ref<boolean>
  placement?: Placement
  strategy?: Strategy
  /** Aligne la largeur du panneau sur la référence (ex. champ recherche header). */
  matchReferenceWidth?: boolean
  offsetPx?: number
}

/** Positionnement Floating UI avec autoUpdate pour scroll / resize. */
export function useAnchoredDropdown(
  reference: Readonly<Ref<HTMLElement | null>>,
  floating: Readonly<Ref<HTMLElement | null>>,
  options: Options,
) {
  const middleware = computed<Middleware[]>(() => {
    const m: Middleware[] = [
      offset(options.offsetPx ?? 8),
      flip({ padding: 8 }),
      shift({ padding: 8 }),
    ]
    if (options.matchReferenceWidth) {
      m.push(
        size({
          padding: 8,
          apply({ rects, elements }) {
            Object.assign(elements.floating.style, {
              width: `${rects.reference.width}px`,
              minWidth: `${rects.reference.width}px`,
            })
          },
        }),
      )
    }
    return m
  })

  const { floatingStyles, update } = useFloating(reference, floating, {
    open: computed(() => options.open.value),
    placement: computed(() => options.placement ?? 'bottom-start'),
    strategy: computed(() => options.strategy ?? 'fixed'),
    middleware,
    whileElementsMounted: autoUpdate,
    transform: true,
  })

  return { floatingStyles, update }
}
