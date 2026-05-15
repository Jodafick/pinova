import { ref, shallowRef } from 'vue'

/** Titre dynamique (ex. nom de tableau) — prioritaire sur le titre déduit de la route. */
export const mobileHeaderTitleOverride = ref<string | null>(null)

export function setMobileHeaderTitle(title: string | null) {
  const s = title?.trim()
  mobileHeaderTitleOverride.value = s || null
}

/** Bouton droit sur la route profil (ex. menu burger → tiroir nav). */
export type MobileProfileTrailing = {
  ariaLabel: string
  icon: 'menu' | 'more_horiz'
  onClick: () => void
}

export const mobileProfileTrailing = shallowRef<MobileProfileTrailing | null>(null)

export function setMobileProfileTrailing(payload: MobileProfileTrailing | null) {
  mobileProfileTrailing.value = payload
}

/** Bouton « plus » tableau (détail board) — rendu dans `AppMobilePageHeader` (fixe). */
export type MobileBoardMoreTrailing = {
  ariaLabel: string
  onClick: () => void
}

export const mobileBoardMoreTrailing = shallowRef<MobileBoardMoreTrailing | null>(null)

export function setMobileBoardMoreTrailing(payload: MobileBoardMoreTrailing | null) {
  mobileBoardMoreTrailing.value = payload
}

/** Sous-titre sous le titre (ex. « N non lue(s) » sur la page notifications). */
export const mobileHeaderSubtitle = ref<string | null>(null)

export function setMobileHeaderSubtitle(value: string | null) {
  const s = value?.trim()
  mobileHeaderSubtitle.value = s || null
}

/** Bouton « tout marquer comme lu » (header mobile droite). */
export type MobileMarkAllReadTrailing = {
  ariaLabel: string
  onClick: () => void
}

export const mobileMarkAllReadTrailing = shallowRef<MobileMarkAllReadTrailing | null>(null)

export function setMobileMarkAllReadTrailing(payload: MobileMarkAllReadTrailing | null) {
  mobileMarkAllReadTrailing.value = payload
}

/** Référence DOM du bouton ⋮ board (fermeture menu au clic extérieur). */
export const mobileBoardMoreButtonRef = ref<HTMLElement | null>(null)
