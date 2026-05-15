/**
 * Sur mobile (< lg), le scroll principal est porté par `<main id="main-content">`
 * (voir App.vue : `max-lg:overflow-y-auto`). Sur desktop, c’est le document.
 */
export function getAppScrollRoot(): HTMLElement {
  if (typeof document === 'undefined') {
    return null as unknown as HTMLElement
  }
  const main = document.getElementById('main-content')
  if (main && typeof window !== 'undefined' && window.matchMedia('(max-width: 1023px)').matches) {
    return main
  }
  return (document.scrollingElement ?? document.documentElement) as HTMLElement
}
