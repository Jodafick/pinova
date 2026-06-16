/**
 * Réinitialise les effets visuels / verrous appliqués sur `#app-shell` et le document.
 *
 * Sur mobile réel (PWA / WebKit), plusieurs sous-systèmes posent des styles inline
 * sur `#app-shell` (blur, scale, translate) ou verrouillent le scroll :
 *   - LayerHost (couches fullscreen/modal)
 *   - FotoceModal (depth effect)
 *   - useEdgeSwipeBack (translate3d pendant le geste retour)
 *
 * Si une couche ou une modale ne se démonte pas proprement (race navigation,
 * router.replace, bfcache iOS), l'écran reste flou / blanc-noir et non cliquable.
 * Cette fonction sert de filet de sécurité centralisé.
 */

import { profileNavMobileDrawerOpen } from '../composables/mobileHeaderContext'
import { clearProfileDrawerPwaTheme } from '../composables/usePwaTheme'
import { getAppScrollRoot } from './appScrollRoot'
import { resetFotoceBodyScrollLock } from './fotoceModalBodyLock'

export interface ResetAppShellVisualStateOptions {
  /** Force le thème PWA du tiroir profil à se réinitialiser même si le flag global dit ouvert. */
  forceClearDrawerTheme?: boolean
  /** Restaure overflow html/body/#main-content (utile quand le tiroir profil a laissé hidden). */
  resetOverflow?: boolean
}

export function resetAppShellVisualState(options: ResetAppShellVisualStateOptions = {}): void {
  if (typeof document === 'undefined') return

  const shell = document.getElementById('app-shell')
  if (shell) {
    shell.style.transform = ''
    shell.style.filter = ''
    shell.style.opacity = ''
    shell.style.boxShadow = ''
    shell.style.transition = ''
    shell.style.willChange = ''
    shell.style.transformOrigin = ''
  }

  document.documentElement.classList.remove('fotoce-layer-scroll-lock')
  document.body.classList.remove('fotoce-modal-scroll-lock', 'fotoce-splash-locked')
  resetFotoceBodyScrollLock()

  const drawerOpen = profileNavMobileDrawerOpen.value
  if (options.forceClearDrawerTheme || !drawerOpen) {
    clearProfileDrawerPwaTheme()
  }

  if (options.resetOverflow && !drawerOpen) {
    document.documentElement.style.overflow = ''
    document.body.style.overflow = ''
    const scrollRoot = getAppScrollRoot()
    if (scrollRoot && scrollRoot !== document.documentElement && scrollRoot !== document.body) {
      scrollRoot.style.overflow = ''
    }
  }
}
