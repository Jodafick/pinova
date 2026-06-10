/**
 * Charge Material Symbols en subset (icon_names) — beaucoup plus léger que la police complète.
 */
import { materialSymbolsStylesheetHref } from '../generated/materialIconSubset'

let loading: Promise<void> | null = null

export function ensureMaterialSymbolsLoaded(): Promise<void> {
  if (typeof document === 'undefined') return Promise.resolve()
  if (document.getElementById('pinova-material-symbols-subset')) {
    return loading ?? Promise.resolve()
  }
  if (loading) return loading

  loading = new Promise((resolve) => {
    const href = materialSymbolsStylesheetHref()
    const link = document.createElement('link')
    link.id = 'pinova-material-symbols-subset'
    link.rel = 'stylesheet'
    link.href = href
    link.media = 'print'
    link.onload = () => {
      link.media = 'all'
      resolve()
    }
    link.onerror = () => resolve()
    document.head.appendChild(link)
  })

  return loading
}
