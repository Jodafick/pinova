/**
 * Virtualisation scroll pour grille masonry — utilise le scroll root Pinova
 * (`#main-content` mobile, document desktop).
 */
import { computed, onBeforeUnmount, onMounted, ref, watch, type Ref } from 'vue'
import {
  layoutMasonryShortestColumn,
  type MasonryCell,
  MASONRY_GAP_PX,
} from '../utils/masonryLayout'
import { getAppScrollRoot } from '../utils/appScrollRoot'

export interface MasonryVirtualItem {
  cellIndex: number
  lane: number
  top: number
  height: number
  cell: MasonryCell
}

export function useMasonryScrollVirtual(options: {
  cells: Ref<MasonryCell[]>
  columnCount: Ref<number>
  containerRef: Ref<HTMLElement | null>
  overscanPx?: number
  measuredHeights: Ref<Map<number, number>>
  gap?: number
}) {
  const scrollTop = ref(0)
  const viewportHeight = ref(800)
  const scrollMargin = ref(0)
  const overscan = options.overscanPx ?? 480

  const layout = computed(() => {
    const el = options.containerRef.value
    const width = el?.clientWidth || (typeof window !== 'undefined' ? window.innerWidth - 24 : 360)
    return layoutMasonryShortestColumn(
      options.cells.value,
      options.columnCount.value,
      width,
      options.gap ?? MASONRY_GAP_PX,
      options.measuredHeights.value,
    )
  })

  const totalHeight = computed(() => layout.value.totalHeight)
  const colWidth = computed(() => layout.value.colWidth)

  const visibleItems = computed((): MasonryVirtualItem[] => {
    const top = scrollTop.value - overscan
    const bottom = scrollTop.value + viewportHeight.value + overscan
    return layout.value.placed.filter((p) => p.top + p.height >= top && p.top <= bottom)
  })

  let raf = 0
  function syncScroll() {
    const root = getAppScrollRoot()
    scrollTop.value = root.scrollTop
    viewportHeight.value = root.clientHeight || window.innerHeight
    const el = options.containerRef.value
    if (el) {
      const rect = el.getBoundingClientRect()
      const rootRect = root.getBoundingClientRect()
      scrollMargin.value = rect.top - rootRect.top + root.scrollTop
    }
  }

  function onScroll() {
    if (raf) return
    raf = requestAnimationFrame(() => {
      raf = 0
      syncScroll()
    })
  }

  let detach: (() => void) | null = null

  function attach() {
    detach?.()
    if (typeof window === 'undefined') return
    syncScroll()
    const root = getAppScrollRoot()
    root.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll, { passive: true })
    detach = () => {
      root.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
    }
  }

  onMounted(() => {
    attach()
  })
  onBeforeUnmount(() => {
    detach?.()
    if (raf) cancelAnimationFrame(raf)
  })

  watch(options.containerRef, () => {
    syncScroll()
  })
  watch([options.cells, options.columnCount, options.measuredHeights], () => {
    syncScroll()
  })

  return {
    visibleItems,
    totalHeight,
    colWidth,
    scrollMargin,
    layout,
    syncScroll,
    attach,
  }
}
