import type { Router } from 'vue-router'
import type { FeedItem } from '../types'
import { isFeedFoto, isSponsoredAd } from '../types'
import { mergeRouteQuery, routeSupportsPinOverlay, type PinOverlayRouteContext } from './fotoOverlayNavigation'

export function feedItemOverlayKey(item: FeedItem): string | null {
  if (isFeedFoto(item)) return item.slug
  if (isSponsoredAd(item)) return item.id
  return null
}

export function findFeedOverlayIndex(items: FeedItem[], query: { foto?: string; sponsored?: string }): number {
  const slug = (query.foto || '').trim()
  const sponsoredId = (query.sponsored || '').trim()
  if (slug) {
    return items.findIndex((row) => isFeedFoto(row) && row.slug === slug)
  }
  if (sponsoredId) {
    return items.findIndex((row) => isSponsoredAd(row) && row.id === sponsoredId)
  }
  return -1
}

export function siblingFeedItem(items: FeedItem[], index: number, direction: 1 | -1): FeedItem | null {
  if (index < 0) return null
  return items[index + direction] ?? null
}

export function pushFeedItemOverlay(
  router: Router,
  item: FeedItem,
  opts?: { routeContext?: PinOverlayRouteContext },
): void {
  const routeName = opts?.routeContext
    ? router.resolve({ path: opts.routeContext.path, query: opts.routeContext.query }).name
    : router.currentRoute.value.name
  const supportsOverlay = routeSupportsPinOverlay(routeName)

  let path = '/'
  let baseQuery: PinOverlayRouteContext['query'] = {}
  if (supportsOverlay) {
    if (opts?.routeContext) {
      path = opts.routeContext.path
      baseQuery = opts.routeContext.query
    } else {
      path = router.currentRoute.value.path
      baseQuery = router.currentRoute.value.query as PinOverlayRouteContext['query']
    }
  }

  const patch: Record<string, string> = {}
  if (isFeedFoto(item)) {
    patch.pin = item.slug
    patch.sponsored = ''
  } else if (isSponsoredAd(item)) {
    patch.sponsored = item.id
    patch.pin = ''
  } else {
    return
  }

  const merged = mergeRouteQuery(baseQuery, patch)
  if (!patch.pin) delete merged.pin
  if (!patch.sponsored) delete merged.sponsored

  router.push({ path, query: merged })
}
