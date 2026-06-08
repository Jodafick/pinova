export type PinovaLanguage = {
  code: string
  /** Libellé en français (UI par défaut) */
  label: string
  /** Nom dans la langue elle-même */
  nativeLabel: string
  flag: string
  rtl?: boolean
  /** Code Google Translate ; absent = traduction manuelle uniquement */
  googleCode?: string
  region: 'europe' | 'africa' | 'asia' | 'americas' | 'middle-east' | 'oceania'
}

export const PINOVA_LANGUAGES: readonly PinovaLanguage[] = [
  { code: 'fr', label: 'Français', nativeLabel: 'Français', flag: '🇫🇷', googleCode: 'fr', region: 'europe' },
  { code: 'en', label: 'Anglais', nativeLabel: 'English', flag: '🇬🇧', googleCode: 'en', region: 'europe' },
  { code: 'es', label: 'Espagnol', nativeLabel: 'Español', flag: '🇪🇸', googleCode: 'es', region: 'europe' },
  { code: 'pt', label: 'Portugais', nativeLabel: 'Português', flag: '🇵🇹', googleCode: 'pt', region: 'europe' },
  { code: 'ar', label: 'Arabe', nativeLabel: 'العربية', flag: '🇸🇦', rtl: true, googleCode: 'ar', region: 'middle-east' },
  { code: 'hi', label: 'Hindi', nativeLabel: 'हिन्दी', flag: '🇮🇳', googleCode: 'hi', region: 'asia' },
  { code: 'zh', label: 'Chinois simplifié', nativeLabel: '简体中文', flag: '🇨🇳', googleCode: 'zh-CN', region: 'asia' },
  { code: 'ru', label: 'Russe', nativeLabel: 'Русский', flag: '🇷🇺', googleCode: 'ru', region: 'europe' },
  { code: 'de', label: 'Allemand', nativeLabel: 'Deutsch', flag: '🇩🇪', googleCode: 'de', region: 'europe' },
  { code: 'ja', label: 'Japonais', nativeLabel: '日本語', flag: '🇯🇵', googleCode: 'ja', region: 'asia' },
  { code: 'id', label: 'Indonésien', nativeLabel: 'Bahasa Indonesia', flag: '🇮🇩', googleCode: 'id', region: 'asia' },
  { code: 'tr', label: 'Turc', nativeLabel: 'Türkçe', flag: '🇹🇷', googleCode: 'tr', region: 'europe' },
  { code: 'ko', label: 'Coréen', nativeLabel: '한국어', flag: '🇰🇷', googleCode: 'ko', region: 'asia' },
  { code: 'it', label: 'Italien', nativeLabel: 'Italiano', flag: '🇮🇹', googleCode: 'it', region: 'europe' },
  { code: 'nl', label: 'Néerlandais', nativeLabel: 'Nederlands', flag: '🇳🇱', googleCode: 'nl', region: 'europe' },
  { code: 'vi', label: 'Vietnamien', nativeLabel: 'Tiếng Việt', flag: '🇻🇳', googleCode: 'vi', region: 'asia' },
  { code: 'th', label: 'Thaï', nativeLabel: 'ไทย', flag: '🇹🇭', googleCode: 'th', region: 'asia' },
  { code: 'pl', label: 'Polonais', nativeLabel: 'Polski', flag: '🇵🇱', googleCode: 'pl', region: 'europe' },
  { code: 'uk', label: 'Ukrainien', nativeLabel: 'Українська', flag: '🇺🇦', googleCode: 'uk', region: 'europe' },
  { code: 'bn', label: 'Bengali', nativeLabel: 'বাংলা', flag: '🇧🇩', googleCode: 'bn', region: 'asia' },
  { code: 'ur', label: 'Urdu', nativeLabel: 'اردو', flag: '🇵🇰', rtl: true, googleCode: 'ur', region: 'asia' },
  { code: 'fon', label: 'Fon', nativeLabel: 'Fɔngbè', flag: '🇧🇯', googleCode: 'fon', region: 'africa' },
  { code: 'yo', label: 'Yoruba', nativeLabel: 'Yorùbá', flag: '🇳🇬', googleCode: 'yo', region: 'africa' },
  { code: 'ee', label: 'Éwé', nativeLabel: 'Eʋegbe', flag: '🇬🇭', googleCode: 'ee', region: 'africa' },
  { code: 'ln', label: 'Lingala', nativeLabel: 'Lingála', flag: '🇨🇩', googleCode: 'ln', region: 'africa' },
  { code: 'bm', label: 'Bambara', nativeLabel: 'Bamanankan', flag: '🇲🇱', googleCode: 'bm', region: 'africa' },
  { code: 'wo', label: 'Wolof', nativeLabel: 'Wolof', flag: '🇸🇳', googleCode: 'wo', region: 'africa' },
  { code: 'dyu', label: 'Dioula', nativeLabel: 'Julakan', flag: '🇨🇮', googleCode: 'dyu', region: 'africa' },
  { code: 'ha', label: 'Haoussa', nativeLabel: 'Hausa', flag: '🇳🇪', googleCode: 'ha', region: 'africa' },
  { code: 'sw', label: 'Swahili', nativeLabel: 'Kiswahili', flag: '🇹🇿', googleCode: 'sw', region: 'africa' },
  { code: 'zu', label: 'Zoulou', nativeLabel: 'isiZulu', flag: '🇿🇦', googleCode: 'zu', region: 'africa' },
  { code: 'xh', label: 'Xhosa', nativeLabel: 'isiXhosa', flag: '🇿🇦', googleCode: 'xh', region: 'africa' },
  { code: 'ig', label: 'Igbo', nativeLabel: 'Igbo', flag: '🇳🇬', googleCode: 'ig', region: 'africa' },
  { code: 'fa', label: 'Persan', nativeLabel: 'فارسی', flag: '🇮🇷', rtl: true, googleCode: 'fa', region: 'middle-east' },
  { code: 'he', label: 'Hébreu', nativeLabel: 'עברית', flag: '🇮🇱', rtl: true, googleCode: 'he', region: 'middle-east' },
  { code: 'el', label: 'Grec', nativeLabel: 'Ελληνικά', flag: '🇬🇷', googleCode: 'el', region: 'europe' },
  { code: 'cs', label: 'Tchèque', nativeLabel: 'Čeština', flag: '🇨🇿', googleCode: 'cs', region: 'europe' },
  { code: 'ro', label: 'Roumain', nativeLabel: 'Română', flag: '🇷🇴', googleCode: 'ro', region: 'europe' },
  { code: 'hu', label: 'Hongrois', nativeLabel: 'Magyar', flag: '🇭🇺', googleCode: 'hu', region: 'europe' },
  { code: 'sv', label: 'Suédois', nativeLabel: 'Svenska', flag: '🇸🇪', googleCode: 'sv', region: 'europe' },
  { code: 'fi', label: 'Finnois', nativeLabel: 'Suomi', flag: '🇫🇮', googleCode: 'fi', region: 'europe' },
  { code: 'da', label: 'Danois', nativeLabel: 'Dansk', flag: '🇩🇰', googleCode: 'da', region: 'europe' },
  { code: 'no', label: 'Norvégien', nativeLabel: 'Norsk', flag: '🇳🇴', googleCode: 'no', region: 'europe' },
  { code: 'ca', label: 'Catalan', nativeLabel: 'Català', flag: '🇪🇸', googleCode: 'ca', region: 'europe' },
  { code: 'eu', label: 'Basque', nativeLabel: 'Euskara', flag: '🇪🇸', googleCode: 'eu', region: 'europe' },
  { code: 'gl', label: 'Galicien', nativeLabel: 'Galego', flag: '🇪🇸', googleCode: 'gl', region: 'europe' },
  { code: 'ta', label: 'Tamoul', nativeLabel: 'தமிழ்', flag: '🇮🇳', googleCode: 'ta', region: 'asia' },
  { code: 'te', label: 'Télougou', nativeLabel: 'తెలుగు', flag: '🇮🇳', googleCode: 'te', region: 'asia' },
  { code: 'ml', label: 'Malayalam', nativeLabel: 'മലയാളം', flag: '🇮🇳', googleCode: 'ml', region: 'asia' },
  { code: 'pa', label: 'Pendjabi', nativeLabel: 'ਪੰਜਾਬੀ', flag: '🇮🇳', googleCode: 'pa', region: 'asia' },
  { code: 'mr', label: 'Marathi', nativeLabel: 'मराठी', flag: '🇮🇳', googleCode: 'mr', region: 'asia' },
  { code: 'gu', label: 'Gujarati', nativeLabel: 'ગુજરાતી', flag: '🇮🇳', googleCode: 'gu', region: 'asia' },
  { code: 'ne', label: 'Népalais', nativeLabel: 'नेपाली', flag: '🇳🇵', googleCode: 'ne', region: 'asia' },
  { code: 'km', label: 'Khmer', nativeLabel: 'ខ្មែរ', flag: '🇰🇭', googleCode: 'km', region: 'asia' },
  { code: 'lo', label: 'Lao', nativeLabel: 'ລາວ', flag: '🇱🇦', googleCode: 'lo', region: 'asia' },
  { code: 'my', label: 'Birman', nativeLabel: 'မြန်မာ', flag: '🇲🇲', googleCode: 'my', region: 'asia' },
  { code: 'mn', label: 'Mongol', nativeLabel: 'Монгол', flag: '🇲🇳', googleCode: 'mn', region: 'asia' },
  { code: 'kk', label: 'Kazakh', nativeLabel: 'Қазақ', flag: '🇰🇿', googleCode: 'kk', region: 'asia' },
] as const

