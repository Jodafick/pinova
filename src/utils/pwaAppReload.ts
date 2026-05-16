/**
 * Recharge Pinova depuis l’intérieur d’une PWA installée (standalone) :
 * même fenêtre que l’app, sans la désinstaller ni la rouvrir depuis l’écran d’accueil.
 * Demande d’abord une mise à jour du service worker (si présent), puis `location.reload()`.
 */
export async function reloadPwaApplication(): Promise<void> {
  if (typeof window === 'undefined') return
  try {
    if ('serviceWorker' in navigator) {
      const reg = await navigator.serviceWorker.getRegistration()
      await reg?.update()
    }
  } catch {
    /* ignore */
  }
  window.location.reload()
}
