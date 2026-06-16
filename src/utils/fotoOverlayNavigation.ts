import type { Router } from 'vue-router'

/** Routes KeepAlive qui embarquent `FotoDetailOverlayHost`. */
export const PIN_OVERLAY_ROUTE_NAMES = new Set([
  'home',
  'profile',
  'explore',
  'explore-boards',
  'following',
  'board',
  'notifications',
])

export type PinOverlayRouteContext = {
  path: string
  query: Record<string, string | string[] | undefined>
}

export function mergeRouteQuery(
  base: Record<string, string | string[] | undefined> | undefined,
  patch: Record<string, string>,
): Record<string, string | string[]> {
  const out: Record<string, string | string[]> = {}
  if (base) {
    for (const [k, v] of Object.entries(base)) {
      if (v === undefined) continue
      if (typeof v === 'string' && v) out[k] = v
      else if (Array.isArray(v) && v.length) out[k] = v
    }
  }
  for (const [k, v] of Object.entries(patch)) {
    out[k] = v
  }
  return out
}

export function routeSupportsPinOverlay(routeName: string | symbol | null | undefined): boolean {
  return PIN_OVERLAY_ROUTE_NAMES.has(String(routeName || ''))
}

function resolveRouteName(
  router: Router,
  ctx?: PinOverlayRouteContext,
): string | symbol | null | undefined {
  if (ctx) {
    return router.resolve({ path: ctx.path, query: ctx.query }).name
  }
  return router.currentRoute.value.name
}

/**
 * Ouvre la fiche foto en overlay (`?foto=`) sur la page courante quand possible,
 * sans passer par le redirect `/foto/:slug` → `/`.
 */
export function pushFotoDetailOverlay(
  router: Router,
  fotoSlug: string,
  opts?: {
    commentId?: string
    routeContext?: PinOverlayRouteContext
    /** Clic notification hors page overlay : repli sur /notifications plutôt que home. */
    preferNotificationsFallback?: boolean
  },
): void {
  const slug = fotoSlug.trim()
  if (!slug) return

  const patch: Record<string, string> = { foto: slug }
  if (opts?.commentId) patch.commentId = opts.commentId

  const routeName = resolveRouteName(router, opts?.routeContext)
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
  } else if (opts?.preferNotificationsFallback) {
    path = '/notifications'
    baseQuery = {}
  }

  router.push({
    path,
    query: mergeRouteQuery(baseQuery, patch),
  })
}
