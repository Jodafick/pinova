/** Font Awesome chargé globalement dans `main.ts`. Conservé pour compatibilité éventuelle. */

export function ensureFontAwesomeLoaded(): Promise<void> {
  return Promise.resolve()
}

export function preloadFontAwesome(): void {
  /* no-op */
}
