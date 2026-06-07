/** Font Awesome — chargé à la demande sur les routes creator / contest (pas dans le bundle initial). */

let loaded = false
let loading: Promise<void> | null = null

export function ensureFontAwesomeLoaded(): Promise<void> {
  if (loaded) return Promise.resolve()
  if (!loading) {
    loading = import('@fortawesome/fontawesome-free/css/all.min.css').then(() => {
      loaded = true
    })
  }
  return loading
}

export function preloadFontAwesome(): void {
  void ensureFontAwesomeLoaded()
}
