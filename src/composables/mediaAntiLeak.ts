/** Classe CSS : touch-callout, user-select, -webkit-user-drag (voir style.css). */
export const PIN_MEDIA_ANTI_LEAK_CLASS = 'pin-media-antileak'

function preventDefaultEvent(e: Event) {
  e.preventDefault()
}

/** Raccourcis menu contextuel / glisser (desktop). Compléter par la classe CSS pour iOS Safari. */
export function pinMediaAntiLeakImgBindings() {
  return {
    draggable: false as const,
    onContextmenu: preventDefaultEvent,
    onDragstart: preventDefaultEvent,
    onSelectstart: preventDefaultEvent,
  }
}

/**
 * Vidéo : même blocage clic droit ; si contrôles natifs, désactive PiP et masque téléchargement
 * où l’API le permet (Chrome). Aucune garantie sur iOS — combiner avec TTL / droits serveur pour la vraie protection.
 */
export function pinMediaAntiLeakVideoBindings(nativeControls?: boolean) {
  return {
    onContextmenu: preventDefaultEvent,
    onDragstart: preventDefaultEvent,
    onSelectstart: preventDefaultEvent,
    ...(nativeControls
      ? ({
          controlsList: 'nodownload noplaybackrate',
          disablePictureInPicture: true,
        } as const)
      : {}),
  }
}
