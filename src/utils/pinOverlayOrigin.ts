export type PinOverlayOriginRect = {
  left: number
  top: number
  width: number
  height: number
}

let pendingOrigin: { slug: string; rect: PinOverlayOriginRect } | null = null

export function elementToPinOverlayOriginRect(el: Element | null): PinOverlayOriginRect | null {
  if (!el) return null
  const rect = el.getBoundingClientRect()
  if (rect.width <= 0 || rect.height <= 0) return null
  return {
    left: rect.left,
    top: rect.top,
    width: rect.width,
    height: rect.height,
  }
}

export function setPinOverlayOrigin(slug: string, rect: PinOverlayOriginRect | null | undefined) {
  pendingOrigin = rect ? { slug, rect } : null
}

export function consumePinOverlayOrigin(slug: string): PinOverlayOriginRect | null {
  if (!pendingOrigin || pendingOrigin.slug !== slug) return null
  const rect = pendingOrigin.rect
  pendingOrigin = null
  return rect
}