export type LangCode = (typeof PINOVA_LANGUAGES)[number]['code']

const byCode = new Map(PINOVA_LANGUAGES.map((l) => [l.code, l]))

export function getLanguageMeta(code: string): PinovaLanguage | undefined {
  return byCode.get(code)
}

export function isSupportedLang(code: string): code is LangCode {
  return byCode.has(code)
}

/** Résout un tag BCP-47 (navigateur) vers un code Pinova supporté. */
export function resolveLangFromBcp47(raw: string | null | undefined): LangCode {
  const normalized = (raw || '').trim().toLowerCase()
  if (!normalized) return 'en'

  if (byCode.has(normalized)) return normalized as LangCode

  const base = normalized.split('-')[0]
  if (byCode.has(base)) return base as LangCode

  if (base === 'zh' || normalized.startsWith('zh-')) return 'zh'
  if (base === 'pt') return 'pt'
  if (base === 'nb' || base === 'nn') return 'no'

  return 'en'
}

export function detectBrowserLangCode(): LangCode {
  if (typeof navigator === 'undefined') return 'en'
  const candidates: string[] = []
  if (Array.isArray(navigator.languages)) candidates.push(...navigator.languages)
  if (navigator.language) candidates.push(navigator.language)
  for (const raw of candidates) {
    const resolved = resolveLangFromBcp47(raw)
    if (resolved !== 'en' || raw.toLowerCase().startsWith('en')) return resolved
  }
  return 'en'
}

export function languageSearchHaystack(lang: PinovaLanguage): string {
  return [lang.code, lang.label, lang.nativeLabel, lang.label.toLowerCase(), lang.nativeLabel.toLowerCase()].join(' ')
}

export const REGION_ORDER: PinovaLanguage['region'][] = [
  'africa',
  'europe',
  'americas',
  'asia',
  'middle-east',
  'oceania',
]

export const REGION_LABELS: Record<PinovaLanguage['region'], { fr: string; en: string }> = {
  africa: { fr: 'Afrique', en: 'Africa' },
  europe: { fr: 'Europe', en: 'Europe' },
  americas: { fr: 'Amériques', en: 'Americas' },
  asia: { fr: 'Asie', en: 'Asia' },
  'middle-east': { fr: 'Moyen-Orient', en: 'Middle East' },
  oceania: { fr: 'Océanie', en: 'Oceania' },
}
