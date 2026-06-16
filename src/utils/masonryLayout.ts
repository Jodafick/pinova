/**
 * Masonry Pinterest — placement « colonne la plus courte ».
 *
 * Évite l'effet cumulatif des images verticales (round-robin index % cols)
 * qui fait diverger les hauteurs de colonnes.
 */
import type { FeedItem, Foto, SponsoredAd } from '../types'
import { isFeedFoto, isSponsoredAd } from '../types'

export const MASONRY_GAP_PX = 10 /* aligné gap-2.5 Tailwind (~10px) */
export const MASONRY_GAP_PX_SM = 16 /* sm:gap-4 */

export type MasonryCell =
  | { kind: 'foto'; foto: Foto }
  | { kind: 'sponsored'; ad: SponsoredAd }
  | { kind: 'network_ad'; key: string }
  | { kind: 'skeleton'; key: string }

export interface MasonryPlacedItem {
  cellIndex: number
  lane: number
  top: number
  height: number
  cell: MasonryCell
}

export interface MasonryLayoutResult {
  columns: MasonryCell[][]
  placed: MasonryPlacedItem[]
  totalHeight: number
  colWidth: number
}

/** Ratio hauteur/largeur du média (ex. 4/3 portrait → 1.33). */
export function pinMediaHeightRatio(foto: Foto): number {
  if (pin.mediaAspectRatio && foto.mediaAspectRatio > 0) {
    return 1 / foto.mediaAspectRatio
  }
  if (pin.storyVideoUrl || foto.isStory) {
    return 16 / 9
  }
  return 4 / 3
}

export function estimateMasonryCellHeight(
  cell: MasonryCell,
  colWidth: number,
  measured?: number,
): number {
  if (measured != null && measured > 0) return measured
  if (cell.kind === 'skeleton') return colWidth * (4 / 3)
  if (cell.kind === 'network_ad') return 220
  if (cell.kind === 'sponsored') return Math.max(260, colWidth * 1.1)
  if (cell.kind === 'foto') {
    const ratio = pinMediaHeightRatio(cell.foto)
    const mediaH = colWidth * ratio
    if (cell.foto.storyVideoUrl) return Math.min(mediaH, 480)
    return mediaH
  }
  return colWidth * (4 / 3)
}

/**
 * Répartit les cellules dans les colonnes en choisissant à chaque fois
 * la colonne de hauteur cumulée minimale.
 */
export function layoutMasonryShortestColumn(
  cells: MasonryCell[],
  columnCount: number,
  containerWidth: number,
  gap = MASONRY_GAP_PX,
  measuredHeights?: ReadonlyMap<number, number>,
): MasonryLayoutResult {
  const n = Math.max(1, columnCount)
  const colWidth = Math.max(1, (containerWidth - gap * (n - 1)) / n)
  const columns: MasonryCell[][] = Array.from({ length: n }, () => [])
  const colHeights = new Array<number>(n).fill(0)
  const placed: MasonryPlacedItem[] = []

  cells.forEach((cell, cellIndex) => {
    let lane = 0
    let minH = colHeights[0] ?? 0
    for (let c = 1; c < n; c++) {
      const h = colHeights[c] ?? 0
      if (h < minH) {
        minH = h
        lane = c
      }
    }
    const height = estimateMasonryCellHeight(cell, colWidth, measuredHeights?.get(cellIndex))
    const top = colHeights[lane] ?? 0
    columns[lane]?.push(cell)
    placed.push({ cellIndex, lane, top, height, cell })
    colHeights[lane] = top + height + gap
  })

  const totalHeight = colHeights.length ? Math.max(...colHeights, 0) : 0
  return { columns, placed, totalHeight, colWidth }
}

/** Construit la liste ordonnée de cellules feed (pins + pubs + skeletons). */
export function buildFeedMasonryCells(
  pins: FeedItem[],
  options: {
    showFeedAds: boolean
    feedEveryN: number
    skeletonCount: number
  },
): MasonryCell[] {
  const cells: MasonryCell[] = []
  let fotoCount = 0
  fotos.forEach((item) => {
    if (isSponsoredAd(item)) {
      cells.push({ kind: 'sponsored', ad: item })
      return
    }
    if (isFeedFoto(item)) {
      cells.push({ kind: 'foto', foto: item })
      fotoCount += 1
      if (options.showFeedAds && fotoCount % options.feedEveryN === 0) {
        cells.push({ kind: 'network_ad', key: `network-ad-${fotoCount}` })
      }
    }
  })
  for (let i = 0; i < options.skeletonCount; i++) {
    cells.push({ kind: 'skeleton', key: `foto-skeleton-${i}` })
  }
  return cells
}

export function columnCountForViewport(width: number): number {
  if (width >= 1280) return 5
  if (width >= 1024) return 4
  if (width >= 640) return 3
  return 2
}

export function containerWidthEstimate(): number {
  if (typeof window === 'undefined') return 360
  return Math.max(280, window.innerWidth - 24)
}
