/**
 * Point d’entrée unique pour ouvrir la modale PWA depuis `App.vue` / composables
 * sans prop drilling (évite un store global lourd).
 */
let openPwaInstallImpl: (() => void) | null = null

export function registerPwaInstallOpener(fn: (() => void) | null): void {
  openPwaInstallImpl = fn
}

export function requestPwaInstallModalOpen(): void {
  openPwaInstallImpl?.()
}
