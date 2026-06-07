/**
 * Codes d'erreur renvoyés par l'API Pinova (ex. login ciblé) → clés i18n.
 * Les chaînes inconnues sont renvoyées telles quelles (messages DRF bruts).
 */
const PINOVA_CODE_TO_I18N: Record<string, string> = {
  pinova_login_unknown_email: 'login.error.field.noAccount',
  pinova_login_wrong_password: 'login.error.field.wrongPassword',
  pinova_login_inactive: 'login.error.field.inactive',
  pinova_login_email_unverified: 'login.error.field.emailUnverified',
  'moderation.text_inappropriate': 'moderation.textInappropriate',
  'moderation.pin.title_inappropriate': 'create.fieldError.titleInappropriate',
  'moderation.pin.description_inappropriate': 'create.fieldError.descriptionInappropriate',
  'moderation.pin.public_tags_inappropriate': 'create.fieldError.publicTagsInappropriate',
  'upload.image.invalid_type': 'create.upload.error.invalidType',
  'upload.image.polyglot': 'create.upload.error.polyglot',
  'upload.image.too_large': 'create.upload.error.tooLarge',
  'upload.video.invalid_type': 'create.upload.error.videoInvalidType',
  'upload.video.polyglot': 'create.upload.error.videoPolyglot',
  'upload.processing_failed': 'create.upload.error.processingFailed',
}

export function translatePinovaErrorToken(raw: string, t: (key: string) => string): string {
  const code = String(raw || '').trim()
  if (!code) return ''
  const key = PINOVA_CODE_TO_I18N[code]
  return key ? t(key) : raw
}

export function translatePinovaNonFieldToken(raw: string, t: (key: string) => string): string {
  return translatePinovaErrorToken(raw, t)
}
