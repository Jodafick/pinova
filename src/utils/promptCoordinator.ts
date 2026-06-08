/** Évite d’enchaîner plusieurs modales d’opt-in (notifications puis PWA). */
const MIN_GAP_MS = 45 * 60 * 1000

let lastPromptShownAt = 0
let notificationPromptOpen = false

export function markPromptShown(): void {
  lastPromptShownAt = Date.now()
}

export function canShowPromptAfter(minGapMs = MIN_GAP_MS): boolean {
  if (notificationPromptOpen) return false
  return Date.now() - lastPromptShownAt >= minGapMs
}

export function setNotificationPromptOpen(open: boolean): void {
  notificationPromptOpen = open
  if (open) markPromptShown()
}

export function isNotificationPromptOpen(): boolean {
  return notificationPromptOpen
}
