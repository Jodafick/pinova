/**
 * Couleur de fond d’avatar : l’API peut renvoyer une classe Tailwind (`bg-rose-500`)
 * ou une couleur CSS (`#aabbcc`, `rgb()`, `hsl()`). Les classes dynamiques HEX ne sont pas
 * générées par Tailwind — on applique alors `backgroundColor` en style inline.
 */

const HEX_RE = /^#([0-9a-f]{3}|[0-9a-f]{6}|[0-9a-f]{8})$/i

export function isCssColorValue(raw: string): boolean {
  const s = raw.trim()
  if (!s) return false
  if (HEX_RE.test(s)) return true
  if (/^rgba?\(/i.test(s)) return true
  if (/^hsla?\(/i.test(s)) return true
  return false
}

/** Classe Tailwind de fond, ou chaîne vide si la couleur sera en `style` inline. */
export function avatarBgTailwindClass(color: string | null | undefined, fallback = 'bg-neutral-400'): string {
  const raw = (color ?? '').trim()
  if (!raw) return fallback
  if (isCssColorValue(raw)) return ''
  return raw
}

/** Style inline pour HEX / rgb() / hsl() ; sinon vide (fond = classe Tailwind). */
export function avatarBgStyle(color: string | null | undefined): Record<string, string> {
  const raw = (color ?? '').trim()
  if (isCssColorValue(raw)) return { backgroundColor: raw }
  return {}
}
