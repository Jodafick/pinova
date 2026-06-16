/** Clé partagée avec `PwaInstallExperience.vue` — ne pas dupliquer. */
export const PWA_INSTALL_SNOOZE_KEY = 'fotoce:pwa:install:snoozedUntil'

export function getPwaInstallSnoozeUntilMs(): number {
  if (typeof localStorage === 'undefined') return 0
  const raw = localStorage.getItem(PWA_INSTALL_SNOOZE_KEY)
  if (!raw) return 0
  const until = parseInt(raw, 10)
  return Number.isFinite(until) ? until : 0
}

export function isPwaInstallSnoozed(): boolean {
  return Date.now() < getPwaInstallSnoozeUntilMs()
}
