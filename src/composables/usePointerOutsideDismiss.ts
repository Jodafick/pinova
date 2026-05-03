import { onMounted, onUnmounted, type Ref } from 'vue'

export interface OutsideDismissScope {
  isOpen: Readonly<Ref<boolean>>
  /** Clic hors de ces racines ferme cette portée (bouton déclencheur + panneau téléporté, etc.). */
  getRoots: () => readonly (HTMLElement | null | undefined)[]
  close: () => void
}

/**
 * Phase capture pour que la fermeture reste prévisible même avec @click.stop sur les enfants.
 * Chaque groupe indépendant : si ouvert et le clic est hors de toutes ses racines → close().
 */
export function usePointerOutsideDismiss(getScopes: () => readonly OutsideDismissScope[]): void {
  function onPointerDown(ev: PointerEvent) {
    const target = ev.target
    if (!target || !(target instanceof Node)) return
    const scopes = getScopes()
    for (const scope of scopes) {
      if (!scope.isOpen.value) continue
      const roots = scope.getRoots().filter((el): el is HTMLElement => el instanceof HTMLElement)
      if (roots.length === 0) {
        scope.close()
        continue
      }
      if (!roots.some((r) => r.contains(target))) {
        scope.close()
      }
    }
  }

  onMounted(() => {
    document.addEventListener('pointerdown', onPointerDown, true)
  })
  onUnmounted(() => {
    document.removeEventListener('pointerdown', onPointerDown, true)
  })
}
