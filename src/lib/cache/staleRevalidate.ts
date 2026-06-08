/**
 * Helpers SWR : comparaison légère + exécution fire-and-forget sans bloquer l’UI.
 */

export function shallowJsonEqual(a: unknown, b: unknown): boolean {
  if (a === b) return true
  try {
    return JSON.stringify(a) === JSON.stringify(b)
  } catch {
    return false
  }
}

/** Lance une tâche en arrière-plan ; les erreurs sont silencieuses par défaut. */
export function runBackground(task: () => Promise<void>, onError?: (err: unknown) => void): void {
  void task().catch((err) => {
    if (onError) onError(err)
  })
}
