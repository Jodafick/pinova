import { ref, computed } from 'vue'
import { fr } from './locales/fr'
import { en } from './locales/en'
import { fon } from './locales/fon'

export type LangCode = 'fr' | 'en' | 'fon'

export const languages: { code: LangCode; label: string; flag: string; rtl?: boolean }[] = [
  { code: 'fr', label: 'Français', flag: '🇫🇷' },
  { code: 'en', label: 'English', flag: '🇬🇧' },
  { code: 'fon', label: 'Fɔngbè', flag: '🇧🇯' },
]

const dictionaries: Record<LangCode, Record<string, string>> = {
  fr,
  en,
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

export function getCurrentWebLang(): LangCode {
  return currentLang.value
}

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
