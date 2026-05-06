import { flushOfflineActions } from './queue'

let syncTimer: number | null = null
let syncing = false

export async function runSyncNow(): Promise<void> {
  if (syncing || typeof navigator === 'undefined' || !navigator.onLine) return
  syncing = true
  try {
    await flushOfflineActions()
  } finally {
    syncing = false
  }
}

export function startSyncEngine(intervalMs = 10_000): void {
  if (typeof window === 'undefined') return
  if (syncTimer != null) return

  const onOnline = () => {
    void runSyncNow()
  }
  window.addEventListener('online', onOnline)
  syncTimer = window.setInterval(() => {
    void runSyncNow()
  }, intervalMs)
}

export function stopSyncEngine(): void {
  if (syncTimer != null) {
    window.clearInterval(syncTimer)
    syncTimer = null
  }
}
