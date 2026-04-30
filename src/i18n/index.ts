import { ref, computed } from 'vue'
import { fr } from './locales/fr'
import { en } from './locales/en'
import { es } from './locales/es'
import { de } from './locales/de'
import { it } from './locales/it'
import { pt } from './locales/pt'
import { ar } from './locales/ar'
import { ja } from './locales/ja'
import { zh } from './locales/zh'
import { fon } from './locales/fon'

export type LangCode = 'fr' | 'en' | 'es' | 'de' | 'it' | 'pt' | 'ar' | 'ja' | 'zh' | 'fon'

export const languages: { code: LangCode; label: string; flag: string; rtl?: boolean }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'es', label: 'Español', flag: '🇪🇸' },
  { code: 'de', label: 'Deutsch', flag: '🇩🇪' },
  { code: 'it', label: 'Italiano', flag: '🇮🇹' },
  { code: 'pt', label: 'Português', flag: '🇵🇹' },
  { code: 'ar', label: 'العربية', flag: '🇸🇦', rtl: true },
  { code: 'ja', label: '日本語', flag: '🇯🇵' },
  { code: 'zh', label: '中文', flag: '🇨🇳' },
  { code: 'fon', label: 'Fɔngbè', flag: '🇧🇯' },
]

const dictionaries: Record<LangCode, Record<string, string>> = {
  fr,
  en,
  es,
  de,
  it,
  pt,
  ar,
  ja,
  zh,
  fon,
}

const detectBrowserLang = (): LangCode => {
  if (typeof navigator === 'undefined') return 'en'
  const candidates: string[] = []
  if (Array.isArray((navigator as any).languages)) candidates.push(...(navigator as any).languages)
  if (navigator.language) candidates.push(navigator.language)
  for (const raw of candidates) {
    const code = (raw.toLowerCase().split('-')[0] || '').trim()
    if (code && code in dictionaries) return code as LangCode
  }
  return 'en'
}

const currentLang = ref<LangCode>(detectBrowserLang())

export const useI18n = () => {
  const setLang = (code: LangCode) => {
    currentLang.value = code
    if (typeof document !== 'undefined') {
      document.documentElement.lang = code
      const meta = languages.find(l => l.code === code)
      document.documentElement.dir = meta?.rtl ? 'rtl' : 'ltr'
    }
  }

  const t = (key: string, vars?: Record<string, string | number>) => {
    const dict = dictionaries[currentLang.value] || dictionaries.en
    const fallback = dictionaries.en
    let str = dict[key] ?? fallback[key] ?? key
    if (vars) {
      for (const [k, v] of Object.entries(vars)) {
        str = str.replace(new RegExp(`{${k}}`, 'g'), String(v))
      }
    }
    return str
  }

  const currentLangMeta = computed(() => languages.find(l => l.code === currentLang.value)!)
  const isRtl = computed(() => !!currentLangMeta.value.rtl)

  return {
    currentLang,
    currentLangMeta,
    isRtl,
    languages,
    setLang,
    t,
  }
}
